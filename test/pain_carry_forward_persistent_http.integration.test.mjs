// DEV NOTE: Human-maintained repo surface. Pain carry-forward over real HTTP and a real database:
// a pain report opens a flag that later sessions never ignore.

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


const REGISTRY = JSON.parse(await fs.readFile(path.join(repoRoot(), "registries", "exercise", "exercise.registry.json"), "utf8")).entries;
const loadsElbow = (id) => (REGISTRY[id.replace(/__r[0-9]+$/u, "")]?.joint_stress_tags ?? []).includes("elbow");

test(
  "pain carry-forward: a powerlifter's elbow pain on the paused bench is never trained through - she checks in before the next session loading it, still sore swaps (rows to a chest-supported row) or leaves out every elbow exercise for that session only, pain-free brings them back",
  { timeout: 240000 },
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
        actor_type: "athlete", display_name: "Sore Elbow Powerlifter", email: `sore-elbow-${nonce}@example.test`,
        password: "Onboarding-proof-2026", activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
        accepted_terms_version: "terms_v1", date_of_birth: "1990-01-15", accepted_consent_version: "consent_v1"
      }
    });
    assertStatus(registration, 201, "register powerlifter");
    userId = registration.json?.account?.user_id ?? "";
    const cookie = sessionCookie(registration, "register powerlifter");
    const csrf = registration.json?.csrf_token;
    // One training day a week: every session is the same full-power day
    // (back squat, paused bench, deadlift + her bench, row and triceps
    // choices), so every session loads the elbow.
    const fields = {
      activity_id: "powerlifting", experience_level: "amateur", competition_event: "full_power",
      training_days_per_week: 1, no_fixed_date: true, execution_scope: "individual", product_acknowledged: true,
      jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
      instruction_density: "standard"
    };
    assertStatus(await requestJson(server.baseUrl, "PATCH", "/account/onboarding/draft", { cookie, csrf, body: { current_stage: "review", fields } }), 200, "draft");
    assertStatus(await requestJson(server.baseUrl, "POST", "/account/onboarding/confirm", { cookie, csrf, body: { review_confirmed: true } }), 200, "confirm");
    // Her choices: the first of each slot's options by name (band rows for her row).
    await chooseAllExercises(server.baseUrl, cookie, csrf, (options) => [...options].sort()[0]);

    const detail = await requestJson(server.baseUrl, "GET", "/account/detail", { cookie });
    const bootstrap = detail.json.bootstrap;
    const compile = () => requestJson(server.baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      cookie, csrf,
      body: {
        phase1_input: bootstrap.declaration_record.engine_phase1_input,
        beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record }
      }
    });
    const flags = async () => (await requestJson(server.baseUrl, "GET", "/account/onboarding/pain-flags", { cookie })).json.flags;
    const checkIn = (body) => requestJson(server.baseUrl, "POST", "/account/onboarding/pain-flags/check-in", { cookie, csrf, body });
    const event = (sid, body) => requestJson(server.baseUrl, "POST", `/sessions/${sid}/events`, { cookie, csrf, body: { client_request_id: crypto.randomUUID(), ...body } });

    // Session 1: her elbow hurts during the paused bench.
    const first = await compile();
    assertStatus(first, 201, "first session");
    const firstIds = first.json.planned_session.exercises.map((e) => e.exercise_id);
    assert.ok(firstIds.includes("paused_bench_press") && firstIds.includes("band_row"), firstIds.join(","));
    assert.ok(firstIds.some((id) => id !== "paused_bench_press" && loadsElbow(id)), "the session has other elbow exercises too");
    const sid = first.json.session_id;
    assertStatus(await requestJson(server.baseUrl, "POST", `/sessions/${sid}/start`, { cookie, csrf, body: {} }), 200, "start");
    const badArea = await event(sid, { type: "PAIN_REPORT", exercise_id: "paused_bench_press", pain_reported: true, pain_area: "spleen" });
    assertStatus(badArea, 400, "an unknown pain area is refused");
    assertStatus(await event(sid, { type: "PAIN_REPORT", exercise_id: "paused_bench_press", pain_reported: true, pain_area: "elbow" }), 201, "report elbow pain");

    const open = await flags();
    assert.equal(open.length, 1);
    assert.equal(open[0].flag_key, "area:elbow");
    assert.equal(open[0].where, "your elbow");
    assert.deepEqual(open[0].reported_exercises.map((e) => e.exercise_id), ["paused_bench_press"]);
    assert.equal(open[0].check_in_due, true);

    // Session 2 is refused until she checks in.
    const refused = await compile();
    assertStatus(refused, 400, "no elbow session without a check-in");
    assert.equal(refused.json.details.failure_token, "pain_check_in_required");
    const due = refused.json.details.details.flags;
    assert.equal(due[0].flag_key, "area:elbow");
    assert.ok(due[0].affected_exercise_ids.includes("paused_bench_press"));
    assert.deepEqual(due[0].affected_exercise_ids, firstIds.filter(loadsElbow), "exactly the elbow exercises are affected");

    for (const [body, label] of [
      [{ flag_key: "area:elbow", status: "still_sore" }, "still sore without a plan"],
      [{ flag_key: "area:elbow", status: "pain_free", plan: "swap" }, "pain-free with a plan"],
      [{ flag_key: "area:elbow", status: "fine" }, "an unknown status"]
    ]) {
      assertStatus(await checkIn(body), 422, `refuse ${label}`);
    }
    assertStatus(await checkIn({ flag_key: "area:shoulder", status: "pain_free" }), 404, "no check-in for a flag that isn't open");

    // Still sore, swap: no exercise in the session loads the elbow. Her row
    // becomes an elbow-free row; the bench and triceps work, with nothing
    // elbow-free to swap to, is left out. Swapped ones say what they replaced.
    const swapCheckIn = await checkIn({ flag_key: "area:elbow", status: "still_sore", plan: "swap" });
    assertStatus(swapCheckIn, 200, "still sore, swap");
    assert.equal(swapCheckIn.json.flags[0].check_in_due, false);
    const swapped = await compile();
    assertStatus(swapped, 201, "session with elbow exercises swapped");
    const swappedExercises = swapped.json.planned_session.exercises;
    assert.ok(swappedExercises.length > 0);
    assert.ok(swappedExercises.every((e) => !loadsElbow(e.exercise_id)), `nothing loads the elbow: ${swappedExercises.map((e) => e.exercise_id).join(",")}`);
    for (const e of swappedExercises.filter((x) => x.pain_swap)) {
      assert.ok(loadsElbow(e.pain_swap.from_exercise_id), `${e.exercise_id} replaced an elbow exercise`);
      assert.equal(e.pain_swap.area, "elbow");
      assert.ok(e.display_name && e.pain_swap.from_display_name);
    }
    const rowSwap = swappedExercises.find((e) => e.pain_swap?.from_exercise_id === "band_row");
    assert.ok(rowSwap && ["chest_supported_row", "t_bar_row"].includes(rowSwap.exercise_id), `the row is swapped: ${JSON.stringify(rowSwap)}`);
    assert.ok(!swappedExercises.some((e) => e.exercise_id === "paused_bench_press" || e.pain_swap?.from_exercise_id === "paused_bench_press"), "no elbow-free bench exists, so it is left out");
    assert.ok(swappedExercises.some((e) => e.exercise_id === "back_squat") && swappedExercises.some((e) => e.exercise_id === "deadlift"), "the rest of the session stays");
    const swappedState = await requestJson(server.baseUrl, "GET", `/sessions/${swapped.json.session_id}/state`, { cookie });
    assertStatus(swappedState, 200, "swapped session state");
    const stateExercises = swappedState.json.remaining_exercises ?? swappedState.json.planned_session?.exercises ?? [];
    assert.ok(stateExercises.some((e) => e.pain_swap), "the session screen gets the swap note");

    // The check-in covered that session only.
    const again = await compile();
    assertStatus(again, 400, "next elbow session needs a new check-in");
    assert.equal(again.json.details.failure_token, "pain_check_in_required");

    // Still sore, leave out: the elbow exercises are left out, nothing swapped.
    assertStatus(await checkIn({ flag_key: "area:elbow", status: "still_sore", plan: "skip" }), 200, "still sore, leave out");
    const skipped = await compile();
    assertStatus(skipped, 201, "session with elbow exercises left out");
    const skippedIds = skipped.json.planned_session.exercises.map((e) => e.exercise_id);
    assert.ok(skippedIds.length > 0 && skippedIds.every((id) => !loadsElbow(id)), skippedIds.join(","));
    assert.ok(skipped.json.planned_session.exercises.every((e) => !e.pain_swap));
    assert.deepEqual(skippedIds, firstIds.filter((id) => !loadsElbow(id)), "the rest of the session is unchanged");

    // Pain-free: the flag closes and the bench work is back.
    const better = await checkIn({ flag_key: "area:elbow", status: "pain_free" });
    assertStatus(better, 200, "pain-free");
    assert.deepEqual(better.json.flags, []);
    const normal = await compile();
    assertStatus(normal, 201, "normal session again");
    assert.deepEqual(normal.json.planned_session.exercises.map((e) => e.exercise_id), firstIds);

    // History records where it hurt.
    const history = await requestJson(server.baseUrl, "POST", "/sessions/beta-athlete-history-detail", { cookie, csrf, body: { athlete_user_id: userId, session_id: sid } });
    assertStatus(history, 200, "history detail");
    const rows = history.json.session?.exercises ?? history.json.exercises ?? history.json.detail?.exercises ?? [];
    const bench = rows.find((x) => x.exercise_id === "paused_bench_press");
    assert.equal(bench?.pain_reported, true);
    assert.equal(bench?.pain_area, "elbow");
  }
);
