// DEV NOTE: Kolosseum programmes persistent HTTP proof - a catalogue author
// lists a coach-written programme and an athlete without a coach runs it
// (src/api/programme_catalogue_service.ts). Server helpers mirror
// set_logging_persistent_http.integration.test.mjs. Direct database access is
// limited to cleanup.

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


async function cleanupCoach(databaseUrl, userId) {
  if (!userId) return;
  await withClient(databaseUrl, async (client) => {
    await client.query("DELETE FROM beta_product_records WHERE actor_user_id = $1", [userId]);
  });
  await cleanup(databaseUrl, userId);
}

async function registerAccount(baseUrl, body) {
  const result = await requestJson(baseUrl, "POST", "/account/register", {
    body: {
      password: "Programme-proof-2026", accepted_terms: true, accepted_consent: true,
      accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15", ...body
    }
  });
  assertStatus(result, 201, `register ${body.display_name}`);
  return { userId: result.json.account.user_id, cookie: sessionCookie(result, "register"), csrf: result.json.csrf_token };
}

const workItem = (order, exercise_id, sets, reps, load_mode) => ({
  work_item_id: "", order_index: order, exercise_id, planned_sets: sets, rep_mode: "fixed", planned_reps: reps, rep_min: reps, rep_max: reps,
  load_mode, percent_1rm: 70, weight_value: 20, weight_unit: "kg", rpe_value: 7, rest_seconds: 120,
  role: order === 1 ? "primary" : "accessory", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
});

test(
  "Kolosseum programmes: an author lists a beginner programme; a beginner rugby player with no exercise choices runs it session by session, with weights built from what they lift, until it's finished",
  { timeout: 240000 },
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "requires DATABASE_URL");
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const authorEmail = `programme-author-${nonce}@example.test`;
    const environment = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test", KOLOSSEUM_PROGRAMME_AUTHORS: authorEmail };
    delete environment.SMOKE_NO_DB;
    const ids = { author: "", other: "", athlete: "" };
    const server = await startServer(root, environment);
    testContext.after(async () => {
      await stopServer(server);
      await cleanup(databaseUrl, ids.athlete);
      await cleanupCoach(databaseUrl, ids.author);
      await cleanupCoach(databaseUrl, ids.other);
    });
    const base = server.baseUrl;

    // The author writes a programme in the builder and activates it.
    const author = await registerAccount(base, { actor_type: "coach", display_name: "Kolosseum Programmes", email: authorEmail });
    ids.author = author.userId;
    for (const [method, route, body] of [
      ["PATCH", "/account/coach-onboarding/profile", { display_name: "Kolosseum Programmes", email: authorEmail }],
      ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
      ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
      ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
    ]) await requestJson(base, method, route, { cookie: author.cookie, csrf: author.csrf, body });
    const session = (order, title, items) => ({ session_id: "", order_index: order, title, coaching_notes: "", work_items: items });
    const saved = await requestJson(base, "POST", "/templates", {
      cookie: author.cookie, csrf: author.csrf,
      body: {
        coach_user_id: author.userId, template_version: 1, template_name: "Beginner full-body", description: "Proof programme.", activity_id: "general_strength",
        blocks: [{ block_id: "", order_index: 1, name: "Foundation", description: "", block_type: "general", week_count: 1, weeks: [{ week_id: "", order_index: 1, sessions: [
          session(1, "Day A", [workItem(1, "back_squat", 3, 5, "percent_1rm"), workItem(2, "bench_press", 3, 5, "percent_1rm")]),
          session(2, "Day B", [workItem(1, "deadlift", 1, 5, "percent_1rm"), workItem(2, "push_up", 3, 10, "bodyweight")]),
          session(3, "Day A again", [workItem(1, "back_squat", 3, 5, "percent_1rm"), workItem(2, "bench_press", 3, 5, "percent_1rm")])
        ] }] }],
        updated_at_iso8601: new Date().toISOString()
      }
    });
    assertStatus(saved, 201, "save programme");
    const draftId = saved.json.template.template_id;
    assertStatus(await requestJson(base, "POST", `/templates/${draftId}/complete`, { cookie: author.cookie, csrf: author.csrf, body: { coach_user_id: author.userId } }), 200, "complete");
    const activated = await requestJson(base, "POST", `/templates/${draftId}/activate`, { cookie: author.cookie, csrf: author.csrf, body: { coach_user_id: author.userId } });
    assertStatus(activated, 200, "activate");
    const templateId = activated.json?.template?.template_id ?? draftId;

    // A coach who isn't a catalogue author can't list programmes.
    const other = await registerAccount(base, { actor_type: "coach", display_name: "Other Coach", email: `other-coach-${nonce}@example.test` });
    ids.other = other.userId;
    const refused = await requestJson(base, "PUT", `/templates/${templateId}/catalogue-listing`, { cookie: other.cookie, csrf: other.csrf, body: { levels: ["beginner"], activity_ids: [], days_per_week: 3 } });
    assertStatus(refused, 403, "non-author listing");

    const listed = await requestJson(base, "PUT", `/templates/${templateId}/catalogue-listing`, {
      cookie: author.cookie, csrf: author.csrf,
      body: { title: "Beginner full-body", summary: "Three full-body sessions.", levels: ["beginner"], activity_ids: [], days_per_week: 3 }
    });
    assertStatus(listed, 200, "list programme");

    // A beginner rugby player: the general programme suits them.
    const athlete = await registerAccount(base, { actor_type: "athlete", display_name: "Rugby Beginner", email: `rugby-beginner-${nonce}@example.test` });
    ids.athlete = athlete.userId;
    const fields = {
      activity_id: "rugby_union", experience_level: "beginner", training_days_per_week: 3, no_fixed_date: true, execution_scope: "individual",
      product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
      accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard"
    };
    for (const stage of ["experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"]) {
      assertStatus(await requestJson(base, "PATCH", "/account/onboarding/draft", { cookie: athlete.cookie, csrf: athlete.csrf, body: { current_stage: stage, fields } }), 200, `draft ${stage}`);
    }
    assertStatus(await requestJson(base, "POST", "/account/onboarding/confirm", { cookie: athlete.cookie, csrf: athlete.csrf, body: { review_confirmed: true } }), 200, "confirm");

    const programmes = await requestJson(base, "GET", "/account/onboarding/programmes", { cookie: athlete.cookie });
    assertStatus(programmes, 200, "programmes");
    // Kolosseum programmes are for coaches: athletes aren't offered them and
    // can't start one (they build their own week in My training).
    assert.deepEqual(programmes.json.options, [], "no programmes offered to athletes");
    const refusedStart = await requestJson(base, "PUT", "/account/onboarding/programme", { cookie: athlete.cookie, csrf: athlete.csrf, body: { listing_id: listed.json.listing.listing_id } });
    assertStatus(refusedStart, 409, "athletes can't start a Kolosseum programme");
    assert.equal(refusedStart.json.error, "athlete_programmes_for_coaches");
    // An athlete who started one before then runs it to the end.
    await withClient(databaseUrl, (client) => client.query(
      "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at) VALUES ($1, $2, 'athlete_programme_run_started', $3::jsonb, now())",
      [`account_event_run_${nonce}`, athlete.userId, JSON.stringify({
        run_id: `programme_run_${nonce}`, listing_id: listed.json.listing.listing_id, author_user_id: author.userId, template_id: templateId,
        title: "Beginner full-body", started_at: new Date().toISOString(), schema_version: "athlete_programme_run_v1"
      })]
    ));
    const started = await requestJson(base, "GET", "/account/onboarding/programmes", { cookie: athlete.cookie });
    assertStatus(started, 200, "the run in progress");
    assert.deepEqual([started.json.current.sessions_done, started.json.current.sessions_total], [0, 3]);
    assert.deepEqual(started.json.current.next_position, { week_number: 1, weeks_total: 1, block_name: "Foundation", block_type: "general" });

    async function createSession(extra = {}) {
      const detail = await requestJson(base, "GET", "/account/detail", { cookie: athlete.cookie });
      const bootstrap = detail.json.bootstrap;
      return await requestJson(base, "POST", "/blocks/compile?create_session=true&beta_path=true", {
        cookie: athlete.cookie, csrf: detail.json.csrf_token,
        body: {
          phase1_input: bootstrap.declaration_record.engine_phase1_input,
          beta_path_context: { auth_record: bootstrap.auth_record, acknowledgement_record: bootstrap.acknowledgement_record, declaration_record: bootstrap.declaration_record },
          ...extra
        }
      });
    }
    async function runSession(sets) {
      const created = await createSession();
      assertStatus(created, 201, "create session");
      const sessionId = created.json.session_id;
      const csrf = (await requestJson(base, "GET", "/account/detail", { cookie: athlete.cookie })).json.csrf_token;
      await requestJson(base, "POST", `/sessions/${sessionId}/start`, { cookie: athlete.cookie, csrf, body: {} });
      for (let guard = 0; guard < 10; guard += 1) {
        const state = await requestJson(base, "GET", `/sessions/${sessionId}/state`, { cookie: athlete.cookie });
        const current = state.json?.current_step?.exercise;
        if (!state.json?.remaining_exercises?.length || !current) break;
        for (const [index, [reps, load]] of (sets[current.exercise_id] ?? []).entries()) {
          await requestJson(base, "POST", `/sessions/${sessionId}/events`, { cookie: athlete.cookie, csrf, body: { type: "SET_LOG_REPORT", exercise_id: current.exercise_id, set_index: index + 1, reps, load_value: load, load_unit: "kg", client_request_id: crypto.randomUUID() } });
        }
        await requestJson(base, "POST", `/sessions/${sessionId}/events`, { cookie: athlete.cookie, csrf, body: { type: "COMPLETE_STEP", client_request_id: crypto.randomUUID() } });
      }
      return created.json.planned_session;
    }

    // Session 1 is the programme's Day A - no exercise choices needed - and
    // a beginner gets a technique weight to choose, not an RPE.
    const first = await runSession({ back_squat: [[5, 60], [5, 60], [5, 60]] });
    assert.deepEqual(first.exercises.map((e) => e.exercise_id), ["back_squat", "bench_press"]);
    assert.equal(first.programme_run.session_number, 1);
    assert.equal(first.programme_run.sessions_total, 3);
    assert.equal(first.programme_run.session_title, "Day A");
    assert.deepEqual([first.programme_run.week_number, first.programme_run.weeks_total, first.programme_run.block_name], [1, 1, "Foundation"]);
    assert.equal(first.training_cycle, undefined, "a programme run isn't labelled with the generated plan's phase and week");
    assert.deepEqual(first.exercises[0].load_guidance, { type: "progression", basis: "first_time", reps: 5 });

    const second = await runSession({});
    assert.deepEqual(second.exercises.map((e) => e.exercise_id), ["deadlift", "push_up"]);
    assert.deepEqual(second.exercises[1].intensity, { type: "bodyweight" });

    // Day A again: the squat builds from session 1 (every rep at 60 kg).
    const third = await runSession({});
    assert.equal(third.programme_run.session_title, "Day A again");
    assert.deepEqual(third.exercises[0].intensity, { type: "load", value: 62.5, unit: "kg" });
    assert.equal(third.exercises[0].load_guidance.basis, "progress");

    const after = await requestJson(base, "GET", "/account/onboarding/programmes", { cookie: athlete.cookie });
    assert.equal(after.json.current.sessions_done, 3);

    // The programme is finished: the next session says so.
    const done = await createSession();
    assertStatus(done, 400, "session after the programme ends");
    assert.equal(done.json.error, "programme_complete");

    // What comes next: the author lists an intermediate programme and names
    // it as the one that follows the beginner programme.
    const nextSaved = await requestJson(base, "POST", "/templates", {
      cookie: author.cookie, csrf: author.csrf,
      body: {
        coach_user_id: author.userId, template_version: 1, template_name: "Intermediate upper/lower", description: "Proof follow-on.", activity_id: "general_strength",
        blocks: [{ block_id: "", order_index: 1, name: "Wave", description: "", block_type: "strength", week_count: 1, weeks: [{ week_id: "", order_index: 1, sessions: [
          session(1, "Upper", [workItem(1, "bench_press", 4, 5, "percent_1rm")])
        ] }] }],
        updated_at_iso8601: new Date().toISOString()
      }
    });
    assertStatus(nextSaved, 201, "save follow-on programme");
    const nextDraftId = nextSaved.json.template.template_id;
    assertStatus(await requestJson(base, "POST", `/templates/${nextDraftId}/complete`, { cookie: author.cookie, csrf: author.csrf, body: { coach_user_id: author.userId } }), 200, "complete follow-on");
    const nextActive = await requestJson(base, "POST", `/templates/${nextDraftId}/activate`, { cookie: author.cookie, csrf: author.csrf, body: { coach_user_id: author.userId } });
    const nextTemplateId = nextActive.json?.template?.template_id ?? nextDraftId;
    const nextListed = await requestJson(base, "PUT", `/templates/${nextTemplateId}/catalogue-listing`, {
      cookie: author.cookie, csrf: author.csrf,
      body: { title: "Intermediate upper/lower", summary: "Four days.", levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4 }
    });
    assertStatus(nextListed, 200, "list follow-on");
    const beginnerListing = { title: "Beginner full-body", summary: "Three full-body sessions.", levels: ["beginner"], activity_ids: [], days_per_week: 3 };
    const toSelf = await requestJson(base, "PUT", `/templates/${templateId}/catalogue-listing`, { cookie: author.cookie, csrf: author.csrf, body: { ...beginnerListing, next_listing_id: listed.json.listing.listing_id } });
    assertStatus(toSelf, 422, "a programme can't follow itself");
    const toUnknown = await requestJson(base, "PUT", `/templates/${templateId}/catalogue-listing`, { cookie: author.cookie, csrf: author.csrf, body: { ...beginnerListing, next_listing_id: "programme_not_theirs" } });
    assertStatus(toUnknown, 422, "only the author's own programmes can follow");
    assertStatus(await requestJson(base, "PUT", `/templates/${templateId}/catalogue-listing`, {
      cookie: author.cookie, csrf: author.csrf, body: { ...beginnerListing, next_listing_id: nextListed.json.listing.listing_id }
    }), 200, "name the follow-on");
    const authorView = await requestJson(base, "GET", `/templates/${templateId}/catalogue-listing`, { cookie: author.cookie });
    assert.equal(authorView.json.listing.next_listing_id, nextListed.json.listing.listing_id);
    assert.deepEqual(authorView.json.other_listings.map((l) => l.title), ["Intermediate upper/lower"]);

    // Any coach can browse the listed programmes and copy one into their own
    // library: a draft they own, with the same sessions, the author's
    // programme untouched.
    const browse = await requestJson(base, "GET", "/templates/kolosseum-programmes", { cookie: other.cookie });
    assertStatus(browse, 200, "coach browses Kolosseum programmes");
    assert.ok(browse.json.programmes.some((p) => p.title === "Beginner full-body"));
    const copied = await requestJson(base, "POST", `/templates/kolosseum-programmes/${encodeURIComponent(listed.json.listing.listing_id)}/copy`, { cookie: other.cookie, csrf: other.csrf, body: {} });
    assertStatus(copied, 201, "coach copies a Kolosseum programme");
    const copy = copied.json.template;
    assert.equal(copy.coach_user_id, other.userId);
    assert.equal(copy.template_status, "draft");
    assert.equal(copy.template_name, "Beginner full-body");
    assert.notEqual(copy.template_id, templateId);
    const sessionTitles = (t) => t.template_structure.blocks.flatMap((b) => b.weeks.flatMap((w) => [...(w.sessions ?? []), ...(w.days ?? []).flatMap((d) => d.sessions ?? [])])).map((s) => s.title);
    assert.deepEqual(sessionTitles(copy), ["Day A", "Day B", "Day A again"]);
    const library = await requestJson(base, "GET", `/templates?coach_user_id=${encodeURIComponent(other.userId)}`, { cookie: other.cookie });
    assert.ok(library.json.templates.some((t) => t.template_id === copy.template_id), "it's in their library");
    assertStatus(await requestJson(base, "POST", "/templates/kolosseum-programmes/programme_not_listed/copy", { cookie: other.cookie, csrf: other.csrf, body: {} }), 404, "only listed programmes");
    assertStatus(await requestJson(base, "GET", "/templates/kolosseum-programmes", { cookie: athlete.cookie }), 403, "athletes don't browse the coach catalogue");

    // The finished beginner is shown it - for amateurs, so they'd move their
    // level up to start it - and can run the beginner programme again.
    const finished = (await requestJson(base, "GET", "/account/onboarding/programmes", { cookie: athlete.cookie })).json.current;
    assert.equal(finished.finished, true);
    assert.equal(finished.next.title, "Intermediate upper/lower");
    assert.equal(finished.next.suits_level, false);
    assert.equal(finished.can_repeat, true);
    const csrfAgain = (await requestJson(base, "GET", "/account/detail", { cookie: athlete.cookie })).json.csrf_token;
    const again = await requestJson(base, "PUT", "/account/onboarding/programme", { cookie: athlete.cookie, csrf: csrfAgain, body: { listing_id: listed.json.listing.listing_id } });
    assertStatus(again, 200, "run it again");
    assert.deepEqual([again.json.current.sessions_done, again.json.current.finished], [0, undefined]);
    const repeatSession = await createSession();
    assertStatus(repeatSession, 201, "first session of the repeat");
    assert.equal(repeatSession.json.planned_session.programme_run.session_title, "Day A");
    assert.equal(repeatSession.json.planned_session.programme_run.reentry, undefined, "no break, no re-entry");

    // Two weeks away: the next session is the programme's next one (Day B),
    // made lighter for the re-entry week - a set fewer - with the reason.
    await withClient(databaseUrl, (client) => client.query(
      "UPDATE sessions SET created_at = created_at - interval '14 days' WHERE beta_subject_user_id = $1", [athlete.userId]
    ));
    const back = await createSession();
    assertStatus(back, 201, "session after two weeks away");
    const backSession = back.json.planned_session;
    assert.equal(backSession.programme_run.session_title, "Day B", "the programme picks up where it left off");
    assert.equal(backSession.programme_run.reentry.reentry_week, true);
    assert.ok(backSession.programme_run.reentry.gap_days >= 14);
    const pushUps = backSession.exercises.find((e) => e.exercise_id === "push_up");
    assert.deepEqual([pushUps.sets, pushUps.reentry_lighter], [2, true], "3 sets of push-ups become 2");
    assert.equal(backSession.exercises.find((e) => e.exercise_id === "deadlift").sets, 1, "a single set stays one set");

    // Stopping it, the athlete builds their own week and trains from it.
    const csrf = (await requestJson(base, "GET", "/account/detail", { cookie: athlete.cookie })).json.csrf_token;
    assertStatus(await requestJson(base, "PUT", "/account/onboarding/programme", { cookie: athlete.cookie, csrf, body: { listing_id: null } }), 200, "stop programme");

    // With no week yet, they log what they train today: the exercises they
    // chose, for this session only (invalid choices are refused).
    const noWeek = await requestJson(base, "GET", "/account/onboarding/training-week", { cookie: athlete.cookie });
    assertStatus(noWeek, 200, "my training with no week");
    assert.deepEqual([noWeek.json.week, noWeek.json.programme_in_progress], [null, false]);
    const badToday = await createSession({ todays_exercises: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "back_squat", sets: 2, reps: 5 }] });
    assertStatus(badToday, 400, "the same exercise twice");
    assert.equal(badToday.json.details.failure_token, "todays_exercises_invalid");
    const today = await createSession({ todays_exercises: [{ exercise_id: "deadlift", sets: 2, reps: 3 }, { exercise_id: "push_up", sets: 3, reps: 12 }] });
    assertStatus(today, 201, "today's session");
    assert.equal(today.json.planned_session.own_training.today, true);
    const todayState = await requestJson(base, "GET", `/sessions/${today.json.session_id}/state`, { cookie: athlete.cookie });
    assertStatus(todayState, 200, "today's session state");
    assert.equal(todayState.json.own_training.today, true, "the session screen knows it's today's own session");
    assert.deepEqual(today.json.planned_session.exercises.map((e) => e.exercise_id), ["deadlift", "push_up"]);
    // Still the week back after two weeks away: a set fewer than they chose.
    assert.equal(today.json.planned_session.own_training.reentry.reentry_week, true);
    assert.deepEqual(today.json.planned_session.exercises.map((e) => e.sets), [1, 2]);
    const ownWeek = await requestJson(base, "PUT", "/account/onboarding/training-week", { cookie: athlete.cookie, csrf, body: {
      days: [{ items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "push_up", sets: 3, reps: 10 }] }, { items: [{ exercise_id: "deadlift", sets: 1, reps: 5 }] }],
      lighter_every_fourth: true
    } });
    assertStatus(ownWeek, 200, "build my training");
    const ownSession = await createSession();
    assertStatus(ownSession, 201, "a session from my own week");
    assert.equal(ownSession.json.planned_session.own_training.day_number, 1);
    assert.deepEqual(ownSession.json.planned_session.exercises.map((e) => e.exercise_id), ["back_squat", "push_up"]);
    assert.equal(ownSession.json.planned_session.programme_run, undefined);
  }
);
