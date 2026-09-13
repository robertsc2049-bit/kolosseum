// DEV NOTE: FULL-UI-87 attendance-rsvp-declined notification persistent
// proof. The symmetric reverse of attendance_events_notifications_
// persistent.integration.test.mjs's athlete-facing trio: an invited
// athlete's "not attending" RSVP previously left the organizing coach
// with zero passive signal - only a manual roster check. Proves: an
// invited athlete's not_attending RSVP creates exactly one notification
// for the organizing coach, unread, correctly deep-linking to the
// coach's own attendance view, carrying the declining athlete/event/
// occurrence identity as factual payload; an "attending" RSVP from a
// DIFFERENT athlete on the same occurrence never notifies; a coach not
// organizing the event never receives it; mark-read persists without
// duplication; a second, later flip back to not_attending on a
// different occurrence produces a second independent notification; and
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
  const email = `rsvp_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Rsvp Notif ${label} Coach`,
    email,
    password: `RsvpNotif${label}Coach!2026`,
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
    { display_name: `Rsvp Notif ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);
  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/accessibility",
    { accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false } },
    { cookie, csrf }
  ), 200, `${label} coach onboarding accessibility`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `rsvp_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Rsvp Notif ${label} Athlete`,
    email,
    password: `RsvpNotif${label}Athlete!2026`,
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

async function getRsvpDeclinedNotifications(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: actor.cookie });
  assertStatus(result, 200, "read notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === "attendance_rsvp_declined");
}

test(
  "FULL-UI-87 attendance-rsvp-declined notification: an invited athlete's not_attending RSVP notifies the organizing coach, an attending RSVP from another athlete never notifies, a non-organizing coach never receives it, correct deep link/payload, starts unread, mark-read persists without duplication, a second decline on a different occurrence produces a second independent notification, fresh-process restart",
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
    let address = server.address();
    let baseUrl = `http://127.0.0.1:${address.port}`;

    const organizer = await registerCoach(baseUrl, nonce, "organizer");
    coachUserIds.push(organizer.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "other");
    coachUserIds.push(otherCoach.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `rsvp_rel_${nonce}_1`, coachUserId: organizer.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `rsvp_rel_${nonce}_2`, coachUserId: organizer.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    // ============================================================
    // A 2-occurrence weekly series, both athletes invited.
    // ============================================================
    const event = await request(baseUrl, "POST", "/attendance-events", {
      title: "RSVP Notif Event", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["mon"], ends: { type: "after_count", value: 2 } },
      athlete_user_ids: [athlete1.userId, athlete2.userId]
    }, { cookie: organizer.cookie, csrf: organizer.csrf });
    assertStatus(event, 201, "organizer creates the event");
    const eventId = event.json?.event?.event_id;
    const [occurrence0, occurrence1] = event.json.occurrences;

    // ============================================================
    // Before any RSVP, the organizer has zero of these notifications.
    // ============================================================
    const beforeAny = await getRsvpDeclinedNotifications(baseUrl, organizer);
    assert.equal(beforeAny.length, 0, "expected no attendance_rsvp_declined notification before any RSVP");

    // ============================================================
    // athlete2 RSVPs "attending" to occurrence 0 - never notifies.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrence0.occurrence_id)}/rsvp`, { rsvp_state: "attending" }, { cookie: athlete2.cookie, csrf: athlete2.csrf }),
      201,
      "athlete2 RSVPs attending to occurrence 0"
    );
    const afterAttending = await getRsvpDeclinedNotifications(baseUrl, organizer);
    assert.equal(afterAttending.length, 0, "an attending RSVP must never notify");

    // ============================================================
    // athlete1 RSVPs "not_attending" to occurrence 0 - the organizer
    // gets exactly one notification, unread, deep-linking to their own
    // attendance view, carrying the declining athlete/event/occurrence
    // identity.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrence0.occurrence_id)}/rsvp`, { rsvp_state: "not_attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }),
      201,
      "athlete1 RSVPs not_attending to occurrence 0"
    );

    const afterFirstDecline = await getRsvpDeclinedNotifications(baseUrl, organizer);
    assert.equal(afterFirstDecline.length, 1, "expected exactly one notification after athlete1's decline");
    const firstNotification = afterFirstDecline[0];
    assert.equal(firstNotification.deep_link.route_id, "coach_attendance_events");
    assert.equal(firstNotification.target_available, true);
    assert.equal(firstNotification.notification_payload.athlete_user_id, athlete1.userId);
    assert.equal(firstNotification.notification_payload.event_id, eventId);
    assert.equal(firstNotification.notification_payload.occurrence_id, occurrence0.occurrence_id);
    assert.equal(firstNotification.read_at_iso8601, null, "expected the notification to start unread");

    // A coach not organizing this event never receives it.
    const otherCoachNotifications = await getRsvpDeclinedNotifications(baseUrl, otherCoach);
    assert.equal(otherCoachNotifications.length, 0, "expected a non-organizing coach to never receive this notification");

    // ============================================================
    // Marking it read persists, and repeated reads never duplicate
    // the derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(firstNotification.notification_id)}/read`, {},
      { cookie: organizer.cookie, csrf: organizer.csrf }
    );
    assertStatus(markRead, 200, "organizer marks the notification read");

    const afterMarkRead = await getRsvpDeclinedNotifications(baseUrl, organizer);
    assert.equal(afterMarkRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // athlete1 also declines occurrence 1 - a second, independent
    // notification.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrence1.occurrence_id)}/rsvp`, { rsvp_state: "not_attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }),
      201,
      "athlete1 RSVPs not_attending to occurrence 1"
    );

    const afterSecondDecline = await getRsvpDeclinedNotifications(baseUrl, organizer);
    assert.equal(afterSecondDecline.length, 2, "expected a second, independent notification for the second decline");
    const secondNotification = afterSecondDecline.find((entry) => entry.notification_payload.occurrence_id === occurrence1.occurrence_id);
    assert.ok(secondNotification, "expected a notification for occurrence 1's decline");
    assert.equal(secondNotification.read_at_iso8601, null, "expected the second notification to start unread independently");

    // ============================================================
    // Fresh-process restart: both notifications reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await getRsvpDeclinedNotifications(restarted.baseUrl, organizer);
    assert.equal(restartedNotifications.length, 2);
    assert.ok(restartedNotifications.some((entry) => entry.notification_payload.occurrence_id === occurrence0.occurrence_id && entry.read_at_iso8601 !== null));
    assert.ok(restartedNotifications.some((entry) => entry.notification_payload.occurrence_id === occurrence1.occurrence_id && entry.read_at_iso8601 === null));
  }
);
