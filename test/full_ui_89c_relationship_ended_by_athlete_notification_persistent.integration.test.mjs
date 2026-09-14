// DEV NOTE: FULL-UI-89 relationship-ended-by-athlete notification persistent
// proof. The symmetric reverse of relationship_revoked (which only ever
// notifies the athlete, regardless of who actually ended the relationship):
// when an athlete ends an accepted relationship themselves
// (POST /coach-workspace/relationships/:id/end -> athleteEndsRelationship),
// the coach previously had zero signal - only noticing on their next visit
// to the athlete list.
// Proves: an athlete ending the relationship notifies exactly that coach,
// unread, correctly deep-linking to the coach's own athlete list, carrying
// the departing athlete's identity as factual payload; a coach who instead
// revokes the SAME relationship type themselves (the pre-existing control)
// never receives this notification about their own action; an uninvolved
// coach never receives either; mark-read persists without duplication; and
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
  const email = `rel_ended_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Rel Ended Notif ${label} Coach`,
    email,
    password: `RelEndedNotif${label}Coach!2026`,
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
    { display_name: `Rel Ended Notif ${label} Coach`, email },
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
  const email = `rel_ended_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Rel Ended Notif ${label} Athlete`,
    email,
    password: `RelEndedNotif${label}Athlete!2026`,
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

async function getRelationshipEndedNotifications(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: actor.cookie });
  assertStatus(result, 200, "read notifications");
  return result.json.notifications.filter((entry) => entry.notification_type === "relationship_ended_by_athlete");
}

test(
  "FULL-UI-89 relationship-ended-by-athlete notification: an athlete ending the relationship themselves notifies their coach, a coach revoking the same relationship type themselves does not self-notify, an uninvolved coach never receives it, correct deep link/payload, starts unread, mark-read persists without duplication, fresh-process restart",
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

    const coach = await registerCoach(baseUrl, nonce, "primary");
    coachUserIds.push(coach.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "uninvolved");
    coachUserIds.push(otherCoach.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);

    const relationshipId1 = `rel_ended_notif_rel_${nonce}_1`;
    await seedRelationship(baseUrl, {
      relationshipId: relationshipId1, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    const relationshipId2 = `rel_ended_notif_rel_${nonce}_2`;
    await seedRelationship(baseUrl, {
      relationshipId: relationshipId2, coachUserId: coach.userId, athleteUserId: athlete2.userId, state: "accepted"
    });

    // ============================================================
    // Before either relationship ends, the coach has zero of these
    // notifications.
    // ============================================================
    const beforeAny = await getRelationshipEndedNotifications(baseUrl, coach);
    assert.equal(beforeAny.length, 0, "expected no relationship_ended_by_athlete notification before either relationship ends");

    // ============================================================
    // The COACH revokes the relationship with athlete2 themselves, via the
    // coach's own pre-existing control - this must NOT notify the coach
    // about their own action.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
        relationship_id: relationshipId2,
        coach_user_id: coach.userId,
        athlete_user_id: athlete2.userId,
        relationship_state: "revoked",
        relationship_scope: "individual_coach_athlete",
        accepted_at_iso8601: new Date().toISOString(),
        created_at_iso8601: new Date().toISOString(),
        updated_at_iso8601: new Date().toISOString(),
        revoked_at_iso8601: new Date().toISOString(),
        expires_at_iso8601: null
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      201,
      "coach revokes the relationship with athlete2 themselves"
    );

    const afterCoachRevoke = await getRelationshipEndedNotifications(baseUrl, coach);
    assert.equal(afterCoachRevoke.length, 0, "expected no self-notification when the coach revokes a relationship themselves");

    // ============================================================
    // Athlete1 ends the relationship themselves - the coach gets exactly
    // one notification, unread, deep-linking to their own athlete list,
    // carrying the departing athlete's identity.
    // ============================================================
    assertStatus(
      await request(
        baseUrl, "POST", `/coach-workspace/relationships/${encodeURIComponent(relationshipId1)}/end`, {},
        { cookie: athlete1.cookie, csrf: athlete1.csrf }
      ),
      200,
      "athlete1 ends the relationship themselves"
    );

    const afterAthleteEnds = await getRelationshipEndedNotifications(baseUrl, coach);
    assert.equal(afterAthleteEnds.length, 1, "expected exactly one notification after athlete1 ends the relationship");
    const notification = afterAthleteEnds[0];
    assert.equal(notification.deep_link.route_id, "coach_athletes");
    assert.deepEqual(notification.deep_link.params, {});
    assert.equal(notification.target_available, true);
    assert.equal(notification.notification_payload.athlete_user_id, athlete1.userId);
    assert.equal(notification.read_at_iso8601, null, "expected the notification to start unread");

    // An uninvolved coach never receives it.
    const otherCoachNotifications = await getRelationshipEndedNotifications(baseUrl, otherCoach);
    assert.equal(otherCoachNotifications.length, 0, "expected an uninvolved coach to never receive this notification");

    // The departing athlete never receives it either - this notification
    // is coach-facing only.
    const athleteResult = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete1.cookie });
    assertStatus(athleteResult, 200, "read athlete1 notifications");
    assert.equal(
      athleteResult.json.notifications.filter((entry) => entry.notification_type === "relationship_ended_by_athlete").length,
      0,
      "expected the departing athlete to never receive this coach-facing notification"
    );

    // ============================================================
    // Marking it read persists, and repeated reads never duplicate the
    // derived notification.
    // ============================================================
    const markRead = await request(
      baseUrl, "POST", `/account/notifications/${encodeURIComponent(notification.notification_id)}/read`, {},
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(markRead, 200, "coach marks the notification read");

    const afterMarkRead = await getRelationshipEndedNotifications(baseUrl, coach);
    assert.equal(afterMarkRead.length, 1, "expected still exactly one notification after repeated reads");
    assert.notEqual(afterMarkRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // Fresh-process restart: the notification reconstructs identically
    // from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await getRelationshipEndedNotifications(restarted.baseUrl, coach);
    assert.equal(restartedNotifications.length, 1);
    assert.equal(restartedNotifications[0].notification_payload.athlete_user_id, athlete1.userId);
    assert.notEqual(restartedNotifications[0].read_at_iso8601, null);
  }
);
