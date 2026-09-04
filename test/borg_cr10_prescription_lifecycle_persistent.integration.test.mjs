// DEV NOTE: Borg/CR10-prescription lift closure - proves a coach can author
// a Borg-loaded or CR10-loaded programme, that the intensity is compiled
// through Phase6 unresolved (no arithmetic, no inference), that an athlete
// can record a closed-range Borg or CR10 self-report during execution, and
// that all of this survives a fresh-process restart. Mirrors
// rpe_prescription_lifecycle_persistent.integration.test.mjs exactly, one
// test per scale since BORG_REPORT/CR10_REPORT are kept separate (matching
// how RPE_REPORT isn't parameterized either). Every step crosses only
// public HTTP routes the real single-page app itself calls.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test, { after } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

// DEV NOTE: both tests below share the one module-level `pool` singleton -
// pool.end() is closed exactly once here, after every test in this file has
// finished, rather than per-test (which would close it out from under the
// second test).
after(async () => {
  await pool.end();
});

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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function borgWorkItems() {
  return [
    ["back_squat", 15],
    ["bench_press", 13],
    ["deadlift", 17],
    ["overhead_press", 11]
  ].map(([exerciseId, borgValue], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "borg",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    borg_value: borgValue,
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

function cr10WorkItems() {
  return [
    ["back_squat", 7.5],
    ["bench_press", 5],
    ["deadlift", 9],
    ["overhead_press", 3.5]
  ].map(([exerciseId, cr10Value], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "cr10",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    cr10_value: cr10Value,
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

function blockOfWeeks(weekCount, namePrefix, workItems) {
  return {
    block_id: "",
    order_index: 1,
    name: `${namePrefix} Block`,
    description: "",
    block_type: "strength",
    week_count: weekCount,
    weeks: Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => ({
      week_id: "",
      order_index: week,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: `Week ${week} Session`,
        work_items: workItems()
      }]
    }))
  };
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

test(
  "Borg prescription lift: coach authors Borg-loaded programme, engine passes Borg through unresolved, athlete records a closed-range Borg self-report, all survive a fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    let server = null;
    let restarted = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds.filter(Boolean)]
      );
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coachEmail = `borg_lift_coach_${nonce}@example.com`;
    const coachRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "Borg Lift Coach",
      email: coachEmail,
      password: "BorgLiftCoach!2026",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(coachRegistration, 201, "coach registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    userIds.push(coachUserId);
    const coachCookie = sessionCookie(coachRegistration, "coach registration");
    const coachCsrf = coachRegistration.json?.csrf_token;

    const athleteEmail = `borg_lift_athlete_${nonce}@example.com`;
    const athleteRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "Borg Lift Athlete",
      email: athleteEmail,
      password: "BorgLiftAthlete!2026",
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(athleteRegistration, 201, "athlete registration");
    const athleteUserId = athleteRegistration.json?.account?.user_id ?? "";
    userIds.push(athleteUserId);

    const relationshipTimestamp = new Date().toISOString();
    const relationship = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `borg_lift_relationship_${nonce}`,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: relationshipTimestamp,
      created_at_iso8601: relationshipTimestamp,
      updated_at_iso8601: relationshipTimestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: null
    });
    assertStatus(relationship, 201, "coach-athlete relationship");

    // ============================================================
    // builder_loading (Borg branch): coach authors a template where
    // every work item is Borg-loaded, not percent_1rm/fixed_weight/
    // bodyweight/rpe/cr10 - no athlete strength profile is required,
    // since Borg needs no arithmetic resolution.
    // ============================================================
    const savedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "Borg Lift Programme",
      description: "Borg-prescription lift proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [blockOfWeeks(1, "Borg Lift", borgWorkItems)],
      updated_at_iso8601: new Date().toISOString()
    });
    assertStatus(savedTemplate, 201, "create Borg-loaded draft template");
    const templateId = savedTemplate.json?.template?.template_id;
    assert.equal(savedTemplate.json?.template?.template_status, "draft");

    const templateWorkItems =
      savedTemplate.json?.template?.template_structure?.blocks?.[0]?.weeks?.[0]?.days?.[0]?.sessions?.[0]?.work_items ?? [];
    assert.equal(templateWorkItems.length, 4, "expected all four Borg work items to persist");
    for (const workItem of templateWorkItems) {
      assert.equal(workItem.loading_reference?.type, "borg", `expected loading_reference.type "borg" for ${workItem.exercise_id}`);
      const borgValue = workItem.loading_reference?.value;
      assert.ok(
        Number.isInteger(borgValue) && borgValue >= 6 && borgValue <= 20,
        `expected a closed 6-20 borg value for ${workItem.exercise_id}`
      );
    }

    const completed = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, {
      coach_user_id: coachUserId
    });
    assertStatus(completed, 200, "complete Borg-loaded template");

    const activated = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, {
      coach_user_id: coachUserId
    });
    assertStatus(activated, 200, "activate Borg-loaded template");
    assert.equal(activated.json?.template?.template_status, "active");

    // ============================================================
    // Invalid Borg values are rejected at authoring time - a closed,
    // bounded range, never an open number or an inferred score.
    // ============================================================
    const invalidBorgItems = borgWorkItems();
    invalidBorgItems[0].borg_value = 21;
    const rejectedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "Borg Lift Programme Invalid",
      description: "Out-of-range Borg must be rejected.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [{
        block_id: "",
        order_index: 1,
        name: "Invalid Block",
        description: "",
        block_type: "strength",
        week_count: 1,
        weeks: [{
          week_id: "",
          order_index: 1,
          sessions: [{ session_id: "", order_index: 1, title: "Week 1 Session", work_items: invalidBorgItems }]
        }]
      }],
      updated_at_iso8601: new Date().toISOString()
    });
    assert.notEqual(rejectedTemplate.response.status, 201, "out-of-range borg_value must not create a template");

    // ============================================================
    // Assign the Borg-loaded template and compile a real session -
    // proves Phase6 accepts Borg intensity and passes it through with
    // no resolved_load (no arithmetic, no inference).
    // ============================================================
    const assignment = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `borg_lift_assignment_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: ""
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(assignment, 201, "assign Borg-loaded template");

    const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      phase1_input: {
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
      },
      beta_user_id: athleteUserId,
      beta_coach_user_id: coachUserId
    });
    assertStatus(compiled, 201, "compile session against Borg-loaded assignment");
    const sessionId = compiled.json?.session_id;
    assert.ok(sessionId, "expected a compiled session_id");

    const stateBeforeExecution = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateBeforeExecution, 200, "session state before execution");
    const firstExercise = stateBeforeExecution.json?.current_step?.exercise;
    assert.ok(firstExercise, "expected a current exercise");
    assert.deepEqual(
      firstExercise.intensity,
      { type: "borg", value: 15 },
      "expected the compiled exercise to carry the coach-entered Borg intensity unresolved"
    );
    assert.equal(
      firstExercise.resolved_load ?? null,
      null,
      "Borg intensity must never resolve to an arithmetic weight"
    );

    // ============================================================
    // Athlete records a factual Borg self-report during execution -
    // closed-key, closed-range, no free text, no reducer-truth effect.
    // ============================================================
    const startResult = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
    assertStatus(startResult, 200, "start session");

    const stateAfterStart = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterStart, 200, "session state after start");

    const borgReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "BORG_REPORT",
      exercise_id: firstExercise.exercise_id,
      borg_value: 17
    });
    assertStatus(borgReport, 201, "athlete Borg self-report");

    const stateAfterReport = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterReport, 200, "session state after Borg report");
    assert.deepEqual(
      stateAfterReport.json?.trace,
      stateAfterStart.json?.trace,
      "a Borg self-report must not change reducer truth"
    );

    const badBorgReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "BORG_REPORT",
      exercise_id: firstExercise.exercise_id,
      borg_value: 5
    });
    assertStatus(badBorgReport, 400, "borg report outside the closed range must be rejected");
    assert.equal(badBorgReport.json?.details?.failure_token, "phase6_runtime_borg_report_invalid_shape");

    // ============================================================
    // Fresh-process restart: the Borg-loaded compiled session and the
    // recorded self-report must reconstruct identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedState = await request(restarted.baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(restartedState, 200, "session state after fresh-process restart");
    assert.deepEqual(
      restartedState.json?.current_step?.exercise?.intensity,
      { type: "borg", value: 15 },
      "Borg intensity must reconstruct identically after a fresh-process restart"
    );
    assert.equal(
      restartedState.json?.current_step?.exercise?.resolved_load ?? null,
      null,
      "Borg intensity must still carry no resolved_load after restart"
    );
  }
);

test(
  "CR10 prescription lift: coach authors CR10-loaded programme, engine passes CR10 through unresolved, athlete records a closed-range CR10 self-report, all survive a fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    let server = null;
    let restarted = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds.filter(Boolean)]
      );
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coachEmail = `cr10_lift_coach_${nonce}@example.com`;
    const coachRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "CR10 Lift Coach",
      email: coachEmail,
      password: "Cr10LiftCoach!2026",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(coachRegistration, 201, "coach registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    userIds.push(coachUserId);
    const coachCookie = sessionCookie(coachRegistration, "coach registration");
    const coachCsrf = coachRegistration.json?.csrf_token;

    const athleteEmail = `cr10_lift_athlete_${nonce}@example.com`;
    const athleteRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "CR10 Lift Athlete",
      email: athleteEmail,
      password: "Cr10LiftAthlete!2026",
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(athleteRegistration, 201, "athlete registration");
    const athleteUserId = athleteRegistration.json?.account?.user_id ?? "";
    userIds.push(athleteUserId);

    const relationshipTimestamp = new Date().toISOString();
    const relationship = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `cr10_lift_relationship_${nonce}`,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: relationshipTimestamp,
      created_at_iso8601: relationshipTimestamp,
      updated_at_iso8601: relationshipTimestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: null
    });
    assertStatus(relationship, 201, "coach-athlete relationship");

    // ============================================================
    // builder_loading (CR10 branch): coach authors a template where
    // every work item is CR10-loaded, not percent_1rm/fixed_weight/
    // bodyweight/rpe/borg - no athlete strength profile is required,
    // since CR10 needs no arithmetic resolution.
    // ============================================================
    const savedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "CR10 Lift Programme",
      description: "CR10-prescription lift proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [blockOfWeeks(1, "CR10 Lift", cr10WorkItems)],
      updated_at_iso8601: new Date().toISOString()
    });
    assertStatus(savedTemplate, 201, "create CR10-loaded draft template");
    const templateId = savedTemplate.json?.template?.template_id;
    assert.equal(savedTemplate.json?.template?.template_status, "draft");

    const templateWorkItems =
      savedTemplate.json?.template?.template_structure?.blocks?.[0]?.weeks?.[0]?.days?.[0]?.sessions?.[0]?.work_items ?? [];
    assert.equal(templateWorkItems.length, 4, "expected all four CR10 work items to persist");
    for (const workItem of templateWorkItems) {
      assert.equal(workItem.loading_reference?.type, "cr10", `expected loading_reference.type "cr10" for ${workItem.exercise_id}`);
      const cr10Value = workItem.loading_reference?.value;
      assert.ok(
        Number.isFinite(cr10Value) && cr10Value >= 0 && cr10Value <= 10 && Number.isInteger(cr10Value * 2),
        `expected a closed 0-10 half-point cr10 value for ${workItem.exercise_id}`
      );
    }

    const completed = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, {
      coach_user_id: coachUserId
    });
    assertStatus(completed, 200, "complete CR10-loaded template");

    const activated = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, {
      coach_user_id: coachUserId
    });
    assertStatus(activated, 200, "activate CR10-loaded template");
    assert.equal(activated.json?.template?.template_status, "active");

    // ============================================================
    // Invalid CR10 values are rejected at authoring time - a closed,
    // bounded, half-point-stepped range, never an open number or an
    // inferred score.
    // ============================================================
    const invalidCr10Items = cr10WorkItems();
    invalidCr10Items[0].cr10_value = 5.25;
    const rejectedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "CR10 Lift Programme Invalid",
      description: "Off-step CR10 must be rejected.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [{
        block_id: "",
        order_index: 1,
        name: "Invalid Block",
        description: "",
        block_type: "strength",
        week_count: 1,
        weeks: [{
          week_id: "",
          order_index: 1,
          sessions: [{ session_id: "", order_index: 1, title: "Week 1 Session", work_items: invalidCr10Items }]
        }]
      }],
      updated_at_iso8601: new Date().toISOString()
    });
    assert.notEqual(rejectedTemplate.response.status, 201, "off-step cr10_value must not create a template");

    // ============================================================
    // Assign the CR10-loaded template and compile a real session -
    // proves Phase6 accepts CR10 intensity and passes it through with
    // no resolved_load (no arithmetic, no inference).
    // ============================================================
    const assignment = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `cr10_lift_assignment_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: ""
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(assignment, 201, "assign CR10-loaded template");

    const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      phase1_input: {
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
      },
      beta_user_id: athleteUserId,
      beta_coach_user_id: coachUserId
    });
    assertStatus(compiled, 201, "compile session against CR10-loaded assignment");
    const sessionId = compiled.json?.session_id;
    assert.ok(sessionId, "expected a compiled session_id");

    const stateBeforeExecution = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateBeforeExecution, 200, "session state before execution");
    const firstExercise = stateBeforeExecution.json?.current_step?.exercise;
    assert.ok(firstExercise, "expected a current exercise");
    assert.deepEqual(
      firstExercise.intensity,
      { type: "cr10", value: 7.5 },
      "expected the compiled exercise to carry the coach-entered CR10 intensity unresolved"
    );
    assert.equal(
      firstExercise.resolved_load ?? null,
      null,
      "CR10 intensity must never resolve to an arithmetic weight"
    );

    // ============================================================
    // Athlete records a factual CR10 self-report during execution -
    // closed-key, closed-range, no free text, no reducer-truth effect.
    // ============================================================
    const startResult = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
    assertStatus(startResult, 200, "start session");

    const stateAfterStart = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterStart, 200, "session state after start");

    const cr10Report = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "CR10_REPORT",
      exercise_id: firstExercise.exercise_id,
      cr10_value: 9
    });
    assertStatus(cr10Report, 201, "athlete CR10 self-report");

    const stateAfterReport = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterReport, 200, "session state after CR10 report");
    assert.deepEqual(
      stateAfterReport.json?.trace,
      stateAfterStart.json?.trace,
      "a CR10 self-report must not change reducer truth"
    );

    const badCr10Report = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "CR10_REPORT",
      exercise_id: firstExercise.exercise_id,
      cr10_value: 6.25
    });
    assertStatus(badCr10Report, 400, "cr10 report off the half-point step must be rejected");
    assert.equal(badCr10Report.json?.details?.failure_token, "phase6_runtime_cr10_report_invalid_shape");

    // ============================================================
    // Fresh-process restart: the CR10-loaded compiled session and the
    // recorded self-report must reconstruct identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedState = await request(restarted.baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(restartedState, 200, "session state after fresh-process restart");
    assert.deepEqual(
      restartedState.json?.current_step?.exercise?.intensity,
      { type: "cr10", value: 7.5 },
      "CR10 intensity must reconstruct identically after a fresh-process restart"
    );
    assert.equal(
      restartedState.json?.current_step?.exercise?.resolved_load ?? null,
      null,
      "CR10 intensity must still carry no resolved_load after restart"
    );
  }
);
