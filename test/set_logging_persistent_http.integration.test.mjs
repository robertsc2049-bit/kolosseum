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

// The training itself - a self-directed session also opens with a warm-up and ends with a cool-down.
const training = (exercises) => exercises.filter((e) => e.segment !== "warm_up" && e.segment !== "cool_down");


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
    // These athletes train on the generated programme: with no catalogue
    // authors, Kolosseum programmes published in this database (a dev
    // database often has some) don't ask them to choose one first.
    env: { ...environment, KOLOSSEUM_PROGRAMME_AUTHORS: "", PORT: String(port) }
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
        accepted_terms_version: "terms_v1", date_of_birth: "1990-01-15", accepted_consent_version: "consent_v1"
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
    const all = created.json.planned_session.exercises;
    assert.equal(all[0].segment, "warm_up", "a self-directed session opens with a warm-up");
    assert.equal(all.at(-1).segment, "cool_down", "and ends with a cool-down");
    assert.ok(all.filter((e) => e.segment === "warm_up").every((e) => e.intensity?.type === "bodyweight" && e.sets === 1), "warm-up drills are one unloaded set");
    const exercises = training(all);
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
  }
);

test(
  "set logging: back-off sets of the named back squat and an exercise of her own are each their own entry - logged, completed and named separately",
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
        actor_type: "athlete", display_name: "Back-off Powerlifter", email: `backoff-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", date_of_birth: "1990-01-15", accepted_consent_version: "consent_v1"
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

    // Squat day: the named back squat, back-off sets of it in the squat slot,
    // and her own Zercher squat in the next open slot.
    const { listing, selections: chosenAll } = await chooseAllExercises(server.baseUrl, cookie, csrf);
    const squatSlots = listing.days[0].items.filter((i) => i.kind === "slot");
    const backOffSlot = squatSlots.find((i) => i.movement_pattern_id === "squat") ?? squatSlots[0];
    const ownSlot = squatSlots.find((i) => i.slot_id !== backOffSlot.slot_id);
    const selections = { ...chosenAll, [backOffSlot.slot_id]: "back_squat", [ownSlot.slot_id]: "custom_zercher_squat" };
    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/exercises", {
      cookie, csrf, body: { selections, custom_exercises: [{ exercise_id: "custom_zercher_squat", display_name: "Zercher squat" }] }
    }), 200, "choose back-off sets and her own exercise");

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
    const ids = created.json.planned_session.exercises.map((e) => e.exercise_id);
    assert.ok(ids.includes("back_squat") && ids.includes("back_squat__r2") && ids.includes("custom_zercher_squat"), ids.join(","));
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/start`, { cookie, csrf, body: {} }), 200, "start");

    const log = (body) => requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { type: "SET_LOG_REPORT", client_request_id: crypto.randomUUID(), ...body } });
    assertStatus(await log({ exercise_id: "back_squat", set_index: 1, reps: 3, load_value: 160, load_unit: "kg" }), 201, "top set");
    assertStatus(await log({ exercise_id: "back_squat__r2", set_index: 1, reps: 6, load_value: 130, load_unit: "kg" }), 201, "back-off set");
    assertStatus(await log({ exercise_id: "custom_zercher_squat", set_index: 1, reps: 8, load_value: 90, load_unit: "kg" }), 201, "her own exercise");
    const state = await requestJson(server.baseUrl, "GET", `/sessions/${sid}/state`, { cookie });
    assert.deepEqual(state.json.set_logs.back_squat.map((x) => [x.reps, x.load_value]), [[3, 160]], "the top set stays on the back squat");
    assert.deepEqual(state.json.set_logs.back_squat__r2.map((x) => [x.reps, x.load_value]), [[6, 130]], "the back-off set is its own entry");
    assert.deepEqual(state.json.set_logs.custom_zercher_squat.map((x) => [x.reps, x.load_value]), [[8, 90]]);

    // Completing each step completes exactly one entry, in order.
    for (let i = 0; i < ids.length; i++) {
      assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { type: "COMPLETE_STEP", client_request_id: crypto.randomUUID() } }), 201, `complete step ${i + 1}`);
      const now = await requestJson(server.baseUrl, "GET", `/sessions/${sid}/state`, { cookie });
      const done = (now.json.trace?.completed_ids ?? now.json.completed_ids ?? []);
      assert.deepEqual([...done].sort(), ids.slice(0, i + 1).sort(), `after step ${i + 1}`);
    }

    const history = await requestJson(server.baseUrl, "POST", "/sessions/beta-athlete-history-detail", { cookie, csrf, body: { athlete_user_id: userId, session_id: sid } });
    assertStatus(history, 200, "history detail");
    const rows = history.json.session?.exercises ?? history.json.exercises ?? history.json.detail?.exercises ?? [];
    const row = (id) => rows.find((x) => x.exercise_id === id);
    assert.equal(row("back_squat__r2")?.planned?.display_name, "Back squat (2)", "history names the back-off entry");
    assert.equal(row("custom_zercher_squat")?.planned?.display_name, "Zercher squat", "history names her own exercise");

    // Her back-off sets count towards her back squat estimated max.
    const insights = await requestJson(server.baseUrl, "GET", "/progress-insights/", { cookie });
    assertStatus(insights, 200, "progress insights");
    const trends = insights.json.insights.training_e1rm_trends;
    assert.equal(trends.some((x) => x.exercise_id === "back_squat__r2"), false, "no separate back-off trend");
    assert.equal(trends.find((x) => x.exercise_id === "back_squat").current_e1rm, 160 * 1.1, "Epley on the best set of the day (3 x 160 beats 6 x 130)");
  }
);

test(
  "maxes: a self-directed powerlifter's % of 1RM work becomes a real weight - from her entered max, else her logged-set estimate, else an RPE target",
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
        actor_type: "athlete", display_name: "Maxes Powerlifter", email: `maxes-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register powerlifter");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register powerlifter");
    const csrf = registration.json?.csrf_token;
    // One day a week: every session is the same full-power day.
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const compile = () => requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    const byId = (session, id) => session.json.planned_session.exercises.find((e) => e.exercise_id === id);

    // The lifts she needs maxes for are her programme's % of 1RM lifts.
    const listed = await requestJson(server.baseUrl, "GET", "/account/onboarding/maxes", { cookie });
    assertStatus(listed, 200, "maxes");
    const lifts = listed.json.lifts.map((l) => l.exercise_id);
    for (const lift of ["back_squat", "paused_bench_press", "deadlift"]) assert.ok(lifts.includes(lift), `${lift} is listed`);
    assert.ok(listed.json.lifts.every((l) => l.entered === null && l.in_programme));

    // No max yet: an RPE target, never a bare percentage.
    const first = await compile();
    assertStatus(first, 201, "first session");
    const squat = byId(first, "back_squat");
    assert.equal(squat.intensity.type, "percent_1rm");
    assert.equal(squat.display_name, "Back squat", "every exercise is named for the session, not just own exercises");
    assert.ok(!squat.resolved_load, "no weight without a max");
    assert.equal(squat.load_guidance.type, "rpe");
    assert.ok(squat.load_guidance.value >= 5 && squat.load_guidance.value <= 9, JSON.stringify(squat.load_guidance)); // RPE 5 for light work

    // She logs her deadlift: 3 x 180 kg.
    const sid = first.json.session_id;
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/start`, { cookie, csrf, body: {} }), 200, "start");
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, {
      cookie, csrf, body: { type: "SET_LOG_REPORT", client_request_id: crypto.randomUUID(), exercise_id: "deadlift", set_index: 1, reps: 3, load_value: 180, load_unit: "kg" }
    }), 201, "log deadlift");

    for (const [maxes, label] of [
      [[{ exercise_id: "made_up_lift", value: 100, unit: "kg" }], "an unknown lift"],
      [[{ exercise_id: "back_squat", value: 0, unit: "kg" }], "a zero max"],
      [[{ exercise_id: "back_squat", value: 150, unit: "stone" }], "an unknown unit"],
      [[{ exercise_id: "back_squat", value: 150, unit: "kg", effective_date: "2999-01-01" }], "a future date"]
    ]) {
      assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/maxes", { cookie, csrf, body: { preferred_weight_unit: "kg", maxes } }), 422, `refuse ${label}`);
    }
    const saved = await requestJson(server.baseUrl, "PUT", "/account/onboarding/maxes", {
      cookie, csrf, body: { preferred_weight_unit: "kg", maxes: [{ exercise_id: "back_squat", value: 150, unit: "kg", basis: "tested_1rm" }] }
    });
    assertStatus(saved, 200, "save her tested squat max");
    const squatRow = saved.json.lifts.find((l) => l.exercise_id === "back_squat");
    assert.equal(squatRow.entered.value, 150);
    const deadliftRow = saved.json.lifts.find((l) => l.exercise_id === "deadlift");
    assert.equal(deadliftRow.entered, null);
    assert.equal(deadliftRow.from_training.value, 198, "Epley 180 x (1 + 3/30)");

    const next = await compile();
    assertStatus(next, 201, "next session");
    const nextSquat = byId(next, "back_squat");
    const expectedSquat = Math.round((150 * nextSquat.intensity.value) / 100 / 2.5) * 2.5;
    assert.equal(nextSquat.resolved_load.value, expectedSquat, "her tested max, rounded to 2.5 kg");
    assert.equal(nextSquat.resolved_load.unit, "kg");
    assert.equal(nextSquat.resolved_load.source.source_type, "tested_1rm");
    const nextDeadlift = byId(next, "deadlift");
    assert.equal(nextDeadlift.resolved_load.source.source_type, "estimated_1rm", "her logged-set estimate");
    assert.equal(nextDeadlift.resolved_load.value, Math.round((198 * nextDeadlift.intensity.value) / 100 / 2.5) * 2.5);
    const nextBench = byId(next, "paused_bench_press");
    assert.ok(!nextBench.resolved_load);
    assert.equal(nextBench.load_guidance.type, "rpe", "still no bench max: an RPE target");

    // A rep-out above her max: 140 kg x 8 (Epley 177.3) - the next session
    // trains from the raised max, never from the old 150.
    const nid = next.json.session_id;
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${nid}/start`, { cookie, csrf, body: {} }), 200, "start next");
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${nid}/events`, {
      cookie, csrf, body: { type: "SET_LOG_REPORT", client_request_id: crypto.randomUUID(), exercise_id: "back_squat", set_index: 1, reps: 8, load_value: 140, load_unit: "kg" }
    }), 201, "log a squat rep-out");
    const after = await compile();
    assertStatus(after, 201, "session after the rep-out");
    const raisedSquat = byId(after, "back_squat");
    assert.equal(raisedSquat.resolved_load.source.source_type, "estimated_1rm", "raised from logged training");
    assert.ok(raisedSquat.resolved_load.value > Math.round((150 * raisedSquat.intensity.value) / 100 / 2.5) * 2.5, JSON.stringify(raisedSquat.resolved_load));
  }
);

test(
  "autoregulation: a powerlifter who missed squat reps and rated her deadlift RPE 10 has both held back next session, with the reason shown, and her clean bench unchanged",
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
        actor_type: "athlete", display_name: "Autoregulated Powerlifter", email: `autoreg-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register powerlifter");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register powerlifter");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const compile = () => requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    const byId = (session, id) => session.json.planned_session.exercises.find((e) => e.exercise_id === id);

    const first = await compile();
    assertStatus(first, 201, "first session");
    const sid = first.json.session_id;
    const squat = byId(first, "back_squat");
    const deadlift = byId(first, "deadlift");
    const bench = byId(first, "paused_bench_press");
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/start`, { cookie, csrf, body: {} }), 200, "start");
    const event = (body) => requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { client_request_id: crypto.randomUUID(), ...body } });
    // Squat: 5, 5, 4, 3, then a failed set - 3 of 5 short.
    for (const [i, reps] of [5, 5, 4, 3, 0].entries()) {
      assertStatus(await event({ type: "SET_LOG_REPORT", exercise_id: "back_squat", set_index: i + 1, reps: Math.min(reps, squat.reps), load_value: 120, load_unit: "kg" }), 201, `squat set ${i + 1}`);
    }
    // Bench: every rep made.
    for (let i = 1; i <= bench.sets; i++) {
      assertStatus(await event({ type: "SET_LOG_REPORT", exercise_id: "paused_bench_press", set_index: i, reps: bench.reps, load_value: 80, load_unit: "kg" }), 201, `bench set ${i}`);
    }
    // Deadlift: every rep made, but RPE 10.
    for (let i = 1; i <= deadlift.sets; i++) {
      assertStatus(await event({ type: "SET_LOG_REPORT", exercise_id: "deadlift", set_index: i, reps: deadlift.reps, load_value: 160, load_unit: "kg" }), 201, `deadlift set ${i}`);
    }
    const rpe = await event({ type: "RPE_REPORT", exercise_id: "deadlift", rpe_value: 10 });
    assertStatus(rpe, 201, "deadlift RPE 10");

    const next = await compile();
    assertStatus(next, 201, "next session");
    const nextSquat = byId(next, "back_squat");
    assert.equal(nextSquat.intensity.value, squat.intensity.value - 5, "squat 5% lighter");
    assert.equal(nextSquat.autoregulation.reason, "missed_reps");
    assert.equal(nextSquat.autoregulation.detail, `3 of 5 sets short of ${squat.reps} reps last time`);
    assert.deepEqual(nextSquat.autoregulation.planned_intensity, squat.intensity);
    const nextDeadlift = byId(next, "deadlift");
    assert.equal(nextDeadlift.intensity.value, deadlift.intensity.value - 5, "deadlift 5% lighter");
    assert.equal(nextDeadlift.autoregulation.reason, "too_hard");
    const nextBench = byId(next, "paused_bench_press");
    assert.deepEqual(nextBench.intensity, bench.intensity, "the clean bench is unchanged");
    assert.equal(nextBench.autoregulation, undefined);
  }
);

test(
  "match week: a lifter competing tomorrow gets a primer with no squats or deadlifts; the fixture is saved and validated",
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
        actor_type: "athlete", display_name: "Match Week Lifter", email: `matchweek-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const compile = () => requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });

    const empty = await requestJson(server.baseUrl, "GET", "/account/onboarding/match-week", { cookie });
    assertStatus(empty, 200, "match week");
    assert.deepEqual(empty.json, { match_days: [], fixtures: [] });
    const normal = await compile();
    assertStatus(normal, 201, "normal session");
    const normalIds = training(normal.json.planned_session.exercises).map((e) => e.exercise_id);
    assert.ok(normalIds.includes("back_squat") && normalIds.includes("deadlift"));

    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/match-week", { cookie, csrf, body: { match_days: ["someday"], fixtures: [] } }), 422, "refuse an unknown day");
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const saved = await requestJson(server.baseUrl, "PUT", "/account/onboarding/match-week", {
      cookie, csrf, body: { match_days: [], fixtures: [{ date: tomorrow, label: "Club meet" }] }
    });
    assertStatus(saved, 200, "save the meet");
    assert.deepEqual(saved.json.fixtures, [{ date: tomorrow, label: "Club meet" }]);

    const eve = await compile();
    assertStatus(eve, 201, "session the day before");
    const eveIds = eve.json.planned_session.exercises.map((e) => e.exercise_id);
    for (const legs of ["back_squat", "deadlift"]) assert.ok(!eveIds.includes(legs), `no ${legs} the day before`);
    const bench = eve.json.planned_session.exercises.find((e) => e.exercise_id === "paused_bench_press");
    const normalBench = normal.json.planned_session.exercises.find((e) => e.exercise_id === "paused_bench_press");
    assert.equal(bench.sets, normalBench.sets - 1, "bench a set shorter");
    assert.deepEqual(bench.match_week, { role: "day_before", match_date: tomorrow, label: "Club meet" });
  }
);

test(
  "a powerlifter whose meet is tomorrow - declared in their training plan, never added as a fixture - gets no squat or deadlift today",
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
        actor_type: "athlete", display_name: "Meet Tomorrow Lifter", email: `meet-tomorrow-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register");
    const csrf = registration.json?.csrf_token;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, competition_date: tomorrow, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const fixtures = await requestJson(server.baseUrl, "GET", "/account/onboarding/match-week", { cookie });
    assert.deepEqual(fixtures.json, { match_days: [], fixtures: [] }, "the meet is only in the training plan");
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const eve = await requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    assertStatus(eve, 201, "session the day before the meet");
    const ids = eve.json.planned_session.exercises.map((e) => e.exercise_id);
    for (const legs of ["back_squat", "deadlift"]) assert.ok(!ids.includes(legs), `no ${legs} the day before the meet`);
    const marked = eve.json.planned_session.exercises.find((e) => e.match_week);
    assert.deepEqual(marked?.match_week, { role: "day_before", match_date: tomorrow, label: "Competition" });
  }
);

test(
  "equipment: a strongman training at home with no yoke or log gets flagged substitutes for them, and keeps the deadlift and farmer's carry",
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
        actor_type: "athlete", display_name: "Home Strongman", email: `home-strongman-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "strongman", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "strongman", experience_level: "amateur",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");

    const before = await requestJson(server.baseUrl, "GET", "/account/onboarding/equipment", { cookie });
    assertStatus(before, 200, "equipment");
    assert.equal(before.json.full_gym, true, "a full gym until she says");
    assert.ok(before.json.options.some((o) => o.equipment_id === "yoke"));
    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/equipment", { cookie, csrf, body: { available_equipment: ["hovercraft"] } }), 422, "refuse unknown equipment");
    const home = ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band"];
    const saved = await requestJson(server.baseUrl, "PUT", "/account/onboarding/equipment", { cookie, csrf, body: { available_equipment: home } });
    assertStatus(saved, 200, "save home gym");
    assert.equal(saved.json.full_gym, false);

    // Her exercise options only offer what she can do at home.
    const { listing } = await chooseAllExercises(server.baseUrl, cookie, csrf);
    const offered = listing.days.flatMap((d) => d.items.filter((i) => i.kind === "slot").flatMap((i) => i.options.map((o) => o.exercise_id)));
    assert.ok(!offered.some((id) => ["yoke_walk", "atlas_stone_carry", "sled_push", "tire_flip"].includes(id)), offered.join(","));

    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const created = await requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    assertStatus(created, 201, "session");
    const exercises = created.json.planned_session.exercises;
    const ids = exercises.map((e) => e.exercise_id);
    assert.ok(!ids.includes("yoke_walk") && !ids.includes("strongman_log_press"), ids.join(","));
    const logSwap = exercises.find((e) => e.equipment_swap?.from_exercise_id === "strongman_log_press");
    // Any overhead press she can do at home stands in for the log.
    assert.ok(["overhead_press", "dumbbell_overhead_press", "paused_overhead_press", "single_arm_overhead_press"].includes(logSwap.exercise_id), logSwap.exercise_id);
    assert.deepEqual(logSwap.equipment_swap.missing, ["Strongman log"]);
    const yokeSwap = exercises.find((e) => e.equipment_swap?.from_exercise_id === "yoke_walk");
    assert.ok(yokeSwap && /carry/u.test(yokeSwap.exercise_id), JSON.stringify(yokeSwap));
    assert.ok(ids.includes("deadlift") && ids.includes("farmers_carry"), "what she can do stays");
    assert.ok(!exercises.find((e) => e.exercise_id === "deadlift").equipment_swap);
  }
);

test(
  "readiness: after a bad night a powerlifter's session is a set shorter and a notch lighter, with her check-in shown",
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
        actor_type: "athlete", display_name: "Tired Powerlifter", email: `tired-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    await chooseAllExercises(server.baseUrl, cookie, csrf);
    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const compile = () => requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });

    const planned = await compile();
    assertStatus(planned, 201, "session with no check-in");
    const plannedSquat = planned.json.planned_session.exercises.find((e) => e.exercise_id === "back_squat");
    assert.equal(plannedSquat.readiness, undefined);

    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/readiness", { cookie, csrf, body: { sleep: 6, soreness: 3, stress: 3 } }), 422, "refuse an out-of-range answer");
    const saved = await requestJson(server.baseUrl, "PUT", "/account/onboarding/readiness", { cookie, csrf, body: { sleep: 1, soreness: 3, stress: 3 } });
    assertStatus(saved, 200, "save a bad night");
    assert.equal(saved.json.low, true);

    const lighter = await compile();
    assertStatus(lighter, 201, "session after the check-in");
    const squat = lighter.json.planned_session.exercises.find((e) => e.exercise_id === "back_squat");
    assert.equal(squat.sets, plannedSquat.sets - 1);
    assert.equal(squat.intensity.value, plannedSquat.intensity.value - 5);
    assert.deepEqual(squat.readiness, { sleep: 1, soreness: 3, stress: 3, low: true });
  }
);

test(
  "positions: a loosehead prop trains the forwards' programme, and moving to the wing switches him to the backs' programme (sprints first) once he re-chooses",
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
        actor_type: "athlete", display_name: "Loosehead Prop", email: `prop-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "rugby_union", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register prop");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register prop");
    const csrf = registration.json?.csrf_token;
    const fields = {
      activity_id: "rugby_union", experience_level: "amateur", position: "loosehead_prop",
      training_days_per_week: 3, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    const bootstrap = async () => (await requestJson(server.baseUrl, "GET", "/account/detail", { cookie })).json.bootstrap;
    const compile = async () => {
      const b = await bootstrap();
      return requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
        cookie, csrf,
        body: {
          phase1_input: b.declaration_record.engine_phase1_input,
          beta_path_context: { auth_record: b.auth_record, acknowledgement_record: b.acknowledgement_record, declaration_record: b.declaration_record }
        }
      });
    };
    const position = (value) => requestJson(server.baseUrl, "PATCH", "/account/onboarding/preferences", {
      cookie, csrf, body: { accessibility_preferences: fields.accessibility_preferences, instruction_density: "standard", position: value }
    });
    const slotIds = (listing) => listing.days[0].items.map((i) => i.slot_id ?? i.exercise_id);

    assert.equal((await bootstrap()).declaration_record.engine_phase1_input.sport_role_id, "rugby_union__forwards");
    const { listing: forwards } = await chooseAllExercises(server.baseUrl, cookie, csrf);
    assert.ok(slotIds(forwards).includes("a.conditioning_sled_1"), "the forwards drive a sled");
    assert.ok(!slotIds(forwards).includes("a.sprint_acceleration_1"));
    const first = await compile();
    assertStatus(first, 201, "forwards session");

    // Another forward position keeps the same programme.
    assertStatus(await position("tighthead_prop"), 200, "tighthead");
    assert.equal((await bootstrap()).declaration_record.engine_phase1_input.sport_role_id, "rugby_union__forwards");

    // Moving to the wing: the backs' programme - he chooses for its new slots first.
    assertStatus(await position("wing"), 200, "wing");
    assert.equal((await bootstrap()).declaration_record.engine_phase1_input.sport_role_id, "rugby_union__backs");
    const unchosen = await compile();
    assertStatus(unchosen, 400, "new slots need choosing");
    assert.equal(unchosen.json?.details?.failure_token, "exercise_selection_required");
    const { listing: backs, selections: backsChoices } = await chooseAllExercises(server.baseUrl, cookie, csrf, (options) => options.includes("ten_metre_acceleration") ? "ten_metre_acceleration" : options[0]);
    assert.equal(slotIds(backs)[0], "a.sprint_acceleration_1", "backs sprint first, fresh");
    const next = await compile();
    assertStatus(next, 201, "backs session");
    assert.equal(backsChoices["a.sprint_acceleration_1"], "ten_metre_acceleration", "his sprint day opens with accelerations");

    // Back to the pack.
    assertStatus(await position("number8"), 200, "number 8");
    assert.equal((await bootstrap()).declaration_record.engine_phase1_input.sport_role_id, "rugby_union__forwards");
  }
);

test(
  "head-injury return: a winger cleared after a concussion gets a lighter first week back with no sprints, jumps or neck loading",
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
        actor_type: "athlete", display_name: "Concussed Wing", email: `wing-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "rugby_union", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
      }
    });
    assertStatus(registration, 201, "register wing");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register wing");
    const csrf = registration.json?.csrf_token;
    // One day a week: every session is the backs' full-body session (sprint first).
    const fields = {
      activity_id: "rugby_union", experience_level: "amateur", position: "wing",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    const { listing } = await chooseAllExercises(server.baseUrl, cookie, csrf);
    // The programme's own exercise is offered first and marked.
    const firstSlot = listing.days[0].items.find((i) => i.kind === "slot");
    assert.equal(firstSlot.options[0].programme_pick, true);
    assert.equal(firstSlot.options.filter((o) => o.programme_pick).length, 1);

    const compile = async () => {
      const b = (await requestJson(server.baseUrl, "GET", "/account/detail", { cookie })).json.bootstrap;
      return requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
        cookie, csrf,
        body: { phase1_input: b.declaration_record.engine_phase1_input, beta_path_context: { auth_record: b.auth_record, acknowledgement_record: b.acknowledgement_record, declaration_record: b.declaration_record } }
      });
    };
    const before = await compile();
    assertStatus(before, 201, "normal session");
    const normalIds = training(before.json.planned_session.exercises).map((e) => e.exercise_id);
    assert.ok(normalIds.includes("ten_metre_acceleration"), normalIds.join(","));

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/stand-down", { cookie, csrf, body: { reason: "head_injury", until_date: tomorrow } }), 200, "stand-down");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/stand-down/end", { cookie, csrf, body: { cleared_by_medical_professional: true } }), 200, "cleared");

    const back = await compile();
    assertStatus(back, 201, "first session back");
    const ids = training(back.json.planned_session.exercises).map((e) => e.exercise_id);
    for (const id of ["ten_metre_acceleration", "self_resisted_neck_isometric"]) assert.ok(!ids.includes(id), `${id} held back: ${ids.join(",")}`);
    assert.ok(ids.includes("trap_bar_deadlift"), "his strength work stays");
    assert.deepEqual(back.json.planned_session.head_injury_return.held_back_exercise_ids.sort(), normalIds.filter((id) => !ids.includes(id)).sort());
    const cycle = back.json.planned_session.training_cycle;
    assert.equal(cycle.reentry.after_head_injury, true);
    assert.equal(cycle.reentry.reentry_week, true);
    assert.equal(cycle.meso_week, 4, "a lighter re-entry week");
  }
);

test(
  "weight class: a boxer two weeks out from a fight keeps his heavy lifts, and his higher-rep work is cut to 3 x 6 with the reason shown",
  { timeout: 180000 },
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "requires DATABASE_URL");
    const environment = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
    delete environment.SMOKE_NO_DB;

    const nonce = crypto.randomUUID().replaceAll("-", "");
    const userIds = [];
    const server = await startServer(root, environment);
    testContext.after(async () => {
      await stopServer(server);
      for (const id of userIds) await cleanup(databaseUrl, id);
    });
    const register = async (activity, name) => {
      const r = await requestJson(server.baseUrl, "POST", "/account/register", {
        body: {
          actor_type: "athlete", display_name: name, email: `${activity}-${nonce}@example.test`,
          password: "Onboarding-proof-2026", activity_id: activity, accepted_terms: true, accepted_consent: true,
          accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
        }
      });
      assertStatus(r, 201, `register ${activity}`);
      userIds.push(r.json.account.user_id);
      return { cookie: sessionCookie(r, name), csrf: r.json.csrf_token };
    };
    const onboard = async ({ cookie, csrf }, extra) => {
      const fields = {
        experience_level: "amateur", training_days_per_week: 1, execution_scope: "individual", product_acknowledged: true,
        jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
        accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
        instruction_density: "standard", ...extra
      };
      assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
      assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
      await chooseAllExercises(server.baseUrl, cookie, csrf);
    };

    // A powerlifter has no weight class here.
    const lifter = await register("powerlifting", "Lifter");
    await onboard(lifter, { activity_id: "powerlifting", competition_event: "full_power", no_fixed_date: true });
    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/weight-class", { ...lifter, body: { competes_at_weight_class: true } }), 422, "combat sports only");

    const fightDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const boxer = await register("boxing", "Boxer");
    await onboard(boxer, { activity_id: "boxing", competition_date: fightDate });
    const compile = async () => {
      const b = (await requestJson(server.baseUrl, "GET", "/account/detail", { cookie: boxer.cookie })).json.bootstrap;
      return requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
        ...boxer,
        body: { phase1_input: b.declaration_record.engine_phase1_input, beta_path_context: { auth_record: b.auth_record, acknowledgement_record: b.acknowledgement_record, declaration_record: b.declaration_record } }
      });
    };
    const before = await compile();
    assertStatus(before, 201, "session before declaring a weight class");
    assert.ok(before.json.planned_session.exercises.every((e) => !e.fight_camp), "no fight camp without a weight class");

    assertStatus(await requestJson(server.baseUrl, "PUT", "/account/onboarding/weight-class", { ...boxer, body: { competes_at_weight_class: true, weight_class_kg: 2 } }), 422, "refuse a silly weight");
    const saved = await requestJson(server.baseUrl, "PUT", "/account/onboarding/weight-class", { ...boxer, body: { competes_at_weight_class: true, weight_class_kg: 63.5 } });
    assertStatus(saved, 200, "declare a weight class");
    assert.deepEqual(saved.json, { competes_at_weight_class: true, weight_class_kg: 63.5 });

    const camp = await compile();
    assertStatus(camp, 201, "fight-camp session");
    const exercises = camp.json.planned_session.exercises;
    const loadedHighRep = exercises.filter((e) => e.intensity?.type !== "bodyweight" && !e.duration_seconds && !e.distance_m && e.reps > 6 && !e.fight_camp);
    assert.deepEqual(loadedHighRep.map((e) => e.exercise_id), [], "no loaded work above 6 reps is left unchanged");
    const changed = exercises.filter((e) => e.fight_camp);
    assert.ok(changed.length > 0, `fight camp changed something: ${exercises.map((e) => `${e.exercise_id} ${e.sets}x${e.reps}`).join(", ")}`);
    for (const e of changed) {
      assert.ok(e.reps <= 6 && e.sets <= 3, JSON.stringify(e));
      assert.equal(e.fight_camp.fight_date, fightDate);
    }
  }
);
