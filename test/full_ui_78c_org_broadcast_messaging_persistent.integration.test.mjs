// DEV NOTE: FULL-UI-78 org-owner broadcast messaging persistent proof.
// Proves one coach-broadcast call fans out into every currently-active
// coach's own org thread (readable back through their normal
// coach-workspace org-messages route), one athlete-broadcast call fans out
// into every currently-accepted athlete's own thread across those active
// coaches, that the athlete broadcast is rejected outright in an
// individual-mode org (even with an active coach and an accepted
// relationship in place) while the coach broadcast still works there, that
// empty/over-length body_text is rejected before any send, that an org
// owner with zero active coaches gets a clean zero-recipient result rather
// than an error, that an unauthenticated request and a different owner's
// org_id are both denied, and that everything survives a fresh-process
// restart. Every step crosses only public HTTP routes.

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
  const email = `broadcast_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Broadcast ${label} Owner`,
    password: `Broadcast${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `broadcast_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Broadcast ${label} Coach`,
    email,
    password: `Broadcast${label}Coach!2026`,
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
  const email = `broadcast_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Broadcast ${label} Athlete`,
    email,
    password: `Broadcast${label}Athlete!2026`,
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

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId }) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: now,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed accepted relationship ${relationshipId}`);
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

async function inviteAndAcceptCoach(baseUrl, owner, orgId, coach, requestIdSuffix) {
  const invite = await request(
    baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
    { coach_email: coach.email, request_id: `invite_${requestIdSuffix}` }, { cookie: owner.cookie, csrf: owner.csrf }
  );
  assertStatus(invite, 201, `invite ${coach.email} to org ${orgId}`);
  const acceptResult = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(invite.json?.membership?.membership_id)}/accept`,
    { request_id: `accept_${requestIdSuffix}` }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(acceptResult, 200, `${coach.email} accepts org membership`);
}

test(
  "Org-owner broadcast messaging: coach broadcast fans out to every active coach, athlete broadcast fans out to every accepted athlete in shared-visibility orgs only, validation rejections, zero-recipient result, unauthenticated and cross-owner denial, fresh-process restart",
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
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])`,
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
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
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
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const unrelatedAthlete = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(unrelatedAthlete.userId);

    await seedRelationship(baseUrl, { relationshipId: `bcast_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId });
    await seedRelationship(baseUrl, { relationshipId: `bcast_rel_${nonce}_b2`, coachUserId: coachB.userId, athleteUserId: athlete2.userId });

    // ============================================================
    // Shared-visibility org: coachA and coachB both active members.
    // ============================================================
    const sharedOrgId = await createOrg(baseUrl, owner, "Broadcast Shared Org", "shared");
    await inviteAndAcceptCoach(baseUrl, owner, sharedOrgId, coachA, `${nonce}_shared_a`);
    await inviteAndAcceptCoach(baseUrl, owner, sharedOrgId, coachB, `${nonce}_shared_b`);

    // ============================================================
    // A zero-coach org gets a clean zero-recipient result, not an error.
    // ============================================================
    const emptyOrgId = await createOrg(baseUrl, owner, "Broadcast Empty Org", "shared");
    const emptyBroadcast = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(emptyOrgId)}/broadcast/coaches`,
      { body_text: "Anyone out there?" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(emptyBroadcast, 201, "org with zero active coaches broadcasts to coaches");
    assert.equal(emptyBroadcast.json?.sent_count, 0);
    assert.deepEqual(emptyBroadcast.json?.coach_user_ids, []);

    // ============================================================
    // Validation: empty and over-length body_text are both rejected
    // before any send is attempted.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches`, { body_text: "   " }, { cookie: owner.cookie, csrf: owner.csrf }),
      400,
      "empty body_text is rejected"
    );
    assertStatus(
      await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches`, { body_text: "x".repeat(4001) }, { cookie: owner.cookie, csrf: owner.csrf }),
      400,
      "an over-length body_text is rejected"
    );

    // ============================================================
    // An unauthenticated request is rejected outright.
    // ============================================================
    assertStatus(
      await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches`, { body_text: "Hello" }, {}),
      401,
      "unauthenticated request is rejected"
    );

    // ============================================================
    // A different org owner cannot broadcast into this org.
    // ============================================================
    const crossOwnerAttempt = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches`,
      { body_text: "Hello" }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assertStatus(crossOwnerAttempt, 403, "a different org owner cannot broadcast into this org");
    assert.equal(crossOwnerAttempt.json?.error, "org_broadcast_messaging_organisation_access_denied");

    // ============================================================
    // Coach broadcast: fans out into every active coach's own thread.
    // ============================================================
    const coachBroadcastText = "All-coach update: new season kicks off Monday.";
    const coachBroadcast = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches`,
      { body_text: coachBroadcastText }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(coachBroadcast, 201, "owner broadcasts to active coaches");
    assert.equal(coachBroadcast.json?.sent_count, 2);
    assert.deepEqual([...coachBroadcast.json?.coach_user_ids].sort(), [coachA.userId, coachB.userId].sort());

    const coachBroadcastId = coachBroadcast.json?.broadcast_id;
    assert.ok(coachBroadcastId, "expected a coach broadcast_id");
    const coachThreadFor = (coachUserId) => coachBroadcast.json?.results?.find((entry) => entry.coach_user_id === coachUserId);

    const coachReadStatusBefore = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches/${encodeURIComponent(coachBroadcastId)}/read-status`,
      undefined, { cookie: owner.cookie }
    );
    assertStatus(coachReadStatusBefore, 200, "owner reads coach broadcast read-status before either coach opens it");
    assert.equal(coachReadStatusBefore.json?.read_count, 0, "neither coach has opened their thread yet");

    // coachA opens their own org thread, marking it read.
    const coachAThreadId = coachThreadFor(coachA.userId)?.thread_id;
    assert.ok(coachAThreadId, "expected a thread_id for coachA");
    const coachAOpensThread = await request(
      baseUrl, "GET", `/coach-workspace/org-messages/threads/${encodeURIComponent(coachAThreadId)}`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(coachAOpensThread, 200, "coachA reads their own org thread");
    assert.ok(coachAOpensThread.json?.messages?.some((message) => message.body_text === coachBroadcastText));

    const coachReadStatusAfter = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches/${encodeURIComponent(coachBroadcastId)}/read-status`,
      undefined, { cookie: owner.cookie }
    );
    assertStatus(coachReadStatusAfter, 200, "owner reads coach broadcast read-status after coachA opens it");
    assert.equal(coachReadStatusAfter.json?.read_count, 1, "only coachA should show as read");
    assert.equal(
      coachReadStatusAfter.json?.coaches?.find((entry) => entry.coach_user_id === coachA.userId)?.read,
      true
    );
    assert.equal(
      coachReadStatusAfter.json?.coaches?.find((entry) => entry.coach_user_id === coachB.userId)?.read,
      false
    );

    // ============================================================
    // Athlete broadcast: fans out into every accepted athlete's own
    // thread across the org's active coaches. unrelatedAthlete (no
    // accepted relationship with any active coach here) never receives it.
    // ============================================================
    const athleteBroadcastText = "All-athlete update: bring your own chalk this week.";
    const athleteBroadcast = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/athletes`,
      { body_text: athleteBroadcastText }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(athleteBroadcast, 201, "owner broadcasts to accepted athletes");
    assert.equal(athleteBroadcast.json?.sent_count, 2);
    assert.deepEqual([...athleteBroadcast.json?.athlete_user_ids].sort(), [athlete1.userId, athlete2.userId].sort());

    const athleteBroadcastId = athleteBroadcast.json?.broadcast_id;
    const athleteThreadFor = (athleteUserId) => athleteBroadcast.json?.results?.find((entry) => entry.athlete_user_id === athleteUserId);

    const athlete1ThreadId = athleteThreadFor(athlete1.userId)?.thread_id;
    assert.ok(athlete1ThreadId, "expected a thread_id for athlete1");
    const athlete1OpensThread = await request(
      baseUrl, "GET", `/messages/athlete/org-messages/threads/${encodeURIComponent(athlete1ThreadId)}`, undefined, { cookie: athlete1.cookie }
    );
    assertStatus(athlete1OpensThread, 200, "athlete1 reads their own org thread");
    assert.ok(athlete1OpensThread.json?.messages?.some((message) => message.body_text === athleteBroadcastText));

    const athleteReadStatusAfter = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/athletes/${encodeURIComponent(athleteBroadcastId)}/read-status`,
      undefined, { cookie: owner.cookie }
    );
    assertStatus(athleteReadStatusAfter, 200, "owner reads athlete broadcast read-status after athlete1 opens it");
    assert.equal(athleteReadStatusAfter.json?.read_count, 1, "only athlete1 should show as read");

    // unrelatedAthlete never received the broadcast - no thread at all.
    const unrelatedThreads = await request(baseUrl, "GET", "/messages/athlete/org-messages/threads", undefined, { cookie: unrelatedAthlete.cookie });
    assertStatus(unrelatedThreads, 200, "unrelatedAthlete reads own (empty) org-message thread list");
    assert.equal(unrelatedThreads.json?.threads?.length, 0, "unrelatedAthlete should have no org-message thread at all");

    // ============================================================
    // individual-mode org: coach broadcast still works (coaches are
    // messageable regardless of visibility mode), but the athlete
    // broadcast is rejected outright - even with an active coach and an
    // accepted relationship in place - matching
    // org_athlete_messaging_service.ts's own structural invariant.
    // ============================================================
    const individualOrgId = await createOrg(baseUrl, owner, "Broadcast Individual Org", "individual");
    await inviteAndAcceptCoach(baseUrl, owner, individualOrgId, coachA, `${nonce}_individual_a`);

    const individualCoachBroadcast = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/broadcast/coaches`,
      { body_text: "Individual-mode gym coach update" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(individualCoachBroadcast, 201, "coach broadcast still works in an individual-mode org");
    assert.equal(individualCoachBroadcast.json?.sent_count, 1);
    assert.deepEqual(individualCoachBroadcast.json?.coach_user_ids, [coachA.userId]);

    const individualAthleteBroadcast = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/broadcast/athletes`,
      { body_text: "Should never be accepted" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(individualAthleteBroadcast, 403, "athlete broadcast is rejected outright in an individual-mode org");
    assert.equal(individualAthleteBroadcast.json?.error, "org_broadcast_messaging_athletes_require_shared_visibility");

    // ============================================================
    // Deterministic compile output is completely unaffected.
    // ============================================================
    const fixture = JSON.parse(await fs.readFile(
      path.join(root, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json"), "utf8"
    ));
    const compileRoute = "/blocks/compile";
    const compileBefore = await request(baseUrl, "POST", compileRoute, { phase1_input: fixture });
    const compileAfter = await request(baseUrl, "POST", compileRoute, { phase1_input: fixture });
    assert.deepEqual(compileAfter.json, compileBefore.json, "Org broadcast messaging reads altered deterministic compile output.");

    // ============================================================
    // Fresh-process restart: broadcasts reconstruct identically from
    // Postgres, since nothing is cached in memory.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedCoachMessages = await request(
      restarted.baseUrl, "GET", `/coach-workspace/org-messages/threads/${encodeURIComponent(coachAThreadId)}`, undefined, { cookie: coachA.cookie }
    );
    assertStatus(restartedCoachMessages, 200, "coach broadcast thread after fresh-process restart");
    assert.ok(restartedCoachMessages.json?.messages?.some((message) => message.body_text === coachBroadcastText));

    const restartedCoachReadStatus = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/broadcast/coaches/${encodeURIComponent(coachBroadcastId)}/read-status`,
      undefined, { cookie: owner.cookie }
    );
    assertStatus(restartedCoachReadStatus, 200, "coach broadcast read-status after fresh-process restart");
    assert.equal(restartedCoachReadStatus.json?.read_count, 1, "the already-read state survives a fresh-process restart");

    const restartedAthleteMessages = await request(
      restarted.baseUrl, "GET", `/messages/athlete/org-messages/threads/${encodeURIComponent(athlete1ThreadId)}`, undefined, { cookie: athlete1.cookie }
    );
    assertStatus(restartedAthleteMessages, 200, "athlete broadcast thread after fresh-process restart");
    assert.ok(restartedAthleteMessages.json?.messages?.some((message) => message.body_text === athleteBroadcastText));
  }
);
