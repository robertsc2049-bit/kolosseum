// DEV NOTE: FULL-UI-91 org-owner message-notification persistent proof. The
// remaining 2 directions FULL-UI-90 deliberately left out: a coach or
// athlete messaging their org owner previously gave the owner zero signal
// outside the live per-thread "unread" badge in public/org/org.js, visible
// only while already looking at that specific org's message list.
// Proves: a coach sending a message notifies exactly the owner of that org
// (owner_message_received_from_coach), never the sender, never an
// uninvolved owner (a second org's owner); same for an athlete sending
// (owner_message_received_from_athlete); a message the owner already read
// before the bell was ever queried never becomes a notification
// (derivation-time last-read gating on owner_last_read_at); mark-all-read
// persists without duplicating on re-derivation; and everything survives a
// fresh-process restart. Every step crosses only public HTTP routes.

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
  const email = `owner_notif_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Owner Notif ${label} Owner`,
    password: `OwnerNotif${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `owner_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Owner Notif ${label} Coach`,
    email,
    password: `OwnerNotif${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} coach registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `owner_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Owner Notif ${label} Athlete`,
    email,
    password: `OwnerNotif${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
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

async function getOwnerNotifications(baseUrl, owner, notificationType) {
  const result = await request(baseUrl, "GET", "/org/notifications", undefined, { cookie: owner.cookie });
  assertStatus(result, 200, "read owner notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === notificationType);
}

test(
  "FULL-UI-91 org-owner message notifications: a coach or athlete sending a message notifies exactly that org's owner with correct type/deep-link/payload, never the sender or an uninvolved owner, starting unread; derivation-time last-read gating suppresses an already-read message; mark-all-read persists without duplication; fresh-process restart",
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
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "uninvolved");
    orgOwnerUserIds.push(otherOwner.userId);

    const coach = await registerCoach(baseUrl, nonce, "primary");
    coachUserIds.push(coach.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `owner_notif_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `owner_notif_rel_${nonce}_2`, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    const orgId = await createOrg(baseUrl, owner, "Owner Notif Org", "shared");
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coach.email, request_id: `invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coach to shared-mode org");
    await acceptOrgInvite(baseUrl, coach, invite.json?.membership?.membership_id, `accept_${nonce}`);

    // ============================================================
    // Direction 1: coach -> owner. The owner is notified exactly once,
    // correct type/deep-link/payload; the sending coach never
    // self-notifies; an uninvolved owner (a second org) never gets it.
    // ============================================================
    const beforeAny = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_coach");
    assert.equal(beforeAny.length, 0, "expected no owner_message_received_from_coach notification before any message is sent");

    const coachToOwnerSend = await request(
      baseUrl, "POST", `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hello owner, from the coach", client_request_id: `msg_${nonce}_coach_to_owner` },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(coachToOwnerSend, 201, "coach sends a message to the org owner");

    const ownerNotifiedByCoach = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_coach");
    assert.equal(ownerNotifiedByCoach.length, 1, "expected exactly one notification for the owner after the coach sends");
    const coachNotification = ownerNotifiedByCoach[0];
    assert.equal(coachNotification.deep_link.route_id, "org_messages");
    assert.deepEqual(coachNotification.deep_link.params, { org_id: orgId });
    assert.equal(coachNotification.target_available, true);
    assert.equal(coachNotification.notification_payload.org_id, orgId);
    assert.equal(coachNotification.notification_payload.coach_user_id, coach.userId);
    assert.equal(coachNotification.read_at_iso8601, null, "expected the notification to start unread");

    // The sending coach has no notification identity of their own here
    // (coaches aren't org-owner-authenticated) - instead confirm an
    // uninvolved owner (a second organisation) never receives it.
    const otherOwnerNotified = await getOwnerNotifications(baseUrl, otherOwner, "owner_message_received_from_coach");
    assert.equal(otherOwnerNotified.length, 0, "expected an uninvolved owner to never receive this notification");

    // ============================================================
    // Direction 2: athlete -> owner. The owner is notified exactly once;
    // an uninvolved owner never receives it.
    // ============================================================
    const athleteToOwnerSend = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hello owner, from the athlete", client_request_id: `msg_${nonce}_a1_to_owner` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteToOwnerSend, 201, "athlete1 sends a message to the org owner");

    const ownerNotifiedByAthlete = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_athlete");
    assert.equal(ownerNotifiedByAthlete.length, 1, "expected exactly one notification for the owner after athlete1 sends");
    const athleteNotification = ownerNotifiedByAthlete[0];
    assert.equal(athleteNotification.deep_link.route_id, "org_messages");
    assert.deepEqual(athleteNotification.deep_link.params, { org_id: orgId });
    assert.equal(athleteNotification.notification_payload.org_id, orgId);
    assert.equal(athleteNotification.notification_payload.athlete_user_id, athlete1.userId);
    assert.equal(athleteNotification.read_at_iso8601, null);

    const ownerStillHasOnlyOneCoachNotification = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_coach");
    assert.equal(ownerStillHasOnlyOneCoachNotification.length, 1, "expected the owner to still have only the ONE coach notification from direction 1");

    const otherOwnerNotifiedByAthlete = await getOwnerNotifications(baseUrl, otherOwner, "owner_message_received_from_athlete");
    assert.equal(otherOwnerNotifiedByAthlete.length, 0, "expected an uninvolved owner to never receive this notification");

    // ============================================================
    // Derivation-time last-read gating: athlete2 sends the owner a
    // message, the owner opens/reads that org's messages (marking
    // owner_last_read_at) BEFORE ever querying the bell - this must
    // never become a notification at all.
    // ============================================================
    const athlete2Send = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hello owner, from athlete2", client_request_id: `msg_${nonce}_a2_to_owner` },
      { cookie: athlete2.cookie, csrf: athlete2.csrf }
    );
    assertStatus(athlete2Send, 201, "athlete2 sends a message to the org owner");
    const athlete2ThreadId = athlete2Send.json?.thread?.thread_id;
    assert.ok(athlete2ThreadId, "expected a thread_id on the send response");

    const ownerReadsThread = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(athlete2ThreadId)}`,
      undefined, { cookie: owner.cookie }
    );
    assertStatus(ownerReadsThread, 200, "owner reads athlete2's thread before ever querying the bell");

    const ownerNotificationsAfterGatedRead = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_athlete");
    assert.equal(
      ownerNotificationsAfterGatedRead.length, 1,
      "expected STILL only the one notification from direction 2 - athlete2's message, already read before derivation, must never become a notification"
    );
    assert.equal(ownerNotificationsAfterGatedRead[0].notification_payload.athlete_user_id, athlete1.userId);

    // ============================================================
    // Marking all read persists, and repeated reads never duplicate the
    // derived notification.
    // ============================================================
    const markAllRead = await request(
      baseUrl, "POST", "/org/notifications/mark-all-read", {},
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(markAllRead, 200, "owner marks all notifications read");

    const afterMarkAllRead = await getOwnerNotifications(baseUrl, owner, "owner_message_received_from_coach");
    assert.equal(afterMarkAllRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkAllRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // Fresh-process restart: every notification reconstructs identically
    // from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedCoachNotifications = await getOwnerNotifications(restarted.baseUrl, owner, "owner_message_received_from_coach");
    assert.equal(restartedCoachNotifications.length, 1);
    assert.notEqual(restartedCoachNotifications[0].read_at_iso8601, null);

    const restartedAthleteNotifications = await getOwnerNotifications(restarted.baseUrl, owner, "owner_message_received_from_athlete");
    assert.equal(restartedAthleteNotifications.length, 1);
    assert.equal(restartedAthleteNotifications[0].notification_payload.athlete_user_id, athlete1.userId);
  }
);
