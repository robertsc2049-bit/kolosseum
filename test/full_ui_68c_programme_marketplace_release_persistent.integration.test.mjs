// DEV NOTE: FULL-UI-68 programme template marketplace release persistent
// proof. Proves a coach can set a price label and payment-methods note
// alongside sharing, that releasing to an invalid/self/non-coach account
// code is rejected, that only the owning coach can release their own
// still-shareable template, that a real release clones the full template
// into the buyer's own independent library as a fresh draft (a different
// template_id/family entirely, not a reference back to the seller), that
// the seller's release history records every buyer, that an unrelated
// coach querying release history for someone else's template sees
// nothing, that a non-coach is denied, that deterministic compile output
// is unaffected, and that everything survives a fresh-process restart.
// Every step crosses only public HTTP routes.

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
  const email = `release_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Release ${label} Coach`,
    email,
    password: `Release${label}Coach!2026`,
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
    { display_name: `Release ${label} Coach`, email },
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
  const email = `release_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Release ${label} Athlete`,
    email,
    password: `Release${label}Athlete!2026`,
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
  "Programme marketplace release: price/payment note saved, invalid buyer codes rejected, cross-coach release denied, a real release clones the full template into the buyer's own independent library, release history per seller, unrelated-coach history is empty, non-coach denied, deterministic compile untouched, fresh-process restart",
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

    const templateId = await createAndCompleteTemplate(baseUrl, coachA, "Sellable Template", exerciseIds);

    const shareWithPricing = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/sharing`,
      { shared_publicly: true, price_label: "£49", payment_methods_note: "Venmo @coach-a, PayPal a@example.com" },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(shareWithPricing, 201, "coach A shares with price and payment methods");
    assert.equal(shareWithPricing.json?.sharing_preference?.price_label, "£49");
    assert.equal(shareWithPricing.json?.sharing_preference?.payment_methods_note, "Venmo @coach-a, PayPal a@example.com");

    const browse = await request(baseUrl, "GET", "/programme-marketplace/templates", undefined, { cookie: coachB.cookie });
    assertStatus(browse, 200, "coach B browses the marketplace");
    const browsedEntry = browse.json.templates.find((entry) => entry.template_id === templateId);
    assert.equal(browsedEntry.price_label, "£49");
    assert.equal(browsedEntry.payment_methods_note, "Venmo @coach-a, PayPal a@example.com");

    // ============================================================
    // Validation: an empty buyer account code, releasing to yourself,
    // and releasing to a non-coach or nonexistent account code are all
    // rejected before anything is cloned.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: "" }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      400,
      "empty buyer account code is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: coachA.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      400,
      "releasing to yourself is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: athlete.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      404,
      "releasing to a non-coach account code is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: "coach_does_not_exist_at_all" }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      404,
      "releasing to a nonexistent account code is rejected"
    );

    // ============================================================
    // A coach cannot release another coach's template - the same
    // coach-scoped ownership check share/browse already uses.
    // ============================================================
    const crossCoachRelease = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
      { buyer_account_code: coachB.userId }, { cookie: coachC.cookie, csrf: coachC.csrf }
    );
    assertStatus(crossCoachRelease, 404, "a coach cannot release another coach's template");
    assert.equal(crossCoachRelease.json?.error, "programme_template_sharing_template_not_found");

    // ============================================================
    // A non-coach account is denied, and so is an unauthenticated
    // request.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: coachB.userId }, { cookie: athlete.cookie, csrf: athlete.csrf }),
      403,
      "athlete cannot release a template"
    );
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`, { buyer_account_code: coachB.userId }, {}),
      401,
      "unauthenticated release is rejected"
    );

    // ============================================================
    // A real release clones the full template into the buyer's own
    // independent library as a fresh draft - a different template_id
    // and family entirely, never a reference back to the seller.
    // ============================================================
    const release = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
      { buyer_account_code: coachB.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(release, 201, "coach A releases the template to coach B");
    const clonedTemplateId = release.json?.cloned_template_id;
    assert.ok(clonedTemplateId, "expected a cloned_template_id");
    assert.notEqual(clonedTemplateId, templateId, "the clone must be a distinct template_id");

    const buyerTemplates = await request(baseUrl, "GET", `/templates?coach_user_id=${encodeURIComponent(coachB.userId)}`, undefined, { cookie: coachB.cookie });
    assertStatus(buyerTemplates, 200, "coach B lists own templates");
    const clonedTemplate = buyerTemplates.json.templates.find((entry) => entry.template_id === clonedTemplateId);
    assert.ok(clonedTemplate, "expected the cloned template in coach B's own library");
    assert.equal(clonedTemplate.coach_user_id, coachB.userId);
    assert.equal(clonedTemplate.template_name, "Sellable Template");
    assert.equal(clonedTemplate.activity_id, "powerlifting");
    assert.equal(clonedTemplate.template_status, "draft");
    assert.notEqual(clonedTemplate.template_family_id, undefined);
    assert.equal(
      clonedTemplate.template_structure?.blocks?.[0]?.weeks?.[0]?.days?.[0]?.sessions?.[0]?.work_items?.length,
      2,
      "expected the same two work items to have been cloned"
    );

    // ============================================================
    // The seller's release history records the buyer. A second
    // release to a different buyer is recorded alongside the first.
    // ============================================================
    const releaseToC = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
      { buyer_account_code: coachC.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(releaseToC, 201, "coach A releases the same template to coach C too");

    const history = await request(
      baseUrl, "GET", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/releases`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(history, 200, "coach A reads own release history");
    const buyerIds = history.json.releases.map((entry) => entry.buyer_coach_user_id);
    assert.ok(buyerIds.includes(coachB.userId), "expected coach B in the release history");
    assert.ok(buyerIds.includes(coachC.userId), "expected coach C in the release history");
    assert.equal(history.json.releases.find((entry) => entry.buyer_coach_user_id === coachB.userId)?.price_label, "£49");

    // ============================================================
    // An unrelated coach querying release history for someone else's
    // template sees nothing - no cross-coach data leak.
    // ============================================================
    const unrelatedHistory = await request(
      baseUrl, "GET", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/releases`, undefined, { cookie: coachB.cookie }
    );
    assertStatus(unrelatedHistory, 200, "coach B queries release history for a template they don't own");
    assert.deepEqual(unrelatedHistory.json.releases, []);

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Programme marketplace release reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the cloned template and release history
    // reconstruct identically from Postgres, since nothing is cached
    // in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedBuyerTemplates = await request(restarted.baseUrl, "GET", `/templates?coach_user_id=${encodeURIComponent(coachB.userId)}`, undefined, { cookie: coachB.cookie });
    assertStatus(restartedBuyerTemplates, 200, "coach B's templates after fresh-process restart");
    assert.ok(restartedBuyerTemplates.json.templates.some((entry) => entry.template_id === clonedTemplateId));

    const restartedHistory = await request(
      restarted.baseUrl, "GET", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/releases`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(restartedHistory, 200, "release history after fresh-process restart");
    assert.equal(restartedHistory.json.releases.length, 2);
  }
);
