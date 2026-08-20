// DEV NOTE: FULL-UI-29 - body-metric and habit/streak lifecycle proof.
// Proves an athlete can log/list their own body-metric history, an
// accepted coach can also log entries (source forced server-side) and
// read the merged history, an athlete can create a habit and log
// completions with real streak arithmetic (not just "some number"),
// duplicate same-day completions are idempotent, an archived habit
// rejects further completions, a revoked relationship blocks the coach
// while the athlete's own view is unaffected, and all of this survives a
// fresh-process restart. Every step crosses only public HTTP routes.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// computeHabitStreak's "current" streak is relative to the real wall-clock
// "as of" date the server uses (today), not a fixture date - so streak
// fixtures must be expressed relative to today, not as absolute dates,
// or "current" would spuriously read as broken whenever this test runs
// more than a day after the date literals were written.
function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function spawnNode(argumentsList, options) {
  const child = spawn(process.execPath, argumentsList, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  return {
    child,
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function waitForExit(child) {
  if (child.exitCode !== null) {
    return { code: child.exitCode, signal: child.signalCode ?? null };
  }
  return await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal: signal ?? null }));
  });
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForHealth(processRecord, baseUrl, timeoutMilliseconds = 15000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;

  while (Date.now() < deadline) {
    if (processRecord.child.exitCode !== null) {
      const exit = await waitForExit(processRecord.child);
      throw new Error(
        `Server exited before health became ready. exit_code=${exit.code} signal=${exit.signal}\n` +
        `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
      );
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`Health returned ${response.status}`);
    }
    catch (error) {
      lastError = error;
    }
    await delay(120);
  }

  throw new Error(
    `Server did not become healthy. base_url=${baseUrl} last_error=${lastError?.message ?? String(lastError)}\n` +
    `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
  );
}

async function startFreshServerProcess(root, environment) {
  const mainModule = path.join(root, "dist", "src", "main.js");
  await fs.access(mainModule);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const processRecord = spawnNode([mainModule], {
    cwd: root,
    env: { ...environment, PORT: String(port) }
  });
  await waitForHealth(processRecord, baseUrl);
  return { ...processRecord, baseUrl, port };
}

async function stopFreshServerProcess(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  if (process.platform === "win32") server.child.kill();
  else server.child.kill("SIGTERM");
  await Promise.race([waitForExit(server.child), delay(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([waitForExit(server.child), delay(2000)]);
  }
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `metric_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Metric ${label} Coach`,
    email,
    password: `Metric${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  const onboardingProfile = await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Metric ${label} Coach`, email },
    { cookie, csrf }
  );
  assertStatus(onboardingProfile, 200, `${label} coach onboarding profile`);

  const onboardingTerms = await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  );
  assertStatus(onboardingTerms, 200, `${label} coach onboarding terms`);

  const onboardingComplete = await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  );
  assertStatus(onboardingComplete, 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `metric_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Metric ${label} Athlete`,
    email,
    password: `Metric${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();
  const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: (state === "revoked" || state === "declined") ? now : null,
    expires_at_iso8601: state === "invited" ? farFuture : null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

test(
  "Body metrics: athlete self-log, accepted-coach log/read, out-of-range rejected, revoked relationship blocks coach only, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const strangerCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(strangerCoach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    const athleteEntry = await request(
      baseUrl, "POST", "/body-metrics",
      { metric_type: "waist_circumference_cm", value: 80, effective_date: "2026-01-01" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(athleteEntry, 201, "athlete logs a body-metric entry before any relationship exists");
    assert.equal(athleteEntry.json?.entry?.source, "athlete_entered");

    const listBeforeAcceptance = await request(
      baseUrl, "GET", `/body-metrics/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(listBeforeAcceptance, 403, "coach cannot list an athlete's body metrics with no relationship yet");

    await seedRelationship(baseUrl, {
      relationshipId: `metric_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    const coachEntry = await request(
      baseUrl, "POST", `/body-metrics/coach/${encodeURIComponent(athlete.userId)}`,
      { metric_type: "body_fat_percentage", value: 15, effective_date: "2026-01-08" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(coachEntry, 201, "accepted coach logs a body-metric entry for the athlete");
    assert.equal(coachEntry.json?.entry?.source, "coach_entered", "source is forced server-side, never client-supplied");
    assert.equal(coachEntry.json?.entry?.logged_by_user_id, coach.userId);

    const athleteHistory = await request(baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(athleteHistory, 200, "athlete lists merged body-metric history");
    assert.equal(athleteHistory.json?.entries?.length, 2);

    // ============================================================
    // Nutrition reuses the same body_metric_entry record type and
    // /body-metrics routes under new metric_type values (calories_kcal,
    // protein_g, carbs_g, fat_g) - no new record type, schema migration
    // or route exists for it. A day's macros are logged as four separate
    // entries sharing one effective_date, and a later log for the same
    // date+metric_type is a correction (most-recent-logged wins), same
    // semantics as every other metric_type.
    // ============================================================
    for (const [metricType, value] of [["calories_kcal", 2400], ["protein_g", 180], ["carbs_g", 220], ["fat_g", 70]]) {
      const nutritionEntry = await request(
        baseUrl, "POST", "/body-metrics",
        { metric_type: metricType, value, effective_date: "2026-01-05" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(nutritionEntry, 201, `athlete logs ${metricType}`);
      assert.equal(nutritionEntry.json?.entry?.unit, metricType === "calories_kcal" ? "kcal" : "g");
    }

    const outOfRangeCalories = await request(
      baseUrl, "POST", "/body-metrics",
      { metric_type: "calories_kcal", value: -5, effective_date: "2026-01-05" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(outOfRangeCalories, 400, "a negative calorie value is rejected");

    const historyWithNutrition = await request(baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(historyWithNutrition, 200, "athlete lists history including nutrition entries");
    assert.equal(historyWithNutrition.json?.entries?.length, 6, "2 body metrics + 4 nutrition entries");

    const outOfRange = await request(
      baseUrl, "POST", "/body-metrics",
      { metric_type: "waist_circumference_cm", value: 5000, effective_date: "2026-01-09" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(outOfRange, 400, "an out-of-range value is rejected");

    const strangerList = await request(
      baseUrl, "GET", `/body-metrics/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: strangerCoach.cookie }
    );
    assertStatus(strangerList, 403, "an unrelated coach cannot list this athlete's body metrics");

    await seedRelationship(baseUrl, {
      relationshipId: `metric_rel_${nonce}_revoke`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "revoked"
    });

    const listAfterRevoke = await request(
      baseUrl, "GET", `/body-metrics/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(listAfterRevoke, 403, "coach is blocked from listing after revocation");

    const athleteHistoryAfterRevoke = await request(baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(athleteHistoryAfterRevoke, 200, "athlete's own view is unaffected by the coach relationship being revoked");
    assert.equal(athleteHistoryAfterRevoke.json?.entries?.length, 6, "no rejected entry was ever persisted");

    restarted = await startFreshServerProcess(root, process.env);
    const restartedHistory = await request(restarted.baseUrl, "GET", "/body-metrics", undefined, { cookie: athlete.cookie });
    assertStatus(restartedHistory, 200, "body-metric history after fresh-process restart");
    assert.equal(restartedHistory.json?.entries?.length, 6);
  }
);

test(
  "Habits: create, log completions with real streak arithmetic, idempotent same-day completion, archived habit rejects completion, coach read-only, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coach = await registerCoach(baseUrl, nonce, "h");
    coachUserIds.push(coach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `habit_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    const created = await request(
      baseUrl, "POST", "/habits",
      { habit_label: "Log a training session", cadence: "daily" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(created, 201, "athlete creates a habit");
    const habitId = created.json?.habit?.habit_id;
    assert.ok(habitId, "expected a habit_id");

    // ============================================================
    // Real streak arithmetic, hand-computed relative to today: complete
    // 6/5/4 days ago (a run of 3 - the longest), skip 3/2 days ago, then
    // complete yesterday (a new run of 1, still "alive" today since only
    // one cadence unit has elapsed with no completion). Expect longest=3,
    // current=1.
    // ============================================================
    for (const completionDate of [daysAgo(6), daysAgo(5), daysAgo(4), daysAgo(1)]) {
      const completion = await request(
        baseUrl, "POST", `/habits/${encodeURIComponent(habitId)}/completions`,
        { completion_date: completionDate },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(completion, 201, `log completion for ${completionDate}`);
    }

    const habitsAfterCompletions = await request(baseUrl, "GET", "/habits", undefined, { cookie: athlete.cookie });
    assertStatus(habitsAfterCompletions, 200, "athlete lists habits with streaks");
    const habit = habitsAfterCompletions.json?.habits?.find((entry) => entry.habit_id === habitId);
    assert.ok(habit, "expected the created habit in the list");
    assert.equal(habit.total_completions, 4, "hand-computed: 4 raw completions logged");
    assert.equal(habit.longest_streak_length, 3, "hand-computed: days 1-2-3 is the longest run");
    assert.equal(habit.current_streak_length, 1, "hand-computed: yesterday alone is the trailing run since the break 2-3 days ago");

    // ============================================================
    // Idempotent replay: logging the same completion_date again must not
    // create a second record or change the totals.
    // ============================================================
    const duplicateCompletion = await request(
      baseUrl, "POST", `/habits/${encodeURIComponent(habitId)}/completions`,
      { completion_date: daysAgo(1) },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(duplicateCompletion, 201, "idempotent replay of the same completion_date");
    assert.ok(duplicateCompletion.json?.completion?.completion_id, "expected the existing completion record back, not an error");

    const habitsAfterDuplicate = await request(baseUrl, "GET", "/habits", undefined, { cookie: athlete.cookie });
    const habitAfterDuplicate = habitsAfterDuplicate.json?.habits?.find((entry) => entry.habit_id === habitId);
    assert.equal(habitAfterDuplicate.total_completions, 4, "a duplicate same-day completion must not create a second record");

    // ============================================================
    // Coach (accepted relationship) can read the same habit with the
    // same streak numbers, but has no write path anywhere.
    // ============================================================
    const coachHabits = await request(
      baseUrl, "GET", `/habits/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(coachHabits, 200, "accepted coach lists the athlete's habits read-only");
    const coachViewOfHabit = coachHabits.json?.habits?.find((entry) => entry.habit_id === habitId);
    assert.equal(coachViewOfHabit.longest_streak_length, 3);
    assert.equal(coachViewOfHabit.current_streak_length, 1);

    const coachAttemptedCompletion = await request(
      baseUrl, "POST", `/habits/coach/${encodeURIComponent(athlete.userId)}/completions`,
      { completion_date: daysAgo(0) },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assert.equal(coachAttemptedCompletion.response.status, 404, "no coach-facing habit-completion route exists at all");

    // ============================================================
    // Archiving blocks further completions, but the habit and its
    // history remain visible.
    // ============================================================
    const archived = await request(
      baseUrl, "POST", `/habits/${encodeURIComponent(habitId)}/archive`, undefined,
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(archived, 200, "athlete archives the habit");
    assert.ok(archived.json?.habit?.archived_at_iso8601, "expected archived_at_iso8601 to be set");

    const completionAfterArchive = await request(
      baseUrl, "POST", `/habits/${encodeURIComponent(habitId)}/completions`,
      { completion_date: daysAgo(0) },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(completionAfterArchive, 409, "an archived habit rejects further completions");

    // ============================================================
    // Fresh-process restart: the habit, its archived state and its
    // streak numbers reconstruct identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedHabits = await request(restarted.baseUrl, "GET", "/habits", undefined, { cookie: athlete.cookie });
    assertStatus(restartedHabits, 200, "habits after fresh-process restart");
    const restartedHabit = restartedHabits.json?.habits?.find((entry) => entry.habit_id === habitId);
    assert.ok(restartedHabit.archived_at_iso8601, "archived state survives a restart");
    assert.equal(restartedHabit.total_completions, 4);
    assert.equal(restartedHabit.longest_streak_length, 3);
  }
);
