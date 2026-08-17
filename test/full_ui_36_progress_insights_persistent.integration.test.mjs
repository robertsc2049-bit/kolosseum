// DEV NOTE: FULL-UI-36 progress insights lifecycle proof. Proves the four
// computed metric blocks (session adherence, strength trend, habit
// consistency, body-metric trend) are correct for a real athlete with a
// real 30-day-window mix of completed/partial sessions, two versions of
// one strength benchmark, habit completions and body-metric entries -
// read identically from both the athlete's own route and their accepted
// coach's read-only route - that an unrelated coach is rejected, that
// deterministic compile output is completely unaffected, and that
// everything survives a fresh-process restart. Every step crosses only
// public HTTP routes. Nothing in this slice writes new persisted state -
// every number is recomputed fresh from facts other slices already own.

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
  const email = `insights_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Insights ${label} Coach`,
    email,
    password: `Insights${label}Coach!2026`,
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
    { display_name: `Insights ${label} Coach`, email },
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
  const email = `insights_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Insights ${label} Athlete`,
    email,
    password: `Insights${label}Athlete!2026`,
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

function phase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

function workItems() {
  return [
    ["back_squat", 75],
    ["bench_press", 75]
  ].map(([exerciseId, percent], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: 5,
    rep_min: 5,
    rep_max: 5,
    load_mode: "percent_1rm",
    percent_1rm: percent,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

function blockWithSessions(sessionCount) {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-UI-36 Block",
    description: "",
    block_type: "strength",
    week_count: sessionCount,
    weeks: Array.from({ length: sessionCount }, (_, index) => index + 1).map((week) => ({
      week_id: "",
      order_index: week,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: `Session ${week}`,
        work_items: workItems()
      }]
    }))
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-36 progress insights proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithSessions(2)],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/complete`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: complete`
  );

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );

  return template;
}

async function compileSession(baseUrl, coach, athleteUserId) {
  const compiled = await request(
    baseUrl,
    "POST",
    "/blocks/compile?create_session=true&beta_path=true",
    {
      phase1_input: phase1Input(),
      beta_user_id: athleteUserId,
      beta_coach_user_id: coach.userId
    }
  );
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");
  return sessionId;
}

async function compileFixture(baseUrl, fixture) {
  const result = await request(baseUrl, "POST", "/blocks/compile", { phase1_input: fixture });
  assert.ok(
    result.response.status === 200 || result.response.status === 201,
    `deterministic compile: expected 200 or 201, received ${result.response.status}. raw=${result.text}`
  );
  return result.json;
}

function assertInsightsShape(insights, athleteUserId, label) {
  assert.equal(insights.athlete_user_id, athleteUserId, `${label}: athlete_user_id`);
  assert.equal(insights.window_days, 30, `${label}: window_days`);
  assert.ok(insights.generated_at_iso8601, `${label}: generated_at_iso8601`);
  assert.equal(insights.factual_records_only, true, `${label}: factual_records_only`);
  assert.equal(insights.calls_engine, false, `${label}: calls_engine`);
  assert.equal(insights.engine_visible, false, `${label}: engine_visible`);
}

test(
  "Progress insights: session adherence, strength trend, habit consistency and body-metric trend computed identically for athlete and coach, relationship gating, deterministic compile untouched, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];
    const athleteUserIds = [];
    const sessionIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
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
      relationshipId: `insights_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Strength trend fixture: one profile append with two immutable
    // benchmark versions for the same exercise - v1 (40 days ago) then
    // v2 (today), so the current-vs-most-recent-superseded delta is real.
    // ============================================================
    const v1Benchmark = {
      benchmark_id: `back_squat_v1_${nonce}`,
      exercise_id: "back_squat",
      value: 150,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: daysAgoDateOnly(40),
      source_note: "FULL-UI-36 v1",
      replaces_reference_id: null
    };

    // bench_press also needs a benchmark - the session's work items use
    // percent_1rm load_mode for both exercises - but only one version, so
    // its strength trend has no prior value to compare against.
    const benchPressBenchmark = {
      benchmark_id: `bench_press_v1_${nonce}`,
      exercise_id: "bench_press",
      value: 100,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: daysAgoDateOnly(40),
      source_note: "FULL-UI-36 bench",
      replaces_reference_id: null
    };

    const firstProfile = await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coach.userId,
      athlete_user_id: athlete.userId,
      preferred_weight_unit: "kg",
      load_rounding_increment: 2.5,
      bodyweight: 90,
      bodyweight_unit: "kg",
      benchmarks: [v1Benchmark, benchPressBenchmark],
      expected_current_record_sha256: null
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(firstProfile, 201, "strength profile v1");

    const v2Benchmark = {
      benchmark_id: `back_squat_v2_${nonce}`,
      exercise_id: "back_squat",
      value: 160,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: daysAgoDateOnly(0),
      source_note: "FULL-UI-36 v2",
      replaces_reference_id: null
    };

    const secondProfile = await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coach.userId,
      athlete_user_id: athlete.userId,
      preferred_weight_unit: "kg",
      load_rounding_increment: 2.5,
      bodyweight: 90,
      bodyweight_unit: "kg",
      benchmarks: [v1Benchmark, benchPressBenchmark, v2Benchmark],
      expected_current_record_sha256: firstProfile.json?.profile?.record_sha256 ?? null
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(secondProfile, 201, "strength profile v2");

    // ============================================================
    // Session adherence fixture: one fully completed session, one
    // partial session (one exercise skipped, one completed).
    // ============================================================
    const template = await createActivatedTemplate(baseUrl, coach.userId, `Full36 Programme ${nonce}`);

    const assignment = await request(
      baseUrl,
      "POST",
      "/coach-workspace/athlete-assignment",
      {
        request_id: `full_ui_36_request_${nonce}`,
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coach.userId,
        athlete_user_id: athlete.userId,
        template_id: template.template_id,
        activity_id: "powerlifting",
        event_id: ""
      },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(assignment, 201, "athlete assignment");

    const completedSessionId = await compileSession(baseUrl, coach, athlete.userId);
    sessionIds.push(completedSessionId);
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(completedSessionId)}/start`, {});
    for (const exerciseId of ["back_squat", "bench_press"]) {
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(completedSessionId)}/events`, {
          type: "COMPLETE_EXERCISE", exercise_id: exerciseId
        }),
        201,
        `complete ${exerciseId} (completed session)`
      );
    }

    const partialSessionId = await compileSession(baseUrl, coach, athlete.userId);
    sessionIds.push(partialSessionId);
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/start`, {});
    assertStatus(
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/events`, {
        type: "SKIP_EXERCISE", exercise_id: "back_squat", reason_code: "time_constraint"
      }),
      201,
      "skip back_squat (partial session)"
    );
    assertStatus(
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/events`, {
        type: "COMPLETE_EXERCISE", exercise_id: "bench_press"
      }),
      201,
      "complete bench_press (partial session)"
    );

    // ============================================================
    // Habit consistency fixture: one daily habit, six completions spread
    // across the last 30 days.
    // ============================================================
    const habitResult = await request(baseUrl, "POST", "/habits", {
      habit_label: "Daily stretch",
      cadence: "daily"
    }, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(habitResult, 201, "create habit");
    const habitId = habitResult.json?.habit?.habit_id;
    assert.ok(habitId, "expected a habit_id");

    for (const daysAgo of [0, 5, 10, 15, 20, 25]) {
      assertStatus(
        await request(baseUrl, "POST", `/habits/${encodeURIComponent(habitId)}/completions`, {
          completion_date: daysAgoDateOnly(daysAgo)
        }, { cookie: athlete.cookie, csrf: athlete.csrf }),
        201,
        `log habit completion ${daysAgo} days ago`
      );
    }

    // ============================================================
    // Body-metric trend fixture: waist has both a recent and a
    // 30+-day-prior entry (real delta); chest has only one entry (no
    // prior value to compare against - must not fabricate a delta).
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/body-metrics", {
        metric_type: "waist_circumference_cm", value: 84, effective_date: daysAgoDateOnly(35)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      201,
      "log waist entry (35 days ago)"
    );
    assertStatus(
      await request(baseUrl, "POST", "/body-metrics", {
        metric_type: "waist_circumference_cm", value: 80, effective_date: daysAgoDateOnly(0)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      201,
      "log waist entry (today)"
    );
    assertStatus(
      await request(baseUrl, "POST", "/body-metrics", {
        metric_type: "chest_circumference_cm", value: 95, effective_date: daysAgoDateOnly(0)
      }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      201,
      "log chest entry (today, no prior)"
    );

    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);

    // ============================================================
    // Athlete reads their own computed summary.
    // ============================================================
    const athleteInsights = await request(baseUrl, "GET", "/progress-insights", undefined, { cookie: athlete.cookie });
    assertStatus(athleteInsights, 200, "athlete reads own progress insights");
    const insights = athleteInsights.json?.insights;
    assertInsightsShape(insights, athlete.userId, "athlete insights");

    assert.equal(insights.session_adherence.total_sessions, 2, "adherence: total_sessions");
    assert.equal(insights.session_adherence.completed_sessions, 1, "adherence: completed_sessions");
    assert.equal(insights.session_adherence.partial_sessions, 1, "adherence: partial_sessions");
    assert.equal(insights.session_adherence.in_progress_sessions, 0, "adherence: in_progress_sessions");
    assert.equal(insights.session_adherence.ready_sessions, 0, "adherence: ready_sessions");
    assert.equal(insights.session_adherence.adherence_percentage, 50, "adherence: adherence_percentage");
    assert.equal(insights.session_adherence.has_sufficient_data, true, "adherence: has_sufficient_data");

    assert.equal(insights.strength_trends.length, 2, "expected two exercises' strength trends");
    const strengthByExercise = Object.fromEntries(insights.strength_trends.map((entry) => [entry.exercise_id, entry]));

    const squatTrend = strengthByExercise.back_squat;
    assert.equal(squatTrend.current_value, 160);
    assert.equal(squatTrend.current_unit, "kg");
    assert.equal(squatTrend.has_prior_value, true);
    assert.equal(squatTrend.prior_value, 150);
    assert.equal(squatTrend.delta, 10);
    assert.ok(Math.abs(squatTrend.delta_percentage - 6.67) < 0.01, `expected ~6.67%, got ${squatTrend.delta_percentage}`);

    const benchTrend = strengthByExercise.bench_press;
    assert.equal(benchTrend.current_value, 100);
    assert.equal(benchTrend.has_prior_value, false, "bench_press has only one benchmark version - no prior to compare");
    assert.equal(benchTrend.prior_value, null);
    assert.equal(benchTrend.delta, null, "must not fabricate a delta with no prior value");

    assert.equal(insights.habit_consistency.length, 1, "expected exactly one habit");
    const habitInsight = insights.habit_consistency[0];
    assert.equal(habitInsight.habit_id, habitId);
    assert.equal(habitInsight.habit_label, "Daily stretch");
    assert.equal(habitInsight.cadence, "daily");
    assert.equal(habitInsight.total_completions, 6);
    assert.equal(habitInsight.window_completions, 6);
    assert.equal(habitInsight.window_expected_units, 30);
    assert.equal(habitInsight.completion_rate_percentage, 20);

    assert.equal(insights.body_metric_trends.length, 2, "expected two body-metric types");
    const byMetricType = Object.fromEntries(insights.body_metric_trends.map((entry) => [entry.metric_type, entry]));

    assert.equal(byMetricType.waist_circumference_cm.latest_value, 80);
    assert.equal(byMetricType.waist_circumference_cm.has_prior_value, true);
    assert.equal(byMetricType.waist_circumference_cm.prior_value, 84);
    assert.equal(byMetricType.waist_circumference_cm.delta, -4);
    assert.ok(
      Math.abs(byMetricType.waist_circumference_cm.delta_percentage - -4.76) < 0.01,
      `expected ~-4.76%, got ${byMetricType.waist_circumference_cm.delta_percentage}`
    );

    assert.equal(byMetricType.chest_circumference_cm.latest_value, 95);
    assert.equal(byMetricType.chest_circumference_cm.has_prior_value, false, "chest has no 30+-day-prior entry");
    assert.equal(byMetricType.chest_circumference_cm.prior_value, null);
    assert.equal(byMetricType.chest_circumference_cm.delta, null, "must not fabricate a delta with no prior value");

    // ============================================================
    // The accepted coach reads the identical computed summary.
    // ============================================================
    const coachInsights = await request(
      baseUrl, "GET", `/progress-insights/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: coach.cookie }
    );
    assertStatus(coachInsights, 200, "coach reads athlete's progress insights");
    const { generated_at_iso8601: _athleteGeneratedAt, ...athleteInsightsStable } = insights;
    const { generated_at_iso8601: _coachGeneratedAt, ...coachInsightsStable } = coachInsights.json?.insights ?? {};
    assert.deepEqual(coachInsightsStable, athleteInsightsStable, "coach view must match the athlete's own computed view");

    // ============================================================
    // An unrelated coach is rejected outright.
    // ============================================================
    const strangerInsights = await request(
      baseUrl, "GET", `/progress-insights/coach/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: strangerCoach.cookie }
    );
    assertStatus(strangerInsights, 403, "unrelated coach cannot read this athlete's progress insights");
    assert.equal(strangerInsights.json?.error, "progress_insights_relationship_access_denied");

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Progress insights reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: every computed number reconstructs
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedInsights = await request(restarted.baseUrl, "GET", "/progress-insights", undefined, { cookie: athlete.cookie });
    assertStatus(restartedInsights, 200, "athlete progress insights after fresh-process restart");
    assert.equal(restartedInsights.json?.insights?.session_adherence?.adherence_percentage, 50);
    assert.equal(restartedInsights.json?.insights?.strength_trends?.[0]?.current_value, 160);
    assert.equal(restartedInsights.json?.insights?.habit_consistency?.[0]?.total_completions, 6);
    assert.equal(restartedInsights.json?.insights?.body_metric_trends?.length, 2);
  }
);
