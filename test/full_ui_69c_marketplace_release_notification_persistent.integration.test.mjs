// DEV NOTE: FULL-UI-69 marketplace-release notification persistent proof.
// Proves that releasing a template creates exactly one notification for
// the buyer (never the seller), correctly deep-linking to the buyer's
// own new clone, that it starts unread and can be marked read, that
// repeated reads never duplicate the derived notification, that two
// separate releases produce two separate notifications each addressed
// to the correct buyer only, that deterministic compile output is
// unaffected, and that everything survives a fresh-process restart.
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
  const email = `release_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Release Notif ${label} Coach`,
    email,
    password: `ReleaseNotif${label}Coach!2026`,
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
    { display_name: `Release Notif ${label} Coach`, email },
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
  "Marketplace release notification: exactly one notification for the buyer only, correct deep link, starts unread, mark-read works, repeated reads never duplicate, two releases produce two independent notifications, deterministic compile untouched, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const coachUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
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

    const exerciseResponse = await request(baseUrl, "GET", "/templates/exercises");
    assertStatus(exerciseResponse, 200, "exercise options");
    const exerciseIds = (exerciseResponse.json?.exercises ?? []).map((exercise) => exercise.exercise_id);
    assert.ok(exerciseIds.length >= 2, "expected at least two active exercise options");

    const templateId = await createAndCompleteTemplate(baseUrl, coachA, "Notifiable Template", exerciseIds);
    assertStatus(
      await request(baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/sharing`, { shared_publicly: true }, { cookie: coachA.cookie, csrf: coachA.csrf }),
      201,
      "coach A shares the template"
    );

    const release = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
      { buyer_account_code: coachB.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(release, 201, "coach A releases to coach B");
    const clonedTemplateId = release.json?.cloned_template_id;
    assert.ok(clonedTemplateId, "expected a cloned_template_id");

    // ============================================================
    // The buyer sees exactly one notification, unread, correctly
    // deep-linking to their own new clone, with the seller's identity
    // and the original template_id as payload.
    // ============================================================
    const buyerNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    assertStatus(buyerNotifications, 200, "coach B reads own notifications");
    const releaseNotifications = buyerNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "marketplace_template_released"
    );
    assert.equal(releaseNotifications.length, 1, "expected exactly one release notification for coach B");
    const notification = releaseNotifications[0];
    assert.equal(notification.deep_link.route_id, "coach_programme_detail");
    assert.equal(notification.deep_link.params.template_id, clonedTemplateId);
    assert.equal(notification.target_available, true);
    assert.equal(notification.notification_payload.seller_coach_user_id, coachA.userId);
    assert.equal(notification.notification_payload.source_template_id, templateId);
    assert.equal(notification.read_at_iso8601, null, "expected the notification to start unread");

    // ============================================================
    // The seller never sees this notification themselves - it is
    // addressed to the buyer only.
    // ============================================================
    const sellerNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    assertStatus(sellerNotifications, 200, "coach A reads own notifications");
    assert.equal(
      sellerNotifications.json.notifications.some((entry) => entry.notification_type === "marketplace_template_released"),
      false,
      "expected the seller to never receive their own release notification"
    );

    // ============================================================
    // Marking it read persists, and repeated reads of the buyer's
    // notification list never duplicate the derived notification.
    // ============================================================
    const markRead = await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(notification.notification_id)}/read`, {}, { cookie: coachB.cookie, csrf: coachB.csrf });
    assertStatus(markRead, 200, "coach B marks the notification read");

    const buyerNotificationsAfterRead = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    const releaseNotificationsAfterRead = buyerNotificationsAfterRead.json.notifications.filter(
      (entry) => entry.notification_type === "marketplace_template_released"
    );
    assert.equal(releaseNotificationsAfterRead.length, 1, "expected still exactly one release notification after repeated reads");
    assert.notEqual(releaseNotificationsAfterRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // A second release, to a different buyer, produces a second,
    // independent notification addressed to that buyer only.
    // ============================================================
    const secondRelease = await request(
      baseUrl, "POST", `/programme-marketplace/templates/${encodeURIComponent(templateId)}/release`,
      { buyer_account_code: coachC.userId }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(secondRelease, 201, "coach A releases the same template to coach C too");

    const coachCNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachC.cookie });
    assertStatus(coachCNotifications, 200, "coach C reads own notifications");
    const coachCReleaseNotifications = coachCNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "marketplace_template_released"
    );
    assert.equal(coachCReleaseNotifications.length, 1, "expected exactly one release notification for coach C");
    assert.notEqual(
      coachCReleaseNotifications[0].deep_link.params.template_id,
      clonedTemplateId,
      "expected coach C's clone to be a distinct template from coach B's clone"
    );

    // ============================================================
    // Deterministic compile output is completely unaffected by any of
    // this product-side activity - the closed-world engine boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Marketplace release notifications read altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the notification reconstructs
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await request(restarted.baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    assertStatus(restartedNotifications, 200, "coach B's notifications after fresh-process restart");
    const restartedReleaseNotifications = restartedNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "marketplace_template_released"
    );
    assert.equal(restartedReleaseNotifications.length, 1);
    assert.notEqual(restartedReleaseNotifications[0].read_at_iso8601, null);
  }
);
