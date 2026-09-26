// DEV NOTE: Set logging persistent HTTP proof - what an athlete actually lifts
// on each prescribed set (reps, load, failed and corrected sets) reaches the
// session state, history, PR flags and training e1RM. Server helpers mirror
// full_ui_03c_athlete_onboarding_persistent_http.integration.test.mjs.
// Direct database access is limited to cleanup.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
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
  if (child.exitCode !== null) return { code: child.exitCode, signal: child.signalCode ?? null };
  return await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal: signal ?? null }));
  });
}

async function waitForHealth(processRecord, baseUrl, timeoutMilliseconds = 20000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;

  while (Date.now() < deadline) {
    if (processRecord.child.exitCode !== null) {
      const exit = await waitForExit(processRecord.child);
      throw new Error([
        "Server exited before health became ready.",
        `exit_code=${String(exit.code)}`,
        `signal=${String(exit.signal)}`,
        "stdout:", processRecord.stdout || "<empty>",
        "stderr:", processRecord.stderr || "<empty>"
      ].join("\n"));
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

  throw new Error([
    "Server did not become healthy.",
    `base_url=${baseUrl}`,
    `last_error=${lastError?.message ?? String(lastError)}`,
    "stdout:", processRecord.stdout || "<empty>",
    "stderr:", processRecord.stderr || "<empty>"
  ].join("\n"));
}

async function startServer(root, environment) {
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

async function stopServer(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  if (process.platform === "win32") server.child.kill();
  else server.child.kill("SIGTERM");
  await Promise.race([waitForExit(server.child), delay(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([waitForExit(server.child), delay(2000)]);
  }
}

async function restartServer(server, root, environment) {
  await stopServer(server);
  return await startServer(root, environment);
}

async function requestJson(baseUrl, method, route, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    redirect: "manual",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; }
  catch { /* raw text is retained for assertion output */ }
  return { response, text, json };
}

function assertStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected ${expected}, received ${result.response.status}. raw=${result.text}`
  );
}

function sessionCookie(result, label) {
  const values = typeof result.response.headers.getSetCookie === "function"
    ? result.response.headers.getSetCookie()
    : [result.response.headers.get("set-cookie")].filter(Boolean);
  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

async function withClient(databaseUrl, operation) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await operation(client); }
  finally { await client.end(); }
}

// Choose the athlete's own exercise for every open slot of their week (the
// first eligible one not already in that day), as they would in the app.
async function chooseAllExercises(baseUrl, cookie, csrf, pick = (options) => options[0]) {
  const listing = await requestJson(baseUrl, "GET", "/account/onboarding/exercises", { cookie });
  assertStatus(listing, 200, "load programme exercises");
  const selections = {};
  for (const day of listing.json.days) {
    const used = new Set(day.items.filter((i) => i.kind === "fixed").map((i) => i.exercise_id));
    for (const item of day.items.filter((i) => i.kind === "slot")) {
      const options = item.options.map((o) => o.exercise_id).filter((id) => !used.has(id));
      const choice = pick(options);
      used.add(choice);
      selections[item.slot_id] = choice;
    }
  }
  const saved = await requestJson(baseUrl, "PUT", "/account/onboarding/exercises", { cookie, csrf, body: { selections } });
  assertStatus(saved, 200, "save programme exercises");
  assert.equal(saved.json.complete, true);
  return { listing: listing.json, selections };
}

async function cleanup(databaseUrl, userId) {
  if (!userId) return;
  await withClient(databaseUrl, async (client) => {
    await client.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM beta_product_records WHERE subject_user_id = $1", [userId]);
    await client.query("DELETE FROM beta_accounts WHERE user_id = $1", [userId]);
  });
}

const accessibilityA = Object.freeze({
  reduced_motion: true,
  high_contrast: false,
  larger_text: false,
  screen_reader_optimised: true
});

const accessibilityB = Object.freeze({
  reduced_motion: false,
  high_contrast: true,
  larger_text: true,
  screen_reader_optimised: true
});

test(
  "set logging: a powerlifter logs what she lifted on each prescribed set, and it reaches her history, PRs and estimated max",
  { timeout: 180000 },
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "requires DATABASE_URL");
    const environment = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
    delete environment.SMOKE_NO_DB;

    const nonce = crypto.randomUUID().replaceAll("-", "");
    let userId = "";
    const server = await startServer(root, environment);
    testContext.after(async () => {
      await stopServer(server);
      await cleanup(databaseUrl, userId);
    });

    const registration = await requestJson(server.baseUrl, "POST", "/account/register", {
      body: {
        actor_type: "athlete", display_name: "Set Logging Powerlifter", email: `set-logging-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1"
      }
    });
    assertStatus(registration, 201, "register powerlifter");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register powerlifter");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 4, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const created = await requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    assertStatus(created, 201, "create squat-day session");
    const sid = created.json.session_id;
    const exercises = created.json.planned_session.exercises;
    assert.equal(exercises[0].exercise_id, "back_squat", "squat day leads with the squat");
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/start`, { cookie, csrf, body: {} }), 200, "start");

    const log = (body) => requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { type: "SET_LOG_REPORT", client_request_id: crypto.randomUUID(), ...body } });
    const before = await requestJson(server.baseUrl, "GET", `/sessions/${sid}/state`, { cookie });
    assert.equal(before.json.set_logs, undefined, "no set logs until something is logged");

    // The first-ever loaded set is not a PR (nothing to beat); a later heavier set is.
    const first = await log({ exercise_id: "back_squat", set_index: 1, reps: 5, load_value: 140, load_unit: "kg" });
    assertStatus(first, 201, "log set 1");
    assert.equal(first.json.is_pr, false);
    assertStatus(await log({ exercise_id: "back_squat", set_index: 2, reps: 5, load_value: 140, load_unit: "kg" }), 201, "log set 2");
    assertStatus(await log({ exercise_id: "back_squat", set_index: 3, reps: 3, load_value: 140, load_unit: "kg" }), 201, "set 3: missed the last two reps");
    assertStatus(await log({ exercise_id: "back_squat", set_index: 4, reps: 0, load_value: 145, load_unit: "kg" }), 201, "set 4: failed the first rep");
    const corrected = await log({ exercise_id: "back_squat", set_index: 2, reps: 4, load_value: 142.5, load_unit: "kg" });
    assertStatus(corrected, 201, "set 2 re-logged (typo fixed)");
    assert.equal(corrected.json.is_pr, true, "142.5 kg beats her previous best of 140 kg");

    const refusals = [
      [{ exercise_id: "back_squat", set_index: 0, reps: 5 }, "phase6_runtime_set_log_report_invalid_shape", "set_index 0"],
      [{ exercise_id: "back_squat", set_index: 31, reps: 5 }, "phase6_runtime_set_log_report_invalid_shape", "set_index 31"],
      [{ exercise_id: "back_squat", set_index: 1, reps: 101 }, "phase6_runtime_set_log_report_invalid_shape", "101 reps"],
      [{ exercise_id: "back_squat", set_index: 1, reps: 2.5 }, "phase6_runtime_set_log_report_invalid_shape", "fractional reps"],
      [{ exercise_id: "back_squat", set_index: 1, reps: 5, load_value: 140 }, "phase6_runtime_set_log_report_invalid_shape", "load without unit"],
      [{ exercise_id: "back_squat", set_index: 1, reps: 5, load_value: 140, load_unit: "stone" }, "phase6_runtime_set_log_report_invalid_shape", "unknown unit"],
      [{ exercise_id: "back_squat", set_index: 1, reps: 5, rpe_value: 8 }, "phase6_runtime_set_log_report_invalid_shape", "extra key"],
      [{ exercise_id: "snatch", set_index: 1, reps: 1 }, "phase6_runtime_set_log_report_unknown_exercise", "not in this session"]
    ];
    for (const [bad, token, label] of refusals) {
      const refused = await log(bad);
      assertStatus(refused, 400, `refuse ${label}`);
      assert.equal(refused.json?.details?.failure_token, token, label);
    }

    const state = await requestJson(server.baseUrl, "GET", `/sessions/${sid}/state`, { cookie });
    assert.deepEqual(state.json.set_logs.back_squat.map((x) => [x.set_index, x.reps, x.load_value]),
      [[1, 5, 140], [2, 4, 142.5], [3, 3, 140], [4, 0, 145]], "latest entry per set, in set order");

    // Skip the second exercise; it can no longer take set logs.
    const second = exercises[1].exercise_id;
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { type: "COMPLETE_STEP", client_request_id: crypto.randomUUID() } }), 201, "complete squat");
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { type: "SKIP_EXERCISE", exercise_id: second, reason_code: "time_constraint", client_request_id: crypto.randomUUID() } }), 201, "skip second exercise");
    const onSkipped = await log({ exercise_id: second, set_index: 1, reps: 3 });
    assertStatus(onSkipped, 400, "a skipped exercise takes no set logs");
    assert.equal(onSkipped.json?.details?.failure_token, "phase6_runtime_set_log_report_unknown_exercise");

    const history = await requestJson(server.baseUrl, "POST", "/sessions/beta-athlete-history-detail", { cookie, csrf, body: { athlete_user_id: userId, session_id: sid } });
    assertStatus(history, 200, "history detail");
    const exerciseRows = history.json.session?.exercises ?? history.json.exercises ?? history.json.detail?.exercises ?? [];
    const squatHistory = exerciseRows.find((x) => x.exercise_id === "back_squat");
    assert.ok(squatHistory, `history lists the squat (keys: ${Object.keys(history.json)})`);
    assert.deepEqual(squatHistory.set_logs.map((x) => [x.set_index, x.reps, x.load_value, x.is_pr]),
      [[1, 5, 140, false], [2, 4, 142.5, true], [3, 3, 140, false], [4, 0, 145, false]]);

    const insights = await requestJson(server.baseUrl, "GET", "/progress-insights/", { cookie });
    assertStatus(insights, 200, "progress insights");
    const squatE1rm = insights.json.insights.training_e1rm_trends.find((x) => x.exercise_id === "back_squat");
    assert.equal(squatE1rm.current_e1rm, 163.3, "best set 5 x 140 kg (Epley 163.3); the failed set never counts");
    assert.equal(squatE1rm.unit, "kg");
    assert.equal(squatE1rm.includes_bodyweight, false);
  }
);
