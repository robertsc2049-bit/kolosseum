// DEV NOTE: Attendance events slice 5 - notification derivation proof.
// Proves an invited athlete gets exactly one attendance_event_invited
// notification (never an uninvited athlete), correctly deep-linking to
// their own attendance view, unread by default; that skipping an
// occurrence produces exactly one attendance_event_occurrence_changed
// notification carrying the right occurrence/status; that cancelling a
// DIFFERENT event produces exactly one attendance_event_cancelled
// notification without disturbing the first event's own notifications;
// that mark-read persists and repeated reads never duplicate; and that
// everything survives a fresh-process restart. Every step crosses only
// public HTTP routes.

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
  const email = `attendance_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance Notif ${label} Coach`,
    email,
    password: `AttendanceNotif${label}Coach!2026`,
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
    { display_name: `Attendance Notif ${label} Coach`, email },
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
  const email = `attendance_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Attendance Notif ${label} Athlete`,
    email,
    password: `AttendanceNotif${label}Athlete!2026`,
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

test(
  "Attendance events notifications: invited athlete gets exactly one attendance_event_invited notification (never an uninvited athlete), skipping an occurrence produces attendance_event_occurrence_changed, cancelling a different event produces attendance_event_cancelled without disturbing the first, mark-read persists without duplication, fresh-process restart",
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

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2"); // never invited
    athleteUserIds.push(athlete2.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `attendance_notif_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_notif_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    // ============================================================
    // Event A: a 2-occurrence weekly series, athlete1 invited.
    // ============================================================
    const eventA = await request(baseUrl, "POST", "/attendance-events", {
      title: "Event A", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["mon"], ends: { type: "after_count", value: 2 } },
      athlete_user_ids: [athlete1.userId]
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(eventA, 201, "coach creates event A");
    const eventAId = eventA.json?.event?.event_id;
    const [eventAOcc0, eventAOcc1] = eventA.json.occurrences;

    // ============================================================
    // athlete1 sees exactly one attendance_event_invited notification,
    // unread, deep-linking to their own attendance view. athlete2 (never
    // invited) sees none.
    // ============================================================
    const athlete1Notifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    assertStatus(athlete1Notifications, 200, "athlete1 reads own notifications");
    const invitedNotifications = athlete1Notifications.json.notifications.filter(
      (entry) => entry.notification_type === "attendance_event_invited"
    );
    assert.equal(invitedNotifications.length, 1, "expected exactly one invited notification for athlete1");
    const invitedNotification = invitedNotifications[0];
    assert.equal(invitedNotification.deep_link.route_id, "athlete_attendance_events");
    assert.equal(invitedNotification.notification_payload.event_id, eventAId);
    assert.equal(invitedNotification.notification_payload.organizer_user_id, coach.userId);
    assert.equal(invitedNotification.read_at_iso8601, null, "expected the notification to start unread");

    const athlete2Notifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete2.cookie });
    assertStatus(athlete2Notifications, 200, "athlete2 reads own notifications");
    assert.equal(
      athlete2Notifications.json.notifications.some((entry) => entry.notification_type === "attendance_event_invited"),
      false,
      "expected the uninvited athlete2 to never receive an invited notification"
    );

    // ============================================================
    // Marking it read persists, and repeated reads never duplicate the
    // derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(invitedNotification.notification_id)}/read`,
      {}, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(markRead, 200, "athlete1 marks the invited notification read");

    const afterRead = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    const invitedAfterRead = afterRead.json.notifications.filter((entry) => entry.notification_type === "attendance_event_invited");
    assert.equal(invitedAfterRead.length, 1, "expected still exactly one invited notification after repeated reads");
    assert.notEqual(invitedAfterRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // The coach skips occurrence 1 of event A - athlete1 gets exactly
    // one attendance_event_occurrence_changed notification, carrying the
    // right occurrence_id and status.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventAId)}/occurrences/${encodeURIComponent(eventAOcc1.occurrence_id)}/skip`, {}, { cookie: coach.cookie, csrf: coach.csrf }),
      200,
      "coach skips occurrence 1 of event A"
    );

    const afterSkip = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    assertStatus(afterSkip, 200, "athlete1 re-reads notifications after skip");
    const occurrenceChangedNotifications = afterSkip.json.notifications.filter(
      (entry) => entry.notification_type === "attendance_event_occurrence_changed"
    );
    assert.equal(occurrenceChangedNotifications.length, 1, "expected exactly one occurrence-changed notification");
    assert.equal(occurrenceChangedNotifications[0].notification_payload.event_id, eventAId);
    assert.equal(occurrenceChangedNotifications[0].notification_payload.occurrence_id, eventAOcc1.occurrence_id);
    assert.equal(occurrenceChangedNotifications[0].notification_payload.status, "skipped");
    assert.equal(occurrenceChangedNotifications[0].deep_link.route_id, "athlete_attendance_events");

    // Occurrence 0 was never skipped/rescheduled - no notification for it.
    assert.equal(
      occurrenceChangedNotifications.some((entry) => entry.notification_payload.occurrence_id === eventAOcc0.occurrence_id),
      false,
      "occurrence 0 was never changed, so it must never generate its own notification"
    );

    // ============================================================
    // Event B: a separate single-occurrence event, athlete1 invited.
    // Cancelling it produces exactly one attendance_event_cancelled
    // notification, and never touches event A's own notifications.
    // ============================================================
    const eventB = await request(baseUrl, "POST", "/attendance-events", {
      title: "Event B", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-10", start_time: "09:00", end_time: "10:00",
      athlete_user_ids: [athlete1.userId]
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(eventB, 201, "coach creates event B");
    const eventBId = eventB.json?.event?.event_id;

    assertStatus(
      await request(baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventBId)}/cancel`, {}, { cookie: coach.cookie, csrf: coach.csrf }),
      200,
      "coach cancels event B"
    );

    const afterCancel = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    assertStatus(afterCancel, 200, "athlete1 re-reads notifications after event B is cancelled");
    const cancelledNotifications = afterCancel.json.notifications.filter(
      (entry) => entry.notification_type === "attendance_event_cancelled"
    );
    assert.equal(cancelledNotifications.length, 1, "expected exactly one cancelled notification, for event B only");
    assert.equal(cancelledNotifications[0].notification_payload.event_id, eventBId);
    assert.equal(cancelledNotifications[0].notification_payload.title, "Event B");

    // Event A's own invited/occurrence-changed notifications are
    // completely unaffected by event B's cancellation - athlete1 is
    // invited to BOTH events, so there are two "invited" notifications
    // in total (one per event); this checks event A's own one
    // specifically, not the total count across every event.
    const invitedNotificationsAfterCancel = afterCancel.json.notifications.filter((entry) => entry.notification_type === "attendance_event_invited");
    assert.equal(invitedNotificationsAfterCancel.length, 2, "expected one invited notification per event athlete1 is invited to");
    const stillInvitedToA = invitedNotificationsAfterCancel.find((entry) => entry.notification_payload.event_id === eventAId);
    assert.ok(stillInvitedToA, "event A's own invited notification must survive event B's cancellation");
    const stillOccurrenceChanged = afterCancel.json.notifications.filter((entry) => entry.notification_type === "attendance_event_occurrence_changed");
    assert.equal(stillOccurrenceChanged.length, 1);

    // Event B's own occurrence was never individually skipped/
    // rescheduled - only the whole event was cancelled - so it must
    // never also generate a redundant occurrence-changed notification.
    assert.equal(
      stillOccurrenceChanged.some((entry) => entry.notification_payload.event_id === eventBId),
      false,
      "a cancelled event's untouched occurrence must never also fire its own occurrence-changed notification"
    );

    // ============================================================
    // Fresh-process restart: every notification reconstructs
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await request(restarted.baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    assertStatus(restartedNotifications, 200, "athlete1's notifications after fresh-process restart");
    const restartedInvited = restartedNotifications.json.notifications.filter((entry) => entry.notification_type === "attendance_event_invited");
    assert.equal(restartedInvited.length, 2, "one invited notification per event athlete1 is invited to");
    assert.equal(restartedNotifications.json.notifications.filter((entry) => entry.notification_type === "attendance_event_occurrence_changed").length, 1);
    assert.equal(restartedNotifications.json.notifications.filter((entry) => entry.notification_type === "attendance_event_cancelled").length, 1);
    const restartedInvitedToA = restartedInvited.find((entry) => entry.notification_payload.event_id === eventAId);
    assert.notEqual(restartedInvitedToA.read_at_iso8601, null, "event A's invited notification, marked read earlier, must survive the restart as read");
  }
);
