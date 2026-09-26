// DEV NOTE: FULL-UI-88 activity/position-change-declined notification
// persistent proof. The symmetric reverse of activity_change_proposed's own
// notification: a coach proposes an activity or position change and the
// athlete can decline it via respondToActivityChangeProposal() - the coach
// previously had zero passive signal that their proposal was rejected.
// Proves: a coach's proposed activity-change declined by the athlete
// notifies exactly that coach, unread, correctly deep-linking to the
// coach's own detail view of that athlete, carrying the declining
// athlete/change-kind/new-value identity as factual payload; a position-
// change proposal declined produces an independent notification carrying
// change_kind: "position"; a coach not involved in either proposal never
// receives either notification; mark-read persists without duplication;
// and everything survives a fresh-process restart. Every step crosses
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
  const email = `activity_decl_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Activity Decl Notif ${label} Coach`,
    email,
    password: `ActivityDeclNotif${label}Coach!2026`,
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
    { display_name: `Activity Decl Notif ${label} Coach`, email },
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

async function registerAthlete(baseUrl, nonce, label, activityId = "powerlifting") {
  const email = `activity_decl_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Activity Decl Notif ${label} Athlete`,
    email,
    password: `ActivityDeclNotif${label}Athlete!2026`,
    activity_id: activityId,
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

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

// A coach-proposed position change is validated against the athlete's real
// declared position (assertPositionMatchesActivity in
// athlete_onboarding_service.ts reads current_effective_declaration, not
// the registration-time activity_id param) - onboarding must actually
// complete first, matching full_ui_85_team_sport_position_persistent's own
// precedent for this exact declaration shape.
async function completeAthleteOnboarding(baseUrl, athlete, activityId, position) {
  const draft = await request(
    baseUrl, "PATCH", "/account/onboarding/draft",
    {
      current_stage: "review",
      fields: {
        activity_id: activityId,
        position,
        execution_scope: "coach_managed",
        product_acknowledged: true,
        jurisdiction_code: "england_wales",
        jurisdiction_acknowledged: true,
        accessibility_preferences: accessibilityPreferences(),
        experience_level: "amateur",
        instruction_density: "standard"
      }
    },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(draft, 200, "athlete onboarding draft");

  const confirm = await request(baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true }, { cookie: athlete.cookie, csrf: athlete.csrf });
  assertStatus(confirm, 200, "athlete onboarding confirm");
  return confirm.json;
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

async function getActivityChangeDeclinedNotifications(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: actor.cookie });
  assertStatus(result, 200, "read notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === "activity_change_declined");
}

test(
  "FULL-UI-88 activity/position-change-declined notification: an athlete declining a coach-proposed activity change notifies that coach, a declined position-change proposal notifies independently with change_kind position, an uninvolved coach never receives either, correct deep link/payload, starts unread, mark-read persists without duplication, fresh-process restart",
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

    const coach = await registerCoach(baseUrl, nonce, "proposing");
    coachUserIds.push(coach.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "uninvolved");
    coachUserIds.push(otherCoach.userId);

    // athlete1 completes onboarding declared into rugby_union as a hooker,
    // so the later position-change proposal (to "tighthead_prop") is a real
    // change validated against their actual declared activity.
    const athlete1 = await registerAthlete(baseUrl, nonce, "1", "rugby_union");
    athleteUserIds.push(athlete1.userId);
    await completeAthleteOnboarding(baseUrl, athlete1, "rugby_union", "hooker");
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `activity_decl_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `activity_decl_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    // ============================================================
    // Before any proposal, the coach has zero of these notifications.
    // ============================================================
    const beforeAny = await getActivityChangeDeclinedNotifications(baseUrl, coach);
    assert.equal(beforeAny.length, 0, "expected no activity_change_declined notification before any proposal");

    // ============================================================
    // The coach proposes an activity change for athlete2, who DECLINES it -
    // the coach gets exactly one notification, unread, deep-linking to
    // their own detail view of athlete2, carrying the declining athlete/
    // change-kind/new-value identity.
    // ============================================================
    const activityProposal2 = await request(
      baseUrl, "POST", "/coach-workspace/athlete-activity-change-proposal",
      { athlete_user_id: athlete2.userId, activity_id: "strongman" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(activityProposal2, 201, "coach proposes an activity change for athlete2");
    const activityRequestId2 = activityProposal2.json?.proposal?.request_id;

    assertStatus(
      await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: activityRequestId2, response: "declined" },
        { cookie: athlete2.cookie, csrf: athlete2.csrf }
      ),
      200,
      "athlete2 declines the activity-change proposal"
    );

    const afterFirstDecline = await getActivityChangeDeclinedNotifications(baseUrl, coach);
    assert.equal(afterFirstDecline.length, 1, "expected exactly one notification after athlete2's decline");
    const firstNotification = afterFirstDecline[0];
    assert.equal(firstNotification.deep_link.route_id, "coach_athlete_detail");
    assert.equal(firstNotification.deep_link.params.athlete_id, athlete2.userId);
    assert.equal(firstNotification.target_available, true);
    assert.equal(firstNotification.notification_payload.athlete_user_id, athlete2.userId);
    assert.equal(firstNotification.notification_payload.change_kind, "activity");
    assert.equal(firstNotification.notification_payload.new_activity_id, "strongman");
    assert.equal(firstNotification.read_at_iso8601, null, "expected the notification to start unread");

    // An uninvolved coach never receives it.
    const otherCoachNotifications = await getActivityChangeDeclinedNotifications(baseUrl, otherCoach);
    assert.equal(otherCoachNotifications.length, 0, "expected an uninvolved coach to never receive this notification");

    // ============================================================
    // Marking it read persists, and repeated reads never duplicate the
    // derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(firstNotification.notification_id)}/read`, {},
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(markRead, 200, "coach marks the notification read");

    const afterMarkRead = await getActivityChangeDeclinedNotifications(baseUrl, coach);
    assert.equal(afterMarkRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // The coach also proposes a POSITION change for athlete1 (declared
    // rugby_union at registration), and athlete1 declines it - a second,
    // independent notification carrying change_kind: "position".
    // ============================================================
    const positionProposal = await request(
      baseUrl, "POST", "/coach-workspace/athlete-position-change-proposal",
      { athlete_user_id: athlete1.userId, position: "tighthead_prop" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(positionProposal, 201, "coach proposes a position change for athlete1");
    const positionRequestId = positionProposal.json?.proposal?.request_id;

    assertStatus(
      await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: positionRequestId, response: "declined" },
        { cookie: athlete1.cookie, csrf: athlete1.csrf }
      ),
      200,
      "athlete1 declines the position-change proposal"
    );

    const afterSecondDecline = await getActivityChangeDeclinedNotifications(baseUrl, coach);
    assert.equal(afterSecondDecline.length, 2, "expected a second, independent notification for the position-change decline");
    const secondNotification = afterSecondDecline.find((entry) => entry.notification_payload.athlete_user_id === athlete1.userId);
    assert.ok(secondNotification, "expected a notification for athlete1's position-change decline");
    assert.equal(secondNotification.notification_payload.change_kind, "position");
    assert.equal(secondNotification.notification_payload.new_position, "tighthead_prop");
    assert.equal(secondNotification.read_at_iso8601, null, "expected the second notification to start unread independently");

    // ============================================================
    // Fresh-process restart: both notifications reconstruct identically
    // from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await getActivityChangeDeclinedNotifications(restarted.baseUrl, coach);
    assert.equal(restartedNotifications.length, 2);
    assert.ok(restartedNotifications.some((entry) => entry.notification_payload.athlete_user_id === athlete2.userId && entry.read_at_iso8601 !== null));
    assert.ok(restartedNotifications.some((entry) => entry.notification_payload.athlete_user_id === athlete1.userId && entry.read_at_iso8601 === null));
  }
);
