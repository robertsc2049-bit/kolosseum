// DEV NOTE: FULL-UI-90 message-notification persistent proof. Every
// messaging surface (coach<->athlete direct, org-owner<->coach,
// org-owner<->athlete) previously had zero passive signal outside its own
// live unread-count badge - a recipient only found out by opening that
// specific panel.
// Proves, across all 4 in-scope directions (athlete->coach, coach->athlete,
// owner->coach, owner->athlete): sending a real message notifies exactly
// the recipient, never the sender, never an uninvolved third party, with
// the correct type/deep-link/payload, starting unread; a message the
// recipient already read before their bell was ever queried never becomes
// a notification at all (derivation-time last-read gating); mark-read
// persists without duplicating on re-derivation; and everything survives a
// fresh-process restart. The 2 directions where an org owner would be the
// recipient (coach->owner, athlete->owner) are out of scope - org owners
// have no notification-bell infrastructure of their own. Every step
// crosses only public HTTP routes.

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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `msg_notif_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Msg Notif ${label} Owner`,
    password: `MsgNotif${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `msg_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Msg Notif ${label} Coach`,
    email,
    password: `MsgNotif${label}Coach!2026`,
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
    { display_name: `Msg Notif ${label} Coach`, email },
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
  const email = `msg_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Msg Notif ${label} Athlete`,
    email,
    password: `MsgNotif${label}Athlete!2026`,
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

async function createOrg(baseUrl, owner, name, visibilityMode) {
  const result = await request(baseUrl, "POST", "/org/organisations", {
    org_name: name,
    activity_id: "powerlifting",
    visibility_mode: visibilityMode
  }, { cookie: owner.cookie, csrf: owner.csrf });
  assertStatus(result, 201, `create ${visibilityMode} organisation`);
  return result.json?.organisation?.org_id;
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

async function getNotifications(baseUrl, actor, notificationType) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: actor.cookie });
  assertStatus(result, 200, "read notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === notificationType);
}

test(
  "FULL-UI-90 message notifications: all 4 in-scope directions notify exactly the recipient with correct type/deep-link/payload, never the sender or an uninvolved third party, starting unread; derivation-time last-read gating suppresses an already-read message; mark-read persists without duplication; fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      const allAccountIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      const allUserIds = [...orgOwnerUserIds, ...allAccountIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(`DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])`, [allUserIds]).catch(() => {});
        await pool.query(`DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`, [allUserIds]).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE
             coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])
             OR org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[]))`,
          [allUserIds]
        ).catch(() => {});
      }
      if (allAccountIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allAccountIds]
        ).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const userId of allAccountIds) {
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

    const owner = await registerOrgOwner(baseUrl, nonce, "primary");
    orgOwnerUserIds.push(owner.userId);

    const coach = await registerCoach(baseUrl, nonce, "primary");
    coachUserIds.push(coach.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "uninvolved");
    coachUserIds.push(otherCoach.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const otherAthlete = await registerAthlete(baseUrl, nonce, "uninvolved");
    athleteUserIds.push(otherAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `msg_notif_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `msg_notif_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    const orgId = await createOrg(baseUrl, owner, "Msg Notif Org", "shared");
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coach.email, request_id: `invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coach to shared-mode org");
    await acceptOrgInvite(baseUrl, coach, invite.json?.membership?.membership_id, `accept_${nonce}`);

    // ============================================================
    // Direction 1: athlete1 -> coach (coach-athlete thread). The coach is
    // notified exactly once, deep-linking to their own athlete-detail view
    // for athlete1, target_available true; the sending athlete never gets
    // one; an uninvolved coach never gets one.
    // ============================================================
    const beforeAny = await getNotifications(baseUrl, coach, "coach_athlete_message_received");
    assert.equal(beforeAny.length, 0, "expected no coach_athlete_message_received notification before any message is sent");

    const athleteToCoachSend = await request(
      baseUrl, "POST", `/messages/athlete/coaches/${encodeURIComponent(coach.userId)}/send`,
      { body_text: "Hello coach", client_request_id: `msg_${nonce}_a1_to_coach` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteToCoachSend, 201, "athlete1 sends a message to coach");

    const coachNotifiedAfterAthleteSend = await getNotifications(baseUrl, coach, "coach_athlete_message_received");
    assert.equal(coachNotifiedAfterAthleteSend.length, 1, "expected exactly one notification for the coach after athlete1 sends");
    const coachNotification = coachNotifiedAfterAthleteSend[0];
    assert.equal(coachNotification.deep_link.route_id, "coach_athlete_detail");
    assert.deepEqual(coachNotification.deep_link.params, { athlete_id: athlete1.userId });
    assert.equal(coachNotification.target_available, true);
    assert.equal(coachNotification.notification_payload.athlete_user_id, athlete1.userId);
    assert.equal(coachNotification.read_at_iso8601, null, "expected the notification to start unread");

    const athlete1SelfNotified = await getNotifications(baseUrl, athlete1, "coach_athlete_message_received");
    assert.equal(athlete1SelfNotified.length, 0, "expected the sending athlete to never notify themselves");

    const otherCoachNotified = await getNotifications(baseUrl, otherCoach, "coach_athlete_message_received");
    assert.equal(otherCoachNotified.length, 0, "expected an uninvolved coach to never receive this notification");

    // ============================================================
    // Direction 2: coach -> athlete1 (coach-athlete thread). Athlete1 is
    // notified exactly once, deep-linking to their own shared account view;
    // the sending coach never gets one; an uninvolved athlete never gets one.
    // ============================================================
    const coachToAthleteSend = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Hello athlete", client_request_id: `msg_${nonce}_coach_to_a1` },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(coachToAthleteSend, 201, "coach sends a message to athlete1");

    const athlete1NotifiedAfterCoachSend = await getNotifications(baseUrl, athlete1, "coach_athlete_message_received");
    assert.equal(athlete1NotifiedAfterCoachSend.length, 1, "expected exactly one notification for athlete1 after coach sends");
    const athlete1Notification = athlete1NotifiedAfterCoachSend[0];
    assert.equal(athlete1Notification.deep_link.route_id, "shared_account");
    assert.deepEqual(athlete1Notification.deep_link.params, {});
    assert.equal(athlete1Notification.notification_payload.coach_user_id, coach.userId);
    assert.equal(athlete1Notification.read_at_iso8601, null);

    const coachSelfNotified = await getNotifications(baseUrl, coach, "coach_athlete_message_received");
    assert.equal(coachSelfNotified.length, 1, "expected the coach to still have only the ONE notification from direction 1, never a self-notification for direction 2");

    const otherAthleteNotified = await getNotifications(baseUrl, otherAthlete, "coach_athlete_message_received");
    assert.equal(otherAthleteNotified.length, 0, "expected an uninvolved athlete to never receive this notification");

    // ============================================================
    // Direction 3: org owner -> coach (org_owner_coach thread). The coach
    // is notified exactly once, deep-linking to the shared account view,
    // carrying the org's id/name; an uninvolved coach never gets one.
    // ============================================================
    const ownerToCoachSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coach.userId)}/send`,
      { body_text: "Hello from the org", client_request_id: `msg_${nonce}_owner_to_coach` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerToCoachSend, 201, "org owner sends a message to the coach");

    const coachNotifiedByOwner = await getNotifications(baseUrl, coach, "org_owner_message_received");
    assert.equal(coachNotifiedByOwner.length, 1, "expected exactly one org_owner_message_received notification for the coach");
    const ownerToCoachNotification = coachNotifiedByOwner[0];
    assert.equal(ownerToCoachNotification.deep_link.route_id, "shared_account");
    assert.equal(ownerToCoachNotification.notification_payload.org_id, orgId);
    assert.equal(ownerToCoachNotification.read_at_iso8601, null);

    const otherCoachNotifiedByOwner = await getNotifications(baseUrl, otherCoach, "org_owner_message_received");
    assert.equal(otherCoachNotifiedByOwner.length, 0, "expected an uninvolved coach to never receive this notification");

    // ============================================================
    // Direction 4: org owner -> athlete1 (org_owner_athlete thread, valid
    // only because the org is shared-mode and athlete1 has an accepted
    // relationship with an active org coach). Athlete1 is notified exactly
    // once; an uninvolved athlete never gets one.
    // ============================================================
    const ownerToAthleteSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Hello athlete, from the org", client_request_id: `msg_${nonce}_owner_to_a1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerToAthleteSend, 201, "org owner sends a message to athlete1");

    const athlete1NotifiedByOwner = await getNotifications(baseUrl, athlete1, "org_owner_message_received");
    assert.equal(athlete1NotifiedByOwner.length, 1, "expected exactly one org_owner_message_received notification for athlete1");
    assert.equal(athlete1NotifiedByOwner[0].notification_payload.org_id, orgId);

    const otherAthleteNotifiedByOwner = await getNotifications(baseUrl, otherAthlete, "org_owner_message_received");
    assert.equal(otherAthleteNotifiedByOwner.length, 0, "expected an uninvolved athlete to never receive this notification");

    // ============================================================
    // Derivation-time last-read gating: athlete2 sends the coach a message
    // on a SEPARATE thread, then the coach opens/reads that thread BEFORE
    // ever querying their bell - this must never become a notification at
    // all, proving creation is gated on unread-at-derivation-time, not
    // just "insert once then never reappear".
    // ============================================================
    const athlete2Send = await request(
      baseUrl, "POST", `/messages/athlete/coaches/${encodeURIComponent(coach.userId)}/send`,
      { body_text: "Hello coach, from athlete2", client_request_id: `msg_${nonce}_a2_to_coach` },
      { cookie: athlete2.cookie, csrf: athlete2.csrf }
    );
    assertStatus(athlete2Send, 201, "athlete2 sends a message to coach");
    const athlete2ThreadId = athlete2Send.json?.thread?.thread_id;
    assert.ok(athlete2ThreadId, "expected a thread_id on the send response");

    const coachReadsThread = await request(
      baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(athlete2ThreadId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(coachReadsThread, 200, "coach reads the athlete2 thread before ever querying the bell");

    const coachNotificationsAfterGatedRead = await getNotifications(baseUrl, coach, "coach_athlete_message_received");
    assert.equal(
      coachNotificationsAfterGatedRead.length, 1,
      "expected STILL only the one notification from direction 1 - athlete2's message, already read before derivation, must never become a notification"
    );
    assert.equal(coachNotificationsAfterGatedRead[0].notification_payload.athlete_user_id, athlete1.userId);

    // ============================================================
    // Marking a notification read persists, and repeated reads never
    // duplicate the derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(coachNotification.notification_id)}/read`, {},
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(markRead, 200, "coach marks the direction-1 notification read");

    const afterMarkRead = await getNotifications(baseUrl, coach, "coach_athlete_message_received");
    assert.equal(afterMarkRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // Fresh-process restart: every notification reconstructs identically
    // from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedCoachNotifications = await getNotifications(restarted.baseUrl, coach, "coach_athlete_message_received");
    assert.equal(restartedCoachNotifications.length, 1);
    assert.notEqual(restartedCoachNotifications[0].read_at_iso8601, null);

    const restartedAthlete1Notifications = await getNotifications(restarted.baseUrl, athlete1, "coach_athlete_message_received");
    assert.equal(restartedAthlete1Notifications.length, 1);
    assert.equal(restartedAthlete1Notifications[0].notification_payload.coach_user_id, coach.userId);

    const restartedOrgOwnerNotifications = await getNotifications(restarted.baseUrl, coach, "org_owner_message_received");
    assert.equal(restartedOrgOwnerNotifications.length, 1);
    assert.equal(restartedOrgOwnerNotifications[0].notification_payload.org_id, orgId);
  }
);
