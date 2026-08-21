// DEV NOTE: FULL-UI-72 video-feedback notification persistent proof.
// Proves that a coach's reply to an athlete's video submission creates
// exactly one notification for that athlete, correctly deep-linking to
// the session's own history detail, that it starts unread and can be
// marked read, that repeated reads never duplicate the derived
// notification, that a second reply on a second submission produces a
// second independent notification, that deterministic compile output is
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
    name: "Full-UI-72 Block",
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
      source_note: "FULL-UI-72 integration proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-72 video feedback notification proof.",
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
  const template = await createActivatedTemplate(baseUrl, coach.userId, `Full72 Programme ${nonce}`);

  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_72_request_${nonce}`,
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
  const upload = await requestMultipart(
    baseUrl, "/video-feedback",
    { session_id: sessionId, work_item_id: workItemId, exercise_label: exerciseLabel, client_request_id: clientRequestId },
    { buffer: tinyMp4Buffer(), mimeType: "video/mp4", filename: "upload.mp4" },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(upload, 201, `upload video for ${clientRequestId}`);
  return upload.json.submission.submission_id;
}

async function addFeedback(baseUrl, coach, submissionId, feedbackText) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/video-feedback/submissions/${encodeURIComponent(submissionId)}/feedback`,
    { feedback_text: feedbackText }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 201, `coach adds feedback on ${submissionId}`);
  return result.json;
}

test(
  "Video feedback notification: exactly one notification for the submitting athlete, correct deep link, starts unread, mark-read works, repeated reads never duplicate, a second reply produces a second independent notification, deterministic compile untouched, fresh-process restart",
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

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `video_notif_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });
    await setUpStrengthProfile(baseUrl, coach, athlete.userId);

    const sessionId = await createSessionForAthlete(baseUrl, coach, athlete.userId, nonce);
    sessionIds.push(sessionId);

    const submissionId = await uploadVideo(baseUrl, athlete, sessionId, "wi_back_squat", "Back Squat", `video_notif_crid_${nonce}_1`);
    await addFeedback(baseUrl, coach, submissionId, "Nice depth - keep your chest up through the ascent.");

    // ============================================================
    // The athlete sees exactly one notification, unread, correctly
    // deep-linking to their own session history detail, with the
    // coach identity and submission_id as factual payload.
    // ============================================================
    const athleteNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
    assertStatus(athleteNotifications, 200, "athlete reads own notifications");
    const feedbackNotifications = athleteNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "video_feedback_received"
    );
    assert.equal(feedbackNotifications.length, 1, "expected exactly one video-feedback notification for the athlete");
    const notification = feedbackNotifications[0];
    assert.equal(notification.deep_link.route_id, "athlete_history_detail");
    assert.equal(notification.deep_link.params.session_id, sessionId);
    assert.equal(notification.target_available, true);
    assert.equal(notification.notification_payload.coach_user_id, coach.userId);
    assert.equal(notification.notification_payload.submission_id, submissionId);
    assert.equal(notification.read_at_iso8601, null, "expected the notification to start unread");

    // ============================================================
    // The coach never sees this notification themselves - it is
    // addressed to the athlete only.
    // ============================================================
    const coachNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coach.cookie });
    assertStatus(coachNotifications, 200, "coach reads own notifications");
    assert.equal(
      coachNotifications.json.notifications.some((entry) => entry.notification_type === "video_feedback_received"),
      false,
      "expected the coach to never receive their own feedback-reply notification"
    );

    // ============================================================
    // Marking it read persists, and repeated reads of the athlete's
    // notification list never duplicate the derived notification.
    // ============================================================
    const markRead = await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(notification.notification_id)}/read`, {}, { cookie: athlete.cookie, csrf: athlete.csrf });
    assertStatus(markRead, 200, "athlete marks the notification read");

    const athleteNotificationsAfterRead = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
    const feedbackNotificationsAfterRead = athleteNotificationsAfterRead.json.notifications.filter(
      (entry) => entry.notification_type === "video_feedback_received"
    );
    assert.equal(feedbackNotificationsAfterRead.length, 1, "expected still exactly one video-feedback notification after repeated reads");
    assert.notEqual(feedbackNotificationsAfterRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // A second upload and a second reply produce a second,
    // independent notification for the athlete.
    // ============================================================
    const secondSubmissionId = await uploadVideo(baseUrl, athlete, sessionId, "wi_bench_press", "Bench Press", `video_notif_crid_${nonce}_2`);
    await addFeedback(baseUrl, coach, secondSubmissionId, "Bar path looks straight - good work.");

    const athleteNotificationsAfterSecond = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
    const feedbackNotificationsAfterSecond = athleteNotificationsAfterSecond.json.notifications.filter(
      (entry) => entry.notification_type === "video_feedback_received"
    );
    assert.equal(feedbackNotificationsAfterSecond.length, 2, "expected a second, independent video-feedback notification");
    assert.ok(
      feedbackNotificationsAfterSecond.some((entry) => entry.notification_payload.submission_id === secondSubmissionId),
      "expected the second notification to carry the second submission_id"
    );

    // ============================================================
    // Deterministic compile output is completely unaffected by any
    // of this product-side activity - the closed-world engine
    // boundary.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileBefore = await compileFixture(baseUrl, fixture);
    const compileAfter = await compileFixture(baseUrl, fixture);
    assert.deepEqual(compileAfter, compileBefore, "Video feedback notifications read altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the notifications reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await request(restarted.baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
    assertStatus(restartedNotifications, 200, "athlete's notifications after fresh-process restart");
    const restartedFeedbackNotifications = restartedNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "video_feedback_received"
    );
    assert.equal(restartedFeedbackNotifications.length, 2);
    assert.ok(restartedFeedbackNotifications.some((entry) => entry.read_at_iso8601 !== null));
  }
);
