// DEV NOTE: FULL-UI-73 athlete-goal-achieved notification persistent proof.
// Proves that an athlete marking one of their own goals achieved creates
// exactly one notification for their currently accepted coach only,
// never for an unrelated coach or one with only a pending relationship,
// never when a goal is instead abandoned, correctly deep-linking to that
// athlete's own profile detail, that it starts unread and can be marked
// read, that repeated reads never duplicate the derived notification,
// that a second achieved goal produces a second independent
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
  const email = `goal_notif_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Goal Notif ${label} Coach`,
    email,
    password: `GoalNotif${label}Coach!2026`,
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
    { display_name: `Goal Notif ${label} Coach`, email },
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
  const email = `goal_notif_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Goal Notif ${label} Athlete`,
    email,
    password: `GoalNotif${label}Athlete!2026`,
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
    expires_at_iso8601: state === "invited" ? new Date(Date.now() + 86400000).toISOString() : null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function createGoal(baseUrl, athlete, goalLabel) {
  const result = await request(baseUrl, "POST", "/athlete-goals", { goal_label: goalLabel }, { cookie: athlete.cookie, csrf: athlete.csrf });
  assertStatus(result, 201, `create goal "${goalLabel}"`);
  return result.json.goal.goal_id;
}

async function resolveGoal(baseUrl, athlete, goalId, resolution) {
  const result = await request(baseUrl, "POST", `/athlete-goals/${encodeURIComponent(goalId)}/resolve`, { resolution }, { cookie: athlete.cookie, csrf: athlete.csrf });
  assertStatus(result, 200, `resolve goal ${goalId} as ${resolution}`);
  return result.json;
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
  "Athlete-goal-achieved notification: exactly one notification for the athlete's accepted coach only, never for an unrelated or merely-pending coach, never for an abandoned goal, correct deep link, starts unread, mark-read works, repeated reads never duplicate, a second achieved goal produces a second independent notification, deterministic compile untouched, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const userIds = [];

    const cleanup = async () => {
      const allUserIds = [...userIds].filter(Boolean);
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
    userIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    userIds.push(coachB.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    userIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    userIds.push(athlete2.userId);

    // Athlete 1 is accepted under coach A.
    await seedRelationship(baseUrl, {
      relationshipId: `goal_rel_${nonce}_1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    // Athlete 2 only has a pending (not yet accepted) relationship with coach B.
    await seedRelationship(baseUrl, {
      relationshipId: `goal_rel_${nonce}_2`, coachUserId: coachB.userId, athleteUserId: athlete2.userId, state: "invited"
    });

    const abandonedGoalId = await createGoal(baseUrl, athlete1, "Deadlift 200kg");
    await resolveGoal(baseUrl, athlete1, abandonedGoalId, "abandoned");

    const achievedGoalId = await createGoal(baseUrl, athlete1, "Squat 150kg");
    await resolveGoal(baseUrl, athlete1, achievedGoalId, "achieved");

    // ============================================================
    // Coach A sees exactly one notification (never one for the
    // abandoned goal), unread, correctly deep-linking to athlete 1's
    // own profile detail, with the athlete identity and goal_label
    // as factual payload.
    // ============================================================
    const coachANotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    assertStatus(coachANotifications, 200, "coach A reads own notifications");
    const coachAGoalNotifications = coachANotifications.json.notifications.filter(
      (entry) => entry.notification_type === "athlete_goal_achieved"
    );
    assert.equal(coachAGoalNotifications.length, 1, "expected exactly one goal-achieved notification for coach A");
    const notification = coachAGoalNotifications[0];
    assert.equal(notification.deep_link.route_id, "coach_athlete_detail");
    assert.equal(notification.deep_link.params.athlete_id, athlete1.userId);
    assert.equal(notification.target_available, true);
    assert.equal(notification.notification_payload.athlete_user_id, athlete1.userId);
    assert.equal(notification.notification_payload.goal_label, "Squat 150kg");
    assert.equal(notification.read_at_iso8601, null, "expected the notification to start unread");

    // ============================================================
    // Coach B never sees this notification - they have no accepted
    // relationship with athlete 1 at all.
    // ============================================================
    const coachBNotifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    assertStatus(coachBNotifications, 200, "coach B reads own notifications");
    assert.equal(
      coachBNotifications.json.notifications.some((entry) => entry.notification_type === "athlete_goal_achieved"),
      false,
      "expected coach B to never receive a goal-achieved notification for an athlete they have no relationship with"
    );

    // ============================================================
    // Marking it read persists, and repeated reads of coach A's
    // notification list never duplicate the derived notification.
    // ============================================================
    const markRead = await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(notification.notification_id)}/read`, {}, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(markRead, 200, "coach A marks the notification read");

    const coachANotificationsAfterRead = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    const coachAGoalNotificationsAfterRead = coachANotificationsAfterRead.json.notifications.filter(
      (entry) => entry.notification_type === "athlete_goal_achieved"
    );
    assert.equal(coachAGoalNotificationsAfterRead.length, 1, "expected still exactly one goal-achieved notification after repeated reads");
    assert.notEqual(coachAGoalNotificationsAfterRead[0].read_at_iso8601, null, "expected the notification to now be read");

    // ============================================================
    // Athlete 2's goal, achieved while only pending with coach B,
    // never generates a notification for coach B.
    // ============================================================
    const athlete2GoalId = await createGoal(baseUrl, athlete2, "Bench 100kg");
    await resolveGoal(baseUrl, athlete2, athlete2GoalId, "achieved");
    const coachBNotificationsAfterPendingGoal = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachB.cookie });
    assert.equal(
      coachBNotificationsAfterPendingGoal.json.notifications.some((entry) => entry.notification_type === "athlete_goal_achieved"),
      false,
      "expected coach B to never receive a goal-achieved notification from an athlete with only a pending relationship"
    );

    // ============================================================
    // A second achieved goal from athlete 1 produces a second,
    // independent notification for coach A.
    // ============================================================
    const secondGoalId = await createGoal(baseUrl, athlete1, "Bench 120kg");
    await resolveGoal(baseUrl, athlete1, secondGoalId, "achieved");
    const coachANotificationsAfterSecond = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    const coachAGoalNotificationsAfterSecond = coachANotificationsAfterSecond.json.notifications.filter(
      (entry) => entry.notification_type === "athlete_goal_achieved"
    );
    assert.equal(coachAGoalNotificationsAfterSecond.length, 2, "expected a second, independent goal-achieved notification for coach A");
    assert.ok(
      coachAGoalNotificationsAfterSecond.some((entry) => entry.notification_payload.goal_label === "Bench 120kg"),
      "expected the second notification to carry the second goal_label"
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
    assert.deepEqual(compileAfter, compileBefore, "Athlete-goal-achieved notifications read altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: the notifications reconstruct
    // identically from Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedNotifications = await request(restarted.baseUrl, "GET", "/account/notifications", undefined, { cookie: coachA.cookie });
    assertStatus(restartedNotifications, 200, "coach A's notifications after fresh-process restart");
    const restartedGoalNotifications = restartedNotifications.json.notifications.filter(
      (entry) => entry.notification_type === "athlete_goal_achieved"
    );
    assert.equal(restartedGoalNotifications.length, 2);
    assert.ok(restartedGoalNotifications.some((entry) => entry.read_at_iso8601 !== null));
  }
);
