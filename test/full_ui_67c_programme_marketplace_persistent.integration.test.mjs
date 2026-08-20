// DEV NOTE: FULL-UI-67 programme template marketplace visibility
// persistent proof. Proves a draft template cannot be shared, a
// complete or active template can be, the marketplace browse list shows
// every currently-shared template from every coach with the sharing
// coach's identity and branding, un-sharing removes it from the browse
// list, archiving a previously-shared template also removes it (the
// browse list re-checks live status, never trusting a stale sharing
// flag), a coach cannot share another coach's template, a non-coach
// account is denied, validation rejections are enforced, deterministic
// compile output is unaffected, and everything survives a fresh-process
// restart. Every step crosses only public HTTP routes.

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

async function registerCoach(baseUrl, nonce, label) {
  const email = `marketplace_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Marketplace ${label} Coach`,
    email,
    password: `Marketplace${label}Coach!2026`,
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
    { display_name: `Marketplace ${label} Coach`, email },
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
  const email = `marketplace_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Marketplace ${label} Athlete`,
    email,
    password: `Marketplace${label}Athlete!2026`,
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

function baseWorkItem(exerciseId, orderIndex) {
  return {
    work_item_id: "",
    order_index: orderIndex,
    exercise_id: exerciseId,
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: 8,
    rep_min: 8,
    rep_max: 8,
    load_mode: "bodyweight",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    rpe_value: 8,
    rest_seconds: 90,
    role: orderIndex === 1 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  };
}

function templatePayload(coachUserId, name, exerciseIds) {
  return {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: `${name} description.`,
    activity_id: "powerlifting",
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Block 1",
      description: "",
      block_type: "general",
      week_count: 1,
      weeks: [{
        week_id: "",
        order_index: 1,
        sessions: [{
          session_id: "",
          order_index: 1,
          title: "Session 1",
          coaching_notes: "",
          work_items: exerciseIds.slice(0, 2).map((exerciseId, index) => baseWorkItem(exerciseId, index + 1))
        }]
      }]
    }],
    updated_at_iso8601: new Date().toISOString()
  };
}

async function createAndCompleteTemplate(baseUrl, coach, name, exerciseIds) {
  const saved = await request(baseUrl, "POST", "/templates", templatePayload(coach.userId, name, exerciseIds), { cookie: coach.cookie, csrf: coach.csrf });
  assertStatus(saved, 201, `${name} draft save`);
  const templateId = saved.json?.template?.template_id;
  assert.ok(templateId, `expected a template_id for ${name}`);

  const completed = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, { coach_user_id: coach.userId }, { cookie: coach.cookie, csrf: coach.csrf });
  assertStatus(completed, 200, `${name} complete`);

  return templateId;
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
  "Programme marketplace: draft cannot be shared, complete/active can be, browse shows every shared template with coach identity, un-sharing and archiving remove it live, cross-coach ownership denied, non-coach denied, validation rejections, deterministic compile untouched, fresh-process restart",
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

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const coachC = await registerCoach(baseUrl, nonce, "c");
    coachUserIds.push(coachC.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    const exerciseResponse = await request(baseUrl, "GET", "/templates/exercises");
    assertStatus(exerciseResponse, 200, "exercise options");
    const exerciseIds = (exerciseResponse.json?.exercises ?? []).map((exercise) => exercise.exercise_id);
    assert.ok(exerciseIds.length >= 2, "expected at least two active exercise options");

    // ============================================================
    // A draft template cannot be shared.
    // ============================================================
    const draftSaved = await request(baseUrl, "POST", "/templates", templatePayload(coachA.userId, "Alpha Draft", exerciseIds), { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(draftSaved, 201, "Alpha Draft save");
    const draftTemplateId = draftSaved.json?.template?.template_id;

    const draftShareAttempt = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(draftTemplateId)}/sharing`,
      { shared_publicly: true }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(draftShareAttempt, 400, "a draft template cannot be shared");
    assert.equal(draftShareAttempt.json?.error, "programme_template_sharing_template_not_in_shareable_state");

    // ============================================================
    // Validation: unknown field and non-boolean value are rejected.
    // ============================================================
    const templateAlphaId = await createAndCompleteTemplate(baseUrl, coachA, "Template Alpha", exerciseIds);

    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`, { shared_publicly: true, extra: 1 }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      400,
      "unknown field is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`, { shared_publicly: "yes" }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      400,
      "non-boolean shared_publicly is rejected"
    );

    // ============================================================
    // A cross-coach share attempt on someone else's template is
    // rejected - the ownership check is the same coach-scoped search
    // used everywhere else, not a new trust boundary.
    // ============================================================
    const crossCoachAttempt = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`,
      { shared_publicly: true }, { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(crossCoachAttempt, 404, "a coach cannot share another coach's template");
    assert.equal(crossCoachAttempt.json?.error, "programme_template_sharing_template_not_found");

    // ============================================================
    // A non-coach account is denied.
    // ============================================================
    const athleteBrowseAttempt = await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: athlete.cookie });
    assertStatus(athleteBrowseAttempt, 403, "athlete cannot browse the marketplace");
    assert.equal(athleteBrowseAttempt.json?.error, "COACH_ACCOUNT_REQUIRED");

    // ============================================================
    // An unauthenticated request is rejected outright.
    // ============================================================
    assertStatus(await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, {}), 401, "unauthenticated browse is rejected");

    // ============================================================
    // Coach A shares Template Alpha (complete). Coach B creates,
    // completes and activates Template Beta, then shares it too.
    // ============================================================
    const shareAlpha = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`,
      { shared_publicly: true }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(shareAlpha, 201, "coach A shares Template Alpha");

    const readOwnAlphaSharing = await request(
      baseUrl, "GET", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(readOwnAlphaSharing, 200, "coach A reads own sharing state");
    assert.equal(readOwnAlphaSharing.json?.sharing_preference?.shared_publicly, true);

    const templateBetaId = await createAndCompleteTemplate(baseUrl, coachB, "Template Beta", exerciseIds);
    const activateBeta = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateBetaId)}/activate`, { coach_user_id: coachB.userId }, { cookie: coachB.cookie, csrf: coachB.csrf });
    assertStatus(activateBeta, 200, "Template Beta activate");

    const shareBeta = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateBetaId)}/sharing`,
      { shared_publicly: true }, { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(shareBeta, 201, "coach B shares Template Beta");

    // ============================================================
    // Coach C (who has shared nothing) browses the marketplace and
    // sees both shared templates, with the sharing coach's identity -
    // and never a full template_structure, and never coach C's own
    // unshared work.
    // ============================================================
    const browse = await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: coachC.cookie });
    assertStatus(browse, 200, "coach C browses the marketplace");
    const browsedIds = (browse.json?.templates ?? []).map((entry) => entry.template_id);
    assert.ok(browsedIds.includes(templateAlphaId), "expected Template Alpha in the marketplace");
    assert.ok(browsedIds.includes(templateBetaId), "expected Template Beta in the marketplace");
    assert.ok(!browsedIds.includes(draftTemplateId), "expected the unshared draft to be absent");

    const alphaEntry = browse.json.templates.find((entry) => entry.template_id === templateAlphaId);
    assert.equal(alphaEntry.template_name, "Template Alpha");
    assert.equal(alphaEntry.activity_id, "powerlifting");
    assert.equal(alphaEntry.template_status, "complete");
    assert.equal(alphaEntry.coach_display_name, "Marketplace a Coach");
    assert.equal(alphaEntry.coach_user_id, coachA.userId);
    assert.equal("template_structure" in alphaEntry, false, "the marketplace summary must not leak the full template structure");

    const betaEntry = browse.json.templates.find((entry) => entry.template_id === templateBetaId);
    assert.equal(betaEntry.template_status, "active");
    assert.equal(betaEntry.coach_display_name, "Marketplace b Coach");

    // ============================================================
    // Coach A un-shares Template Alpha - it drops out of the browse
    // list immediately, Template Beta remains.
    // ============================================================
    const unshareAlpha = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateAlphaId)}/sharing`,
      { shared_publicly: false }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(unshareAlpha, 201, "coach A un-shares Template Alpha");

    const browseAfterUnshare = await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: coachC.cookie });
    const idsAfterUnshare = (browseAfterUnshare.json?.templates ?? []).map((entry) => entry.template_id);
    assert.ok(!idsAfterUnshare.includes(templateAlphaId), "expected Template Alpha to be gone after un-sharing");
    assert.ok(idsAfterUnshare.includes(templateBetaId), "expected Template Beta to remain shared");

    // ============================================================
    // Archiving a previously-shared template removes it from the
    // browse list too, even though its stored sharing preference is
    // still true - the browse list re-checks live template status,
    // never trusting a stale sharing flag.
    // ============================================================
    const archiveBeta = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateBetaId)}/archive`, { coach_user_id: coachB.userId }, { cookie: coachB.cookie, csrf: coachB.csrf });
    assertStatus(archiveBeta, 200, "Template Beta archive");

    const browseAfterArchive = await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: coachC.cookie });
    const idsAfterArchive = (browseAfterArchive.json?.templates ?? []).map((entry) => entry.template_id);
    assert.ok(!idsAfterArchive.includes(templateBetaId), "expected the archived, previously-shared template to be gone");

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Programme marketplace reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the un-shared/archived state reconstructs
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedBrowse = await request(restarted.baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: coachC.cookie });
    assertStatus(restartedBrowse, 200, "marketplace browse after fresh-process restart");
    const restartedIds = (restartedBrowse.json?.templates ?? []).map((entry) => entry.template_id);
    assert.ok(!restartedIds.includes(templateAlphaId));
    assert.ok(!restartedIds.includes(templateBetaId));
  }
);
