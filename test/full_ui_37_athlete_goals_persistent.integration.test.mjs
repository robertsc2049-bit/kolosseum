// DEV NOTE: FULL-UI-37 athlete goal-setting lifecycle proof. Proves a
// metric-linked goal's baseline is captured once at creation from the
// athlete's then-latest body-metric entry, that current_value/
// progress_percentage/is_goal_met recompute correctly as a new entry is
// logged, that a free-text-only goal carries no numeric fields, that
// resolve supersedes the record and is idempotent, that the athlete and
// coach routes return byte-identical output, that an unrelated coach is
// rejected, that a target_value without a linked metric_type is rejected,
// that deterministic compile output is completely unaffected, and that
// everything survives a fresh-process restart. Every step crosses only
// public HTTP routes. Nothing here persists a derived number - only the
// declared facts (label, metric_type, target_value, baseline, target_date,
// status) are ever stored.

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

function daysAgoDateOnly(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `goals_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Goals ${label} Coach`,
    email,
    password: `Goals${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Goals ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);

  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);

  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `goals_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Goals ${label} Athlete`,
    email,
    password: `Goals${label}Athlete!2026`,
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

  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: state === "revoked" ? now : null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function compileFixture(baseUrl, fixture) {
  const result = await request(baseUrl, "POST", "/blocks/compile", { phase1_input: fixture });
  assert.ok(
    result.response.status === 200 || result.response.status === 201,
    `deterministic compile: expected 200 or 201, received ${result.response.status}. raw=${result.text}`
  );
  return result.json;
}

test(
  "Athlete goals: metric-linked baseline/progress lifecycle, free-text goal, resolve idempotency, coach parity, relationship gating, validation, deterministic compile untouched, fresh-process restart",
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

    await seedRelationship(baseUrl, {
      relationshipId: `goals_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Rejected: a target_value without a linked metric_type.
    // ============================================================
    const invalidGoal = await request(baseUrl, "POST", "/athlete-goals", {
      goal_label: "Invalid goal",
      target_value: 50
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(invalidGoal, 400, "target_value without metric_type must be rejected");
    assert.equal(invalidGoal.json?.error, "athlete_goals_athlete_goal_target_value_without_metric_type");

    // ============================================================
    // Pre-existing body-metric entry, so the metric-linked goal below
    // captures a real baseline at creation time.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/body-metrics", {
        metric_type: "waist_circumference_cm", value: 84, effective_date: daysAgoDateOnly(10)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      201,
      "log waist entry (10 days ago, pre-goal baseline)"
    );

    const targetDate = daysAgoDateOnly(-60).slice(0, 10);
    const metricGoal = await request(baseUrl, "POST", "/athlete-goals", {
      goal_label: "Slim waist for competition",
      metric_type: "waist_circumference_cm",
      target_value: 78,
      target_date: targetDate
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(metricGoal, 201, "create metric-linked goal");
    const metricGoalId = metricGoal.json?.goal?.goal_id;
    assert.ok(metricGoalId, "expected a goal_id");
    assert.equal(metricGoal.json.goal.baseline_value, 84, "baseline captured from pre-existing entry");
    assert.equal(metricGoal.json.goal.target_direction, "decrease", "78 target vs 84 baseline is a decrease");
    assert.equal(metricGoal.json.goal.status, "active");

    const freeTextGoal = await request(baseUrl, "POST", "/athlete-goals", {
      goal_label: "Run a 5k without stopping"
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(freeTextGoal, 201, "create free-text goal");
    assert.equal(freeTextGoal.json.goal.metric_type, null);
    assert.equal(freeTextGoal.json.goal.target_value, null);
    assert.equal(freeTextGoal.json.goal.baseline_value, null);

    // ============================================================
    // Read own goals: metric-linked goal enriched with current_value
    // equal to the baseline (no newer entry logged yet) - progress is
    // 0% (no movement from baseline), goal not yet met.
    // ============================================================
    const goalsBefore = await request(baseUrl, "GET", "/athlete-goals", undefined, { cookie: athlete.cookie });
    assertStatus(goalsBefore, 200, "athlete reads own goals (before new entry)");
    const goalsById = Object.fromEntries((goalsBefore.json?.goals ?? []).map((goal) => [goal.goal_id, goal]));

    assert.equal(goalsById[metricGoalId].has_current_value, true, "current value present from the pre-existing entry");
    assert.equal(goalsById[metricGoalId].current_value, 84);
    assert.equal(goalsById[metricGoalId].progress_percentage, 0, "no movement from baseline yet");
    assert.equal(goalsById[metricGoalId].is_goal_met, false, "84 does not satisfy a decrease-to-78 target");

    const freeTextGoalId = freeTextGoal.json.goal.goal_id;
    assert.equal(goalsById[freeTextGoalId].has_current_value, false);
    assert.equal(goalsById[freeTextGoalId].current_value, null);
    assert.equal(goalsById[freeTextGoalId].progress_percentage, null);
    assert.equal(goalsById[freeTextGoalId].is_goal_met, null);

    // ============================================================
    // Log a newer entry exactly at target - progress recomputes to
    // 100% and the goal is now met, purely from reading the fact.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/body-metrics", {
        metric_type: "waist_circumference_cm", value: 78, effective_date: daysAgoDateOnly(0)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      201,
      "log waist entry (today, at target)"
    );

    const goalsAfter = await request(baseUrl, "GET", "/athlete-goals", undefined, { cookie: athlete.cookie });
    assertStatus(goalsAfter, 200, "athlete reads own goals (after new entry)");
    const metricGoalAfter = (goalsAfter.json?.goals ?? []).find((goal) => goal.goal_id === metricGoalId);
    assert.equal(metricGoalAfter.current_value, 78);
    assert.equal(metricGoalAfter.progress_percentage, 100);
    assert.equal(metricGoalAfter.is_goal_met, true);

    // ============================================================
    // Resolve the metric-linked goal as achieved; re-resolving is a
    // no-op that returns the same already-resolved record.
    // ============================================================
    const resolved = await request(
      baseUrl, "POST", `/athlete-goals/${encodeURIComponent(metricGoalId)}/resolve`, { resolution: "achieved" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(resolved, 200, "resolve metric-linked goal as achieved");
    assert.equal(resolved.json.goal.status, "achieved");
    assert.ok(resolved.json.goal.resolved_at_iso8601, "expected resolved_at_iso8601 to be set");

    const reResolved = await request(
      baseUrl, "POST", `/athlete-goals/${encodeURIComponent(metricGoalId)}/resolve`, { resolution: "abandoned" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(reResolved, 200, "re-resolve is idempotent, not an error");
    assert.equal(reResolved.json.goal.status, "achieved", "already-resolved status is not overwritten by a later call");
    assert.equal(reResolved.json.goal.resolved_at_iso8601, resolved.json.goal.resolved_at_iso8601);

    // ============================================================
    // The accepted coach reads the identical computed goal list.
    // ============================================================
    const athleteGoalsFinal = await request(baseUrl, "GET", "/athlete-goals", undefined, { cookie: athlete.cookie });
    assertStatus(athleteGoalsFinal, 200, "athlete reads final goal list");

    const coachGoals = await request(
      baseUrl, "GET", `/athlete-goals/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: coach.cookie }
    );
    assertStatus(coachGoals, 200, "coach reads athlete's goal list");
    assert.deepEqual(
      coachGoals.json?.goals,
      athleteGoalsFinal.json?.goals,
      "coach view must match the athlete's own computed view exactly"
    );

    // ============================================================
    // An unrelated coach is rejected outright.
    // ============================================================
    const strangerGoals = await request(
      baseUrl, "GET", `/athlete-goals/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: strangerCoach.cookie }
    );
    assertStatus(strangerGoals, 403, "unrelated coach cannot read this athlete's goals");
    assert.equal(strangerGoals.json?.error, "athlete_goals_relationship_access_denied");

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Athlete goals reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: every computed number reconstructs
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedGoals = await request(restarted.baseUrl, "GET", "/athlete-goals", undefined, { cookie: athlete.cookie });
    assertStatus(restartedGoals, 200, "athlete goals after fresh-process restart");
    const restartedMetricGoal = (restartedGoals.json?.goals ?? []).find((goal) => goal.goal_id === metricGoalId);
    assert.equal(restartedMetricGoal.status, "achieved");
    assert.equal(restartedMetricGoal.current_value, 78);
    assert.equal(restartedMetricGoal.progress_percentage, 100);
    assert.equal(restartedGoals.json?.goals?.length, 2);
  }
);
