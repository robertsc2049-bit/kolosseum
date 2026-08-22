// DEV NOTE: FULL-UI-74 video-submitted notification persistent proof.
// Proves that an athlete uploading a form-check video against a real
// coach-managed session creates exactly one notification for that
// session's own coach only, never for an unrelated coach, correctly
// deep-linking to that athlete's review queue, that it starts unread and
// can be marked read, that repeated reads never duplicate the derived
// notification, that a second upload produces a second independent
// notification, that deterministic compile output is unaffected, and
// that everything survives a fresh-process restart. Every step crosses
// only public HTTP routes.

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
import { STORAGE_ROOT } from "../dist/src/api/video_submission_storage.js";

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

async function requestMultipart(baseUrl, route, fields, filePart, options = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.append(key, value);
  }
  if (filePart) {
    formData.append(
      "video",
      new Blob([filePart.buffer], { type: filePart.mimeType ?? "application/octet-stream" }),
      filePart.filename ?? "upload.bin"
    );
  }

  const headers = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, { method: "POST", headers, body: formData });
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
  const email = `video_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Video Notif ${label} Coach`,
    email,
    password: `VideoNotif${label}Coach!2026`,
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
    { display_name: `Video Notif ${label} Coach`, email },
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
  const email = `video_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Video Notif ${label} Athlete`,
    email,
    password: `VideoNotif${label}Athlete!2026`,
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
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function setUpStrengthProfile(baseUrl, coach, athleteUserId) {
  const dateOnly = new Date().toISOString().slice(0, 10);
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coach.userId,
    athlete_user_id: athleteUserId,
    preferred_weight_unit: "kg",
    load_rounding_increment: 2.5,
    bodyweight: 90,
    bodyweight_unit: "kg",
    benchmarks: [
      ["back_squat", 160],
      ["bench_press", 110]
    ].map(([exerciseId, value]) => ({
      benchmark_id: "",
      exercise_id: exerciseId,
      value,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: dateOnly,
      source_note: "FULL-UI-74 integration proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
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

function blockWithSessions() {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-UI-74 Block",
    description: "",
    block_type: "strength",
    week_count: 1,
    weeks: [{
      week_id: "",
      order_index: 1,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: "Session 1",
        work_items: workItems()
      }]
    }]
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-74 video-submitted notification proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithSessions()],
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

async function createSessionForAthlete(baseUrl, coach, athleteUserId, nonce) {
  const template = await createActivatedTemplate(baseUrl, coach.userId, `Full74 Programme ${nonce}`);

  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_74_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: template.template_id,
      activity_id: "powerlifting",
      event_id: ""
    },
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");

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

function tinyMp4Buffer() {
  // Minimal ISO-BMFF ftyp box header - enough for sniffVideoFile's
  // ascii(4,8) === "ftyp" check, not a playable file.
  return Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
}

async function uploadVideo(baseUrl, athlete, sessionId, workItemId, exerciseLabel, clientRequestId) {
  const result = await requestMultipart(
    baseUrl, "/video-feedback",
    { session_id: sessionId, work_item_id: workItemId, exercise_label: exerciseLabel, client_request_id: clientRequestId },
    { buffer: tinyMp4Buffer(), mimeType: "video/mp4", filename: "clip.mp4" },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(result, 201, `upload video "${exerciseLabel}"`);
  return result.json.submission.submission_id;
}

test(
  "Video-submitted notification: exactly one notification for the session's own coach only, never for an unrelated coach, correct deep link, starts unread, mark-read works, repeated reads never duplicate, a second upload produces a second independent notification, deterministic compile untouched, fresh-process restart",
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
          `DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_video_submissions WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])`,
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
      await fs.rm(STORAGE_ROOT, { recursive: true, force: true }).catch(() => {});
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
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `video_notif_rel_${nonce}`, coachUserId: coachA.userId, athleteUserId: athlete.userId, state: "accepted"
    });
    await setUpStrengthProfile(baseUrl, coachA, athlete.userId);

    const sessionId = await createSessionForAthlete(baseUrl, coachA, athlete.userId, nonce);
    sessionIds.push(sessionId);

    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);

    // ============================================================
    // Athlete uploads a form-check video against the session managed
    // by coach A. Coach A sees exactly one video-submitted
    // notification, unread, correctly deep-linking to that athlete's
    // review queue, with the athlete identity and submission_id as
    // factual payload.
    // ============================================================
    const firstSubmissionId = await uploadVideo(
      baseUrl, athlete, sessionId, "wi_back_squat", "Back Squat", `video_notif_crid_${nonce}_1`
    );

    const coachANotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    assertStatus(coachANotifications, 200, "coach A reads own notifications");
    const coachAVideoNotifications = coachANotifications.json.notifications.filter(
      (entry) => entry.notification_type === "video_submitted"
    );
    assert.equal(coachAVideoNotifications.length, 1, "expected exactly one video-submitted notification for coach A");
    const notification = coachAVideoNotifications[0];
    assert.equal(notification.deep_link.route_id, "coach_review_athlete");
    assert.equal(notification.deep_link.params.athlete_id, athlete.userId);
    assert.equal(notification.target_available, true);
    assert.equal(notification.notification_payload.athlete_user_id, athlete.userId);
    assert.equal(notification.notification_payload.submission_id, firstSubmissionId);
    assert.equal(notification.read_at_iso8601, null, "expected the notification to start unread");

    // ============================================================
    // Coach B never sees this notification - they have no relationship
    // to this session or this athlete at all.
    // ============================================================
    const coachBNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    assertStatus(coachBNotifications, 200, "coach B reads own notifications");
    assert.equal(
      coachBNotifications.json.notifications.some((entry) => entry.notification_type === "video_submitted"),
      false,
      "expected coach B to never receive a video-submitted notification for a session they do not manage"
    );

    // ============================================================
    // Marking it read persists, and repeated reads of coach A's
    // notification list never duplicate the derived notification.
    // ============================================================
    const markRead = await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(notification.notification_id)}/read`, {}, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(markRead, 200, "coach A marks the notification read");

    const coachANotificationsAfterRead = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    const coachAVideoNotificationsAfterRead = coachANotificationsAfterRead.json.notifications.filter(
      (entry) => entry.notification_type === "video_submitted"
    );
    assert.equal(coachAVideoNotificationsAfterRead.length, 1, "expected still exactly one video-submitted notification after repeated reads");
    assert.notEqual(coachAVideoNotificationsAfterRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // A second upload against the same session produces a second,
    // independent notification for coach A.
    // ============================================================
    const secondSubmissionId = await uploadVideo(
      baseUrl, athlete, sessionId, "wi_bench_press", "Bench Press", `video_notif_crid_${nonce}_2`
    );
    const coachANotificationsAfterSecond = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    const coachAVideoNotificationsAfterSecond = coachANotificationsAfterSecond.json.notifications.filter(
      (entry) => entry.notification_type === "video_submitted"
    );
    assert.equal(coachAVideoNotificationsAfterSecond.length, 2, "expected a second, independent video-submitted notification for coach A");
    assert.ok(
      coachAVideoNotificationsAfterSecond.some((entry) => entry.notification_payload.submission_id === secondSubmissionId),
      "expected the second notification to carry the second submission_id"
    );

    // ============================================================
    // Deterministic compile output is completely unaffected by any
    // of this product-side activity - the closed-world engine
    // boundary.
    // ============================================================
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Video-submitted notifications read altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the notifications reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await request(restarted.baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    assertStatus(restartedNotifications, 200, "coach A's notifications after fresh-process restart");
    const restartedVideoNotifications = restartedNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "video_submitted"
    );
    assert.equal(restartedVideoNotifications.length, 2);
    assert.ok(restartedVideoNotifications.some((entry) => entry.read_at_iso8601 !== null));
  }
);
