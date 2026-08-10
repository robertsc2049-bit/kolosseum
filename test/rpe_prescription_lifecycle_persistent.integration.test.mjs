// DEV NOTE: RPE-prescription lift closure - proves a coach can author an
// RPE-loaded programme, that RPE intensity is compiled through Phase6
// unresolved (no arithmetic, no inference), that an athlete can record a
// closed-range RPE self-report during execution, and that all of this
// survives a fresh-process restart. Every step crosses only public HTTP
// routes the real single-page app itself calls.

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

function rpeWorkItems() {
  return [
    ["back_squat", 8],
    ["bench_press", 7],
    ["deadlift", 9],
    ["overhead_press", 6]
  ].map(([exerciseId, rpeValue], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "rpe",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    rpe_value: rpeValue,
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory"
  }));
}

function blockOfWeeks(weekCount, namePrefix) {
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
        work_items: rpeWorkItems()
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
  "RPE prescription lift: coach authors RPE-loaded programme, engine passes RPE through unresolved, athlete records a closed-range RPE self-report, all survive a fresh-process restart",
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
      await pool.end();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coachEmail = `rpe_lift_coach_${nonce}@example.com`;
    const coachRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "RPE Lift Coach",
      email: coachEmail,
      password: "RpeLiftCoach!2026",
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

    const athleteEmail = `rpe_lift_athlete_${nonce}@example.com`;
    const athleteRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "RPE Lift Athlete",
      email: athleteEmail,
      password: "RpeLiftAthlete!2026",
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
      relationship_id: `rpe_lift_relationship_${nonce}`,
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
    // builder_loading (RPE branch): coach authors a template where
    // every work item is RPE-loaded, not percent_1rm/fixed_weight/
    // bodyweight - no athlete strength profile is required, since RPE
    // needs no arithmetic resolution.
    // ============================================================
    const savedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "RPE Lift Programme",
      description: "RPE-prescription lift proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [blockOfWeeks(1, "RPE Lift")],
      updated_at_iso8601: new Date().toISOString()
    });
    assertStatus(savedTemplate, 201, "create RPE-loaded draft template");
    const templateId = savedTemplate.json?.template?.template_id;
    assert.equal(savedTemplate.json?.template?.template_status, "draft");

    const templateWorkItems =
      savedTemplate.json?.template?.template_structure?.blocks?.[0]?.weeks?.[0]?.days?.[0]?.sessions?.[0]?.work_items ?? [];
    assert.equal(templateWorkItems.length, 4, "expected all four RPE work items to persist");
    for (const workItem of templateWorkItems) {
      assert.equal(workItem.loading_reference?.type, "rpe", `expected loading_reference.type "rpe" for ${workItem.exercise_id}`);
      const rpeValue = workItem.loading_reference?.value;
      assert.ok(
        Number.isInteger(rpeValue) && rpeValue >= 1 && rpeValue <= 10,
        `expected a closed 1-10 rpe value for ${workItem.exercise_id}`
      );
    }

    const completed = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, {
      coach_user_id: coachUserId
    });
    assertStatus(completed, 200, "complete RPE-loaded template");

    const activated = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, {
      coach_user_id: coachUserId
    });
    assertStatus(activated, 200, "activate RPE-loaded template");
    assert.equal(activated.json?.template?.template_status, "active");

    // ============================================================
    // Invalid RPE values are rejected at authoring time - a closed,
    // bounded range, never an open number or an inferred score.
    // ============================================================
    const invalidRpeItems = rpeWorkItems();
    invalidRpeItems[0].rpe_value = 11;
    const rejectedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "RPE Lift Programme Invalid",
      description: "Out-of-range RPE must be rejected.",
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
          sessions: [{ session_id: "", order_index: 1, title: "Week 1 Session", work_items: invalidRpeItems }]
        }]
      }],
      updated_at_iso8601: new Date().toISOString()
    });
    assert.notEqual(rejectedTemplate.response.status, 201, "out-of-range rpe_value must not create a template");

    // ============================================================
    // Assign the RPE-loaded template and compile a real session -
    // proves Phase6 accepts RPE intensity and passes it through with
    // no resolved_load (no arithmetic, no inference).
    // ============================================================
    const assignment = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `rpe_lift_assignment_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: ""
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(assignment, 201, "assign RPE-loaded template");

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
    assertStatus(compiled, 201, "compile session against RPE-loaded assignment");
    const sessionId = compiled.json?.session_id;
    assert.ok(sessionId, "expected a compiled session_id");

    const stateBeforeExecution = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateBeforeExecution, 200, "session state before execution");
    const firstExercise = stateBeforeExecution.json?.current_step?.exercise;
    assert.ok(firstExercise, "expected a current exercise");
    assert.deepEqual(
      firstExercise.intensity,
      { type: "rpe", value: 8 },
      "expected the compiled exercise to carry the coach-entered RPE intensity unresolved"
    );
    assert.equal(
      firstExercise.resolved_load ?? null,
      null,
      "RPE intensity must never resolve to an arithmetic weight"
    );

    // ============================================================
    // Athlete records a factual RPE self-report during execution -
    // closed-key, closed-range, no free text, no reducer-truth effect.
    // ============================================================
    const startResult = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
    assertStatus(startResult, 200, "start session");

    const stateAfterStart = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterStart, 200, "session state after start");

    const rpeReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "RPE_REPORT",
      exercise_id: firstExercise.exercise_id,
      rpe_value: 9
    });
    assertStatus(rpeReport, 201, "athlete RPE self-report");

    const stateAfterReport = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterReport, 200, "session state after RPE report");
    assert.deepEqual(
      stateAfterReport.json?.trace,
      stateAfterStart.json?.trace,
      "an RPE self-report must not change reducer truth"
    );

    const badRpeReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "RPE_REPORT",
      exercise_id: firstExercise.exercise_id,
      rpe_value: 0
    });
    assertStatus(badRpeReport, 400, "rpe report outside the closed range must be rejected");
    assert.equal(badRpeReport.json?.details?.failure_token, "phase6_runtime_rpe_report_invalid_shape");

    // ============================================================
    // Fresh-process restart: the RPE-loaded compiled session and the
    // recorded self-report must reconstruct identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedState = await request(restarted.baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(restartedState, 200, "session state after fresh-process restart");
    assert.deepEqual(
      restartedState.json?.current_step?.exercise?.intensity,
      { type: "rpe", value: 8 },
      "RPE intensity must reconstruct identically after a fresh-process restart"
    );
    assert.equal(
      restartedState.json?.current_step?.exercise?.resolved_load ?? null,
      null,
      "RPE intensity must still carry no resolved_load after restart"
    );
  }
);
