// DEV NOTE: Part D.4 - org-owner<->athlete messaging lifecycle proof.
// Proves the gate is genuinely two-part: an 'individual'-mode org has no
// messaging path to any athlete at all (structural, not "no athletes
// yet"), while a 'shared'-mode org can message an athlete only while that
// athlete holds a currently-accepted relationship with one of the org's
// currently-active coaches. A thread is created lazily on first send,
// idempotent replay via client_request_id does not duplicate, existing
// history remains readable after the gate later closes, cross-account
// isolation holds, and all of this survives a fresh-process restart.
// Every step crosses only public HTTP routes.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test, { after } from "node:test";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import ffmpeg from "@ffmpeg-installer/ffmpeg";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { STORAGE_ROOT } from "../dist/src/api/message_attachment_storage.js";

const execFileAsync = promisify(execFile);

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
      "attachment",
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

function tinyJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

async function generateTinyMp4(root) {
  const outputPath = path.join(root, `tmp_test_attachment_${crypto.randomUUID()}.mp4`);
  await execFileAsync(ffmpeg.path, [
    "-y", "-f", "lavfi", "-i", "color=c=blue:s=64x64:d=1",
    "-pix_fmt", "yuv420p", outputPath
  ]);
  return outputPath;
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
  const email = `org_ath_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Ath ${label} Owner`,
    password: `OrgAth${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_ath_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Ath ${label} Coach`,
    email,
    password: `OrgAth${label}Coach!2026`,
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
  const email = `org_ath_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Org Ath ${label} Athlete`,
    email,
    password: `OrgAth${label}Athlete!2026`,
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
  const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: (state === "revoked" || state === "declined") ? now : null,
    expires_at_iso8601: state === "invited" ? farFuture : null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

async function createOrg(baseUrl, owner, name, visibilityMode) {
  const result = await request(baseUrl, "POST", "/org/organisations", {
    org_name: name,
    visibility_mode: visibilityMode
  }, { cookie: owner.cookie, csrf: owner.csrf });
  assertStatus(result, 201, `create ${visibilityMode} organisation`);
  return result.json?.organisation?.org_id;
}

test(
  "Org-owner<->athlete messaging: individual-mode orgs have no messaging path at all, shared-mode requires an accepted relationship with an active org coach, lazy thread creation, both directions, idempotent replay, preserved history after the gate closes, cross-account isolation, fresh-process restart",
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
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR athlete_user_id = ANY($1::text[])`,
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
    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });

    // ============================================================
    // individual-mode org: structurally no messaging path to any athlete,
    // even with an active coach and an accepted relationship in place.
    // ============================================================
    const individualOrgId = await createOrg(baseUrl, owner, "Individual Gym", "individual");
    const individualInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_individual` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(individualInvite, 201, "invite coachA to individual-mode org");
    await acceptOrgInvite(baseUrl, coachA, individualInvite.json?.membership?.membership_id, `accept_${nonce}_individual`);

    const sendFromIndividualOrg = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Hello from an individual-mode gym", client_request_id: `msg_${nonce}_individual` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(sendFromIndividualOrg, 403, "an individual-mode org owner cannot message an athlete at all");
    assert.equal(sendFromIndividualOrg.json?.error, "org_athlete_messaging_visibility_not_shared");

    // ============================================================
    // shared-mode org: same coach, same accepted relationship - now it
    // works, but only via THIS org (proven later by cross-org isolation).
    // ============================================================
    const orgId = await createOrg(baseUrl, owner, "Team Org", "shared");
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coachA to the shared-mode org");

    // ============================================================
    // While merely invited (coach membership not yet active), messaging
    // this coach's athlete is blocked even though the relationship itself
    // is already accepted.
    // ============================================================
    const sendWhileInvited = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_owner_early` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(sendWhileInvited, 403, "owner cannot message an athlete of a merely-invited coach");
    assert.equal(sendWhileInvited.json?.error, "org_athlete_messaging_athlete_not_visible");

    await acceptOrgInvite(baseUrl, coachA, invite.json?.membership?.membership_id, `accept_${nonce}_a`);

    // ============================================================
    // No thread exists until the first message is actually sent.
    // ============================================================
    const threadsBeforeFirstMessage = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(threadsBeforeFirstMessage, 200, "owner's athlete-message threads before any send");
    assert.equal(threadsBeforeFirstMessage.json?.threads?.length, 0, "no thread should exist before a first send");

    // ============================================================
    // Owner sends the first message - this is what lazily creates the
    // thread.
    // ============================================================
    const firstSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(firstSend, 201, "owner sends the first message");
    const threadId = firstSend.json?.thread?.thread_id;
    assert.ok(threadId, "expected a thread_id");
    assert.equal(firstSend.json?.message?.sender_role, "org_owner");
    assert.equal(firstSend.json?.thread?.org_name, "Team Org", "the thread carries a readable org_name");

    // ============================================================
    // Athlete reads their own threads and replies.
    // ============================================================
    const athleteThreads = await request(baseUrl, "GET", "/messages/athlete/org-messages/threads", undefined, {
      cookie: athlete1.cookie
    });
    assertStatus(athleteThreads, 200, "athlete1 reads own org-message threads");
    assert.equal(athleteThreads.json?.threads?.length, 1);
    assert.equal(athleteThreads.json?.threads?.[0]?.thread_id, threadId);
    assert.equal(athleteThreads.json?.threads?.[0]?.unread_count, 1, "the owner's unread first message should count as 1 for athlete1");

    const athleteMessagesFirstOpen = await request(
      baseUrl, "GET", `/messages/athlete/org-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: athlete1.cookie }
    );
    assertStatus(athleteMessagesFirstOpen, 200, "athlete1 opens the thread, marking it read");

    const athleteThreadsAfterOpen = await request(baseUrl, "GET", "/messages/athlete/org-messages/threads", undefined, {
      cookie: athlete1.cookie
    });
    assert.equal(athleteThreadsAfterOpen.json?.threads?.[0]?.unread_count, 0, "unread count drops to zero once athlete1 has opened the thread");

    const athleteReply = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Thanks, excited to get started.", client_request_id: `msg_${nonce}_2` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteReply, 201, "athlete1 replies");
    assert.equal(athleteReply.json?.thread?.thread_id, threadId, "the reply must reuse the same lazily-created thread");

    const ownerThreadsAfterReply = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(ownerThreadsAfterReply, 200, "owner's athlete-message threads after the reply");
    assert.equal(ownerThreadsAfterReply.json?.threads?.[0]?.unread_count, 1, "the athlete's unread reply should count as 1 for the owner");

    const ownerMessagesAfterReply = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(ownerMessagesAfterReply, 200, "owner reads both messages");
    assert.equal(ownerMessagesAfterReply.json?.messages?.length, 2);
    assert.deepEqual(
      ownerMessagesAfterReply.json?.messages?.map((m) => m.sender_role),
      ["org_owner", "athlete"]
    );

    const ownerThreadsAfterRead = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads`, undefined,
      { cookie: owner.cookie }
    );
    assert.equal(ownerThreadsAfterRead.json?.threads?.[0]?.unread_count, 0, "unread count drops to zero once the owner has opened the thread");

    // ============================================================
    // Idempotent replay: the same client_request_id must not duplicate.
    // ============================================================
    const replaySend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(replaySend, 201, "idempotent replay of the first send");
    assert.equal(replaySend.json?.message?.message_id, firstSend.json?.message?.message_id);

    const messagesAfterReplay = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assert.equal(messagesAfterReplay.json?.messages?.length, 2, "a replayed send must not create a duplicate message");

    // ============================================================
    // Cross-account isolation: an unrelated org owner and an unrelated
    // athlete cannot read or send into this thread.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);
    const otherAthlete = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(otherAthlete.userId);

    const crossOwnerRead = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOwnerRead, 403, "an unrelated org owner cannot read this org's athlete-message threads");

    const crossAthleteRead = await request(
      baseUrl, "GET", `/messages/athlete/org-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: otherAthlete.cookie }
    );
    assertStatus(crossAthleteRead, 403, "an unrelated athlete cannot read this thread");

    const crossAthleteSend = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hi, is this for me?", client_request_id: `msg_${nonce}_cross` },
      { cookie: otherAthlete.cookie, csrf: otherAthlete.csrf }
    );
    assertStatus(crossAthleteSend, 403, "an unrelated athlete cannot message into this org (no accepted relationship with any of its coaches)");

    // ============================================================
    // After the relationship is revoked: sending is blocked in both
    // directions, but existing history remains readable (matches the
    // "preserved history" pattern used throughout this product).
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "revoked"
    });

    const sendAfterRevokeFromOwner = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Are you still there?", client_request_id: `msg_${nonce}_after_revoke_owner` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(sendAfterRevokeFromOwner, 403, "owner cannot message an athlete whose relationship was revoked");

    const sendAfterRevokeFromAthlete = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hello?", client_request_id: `msg_${nonce}_after_revoke_athlete` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(sendAfterRevokeFromAthlete, 403, "an athlete whose relationship was revoked cannot message the org");

    const readAfterRevoke = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(readAfterRevoke, 200, "existing message history remains readable after the relationship is revoked");
    assert.equal(readAfterRevoke.json?.messages?.length, 2);

    // ============================================================
    // Fresh-process restart: the thread and its messages reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedMessages = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedMessages, 200, "thread messages after fresh-process restart");
    assert.equal(restartedMessages.json?.messages?.length, 2);
    assert.deepEqual(
      restartedMessages.json?.messages?.map((m) => m.sender_role),
      ["org_owner", "athlete"]
    );
  }
);

test(
  "Org-owner<->athlete messaging: photo/video attachments validate, persist, authorize, generate a real video poster, clean up idempotent-replay orphans, and support attachment-only sends",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const knownMessageIds = new Set();
    let tinyMp4Path = null;

    const cleanup = async () => {
      const allAccountIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      const allUserIds = [...orgOwnerUserIds, ...allAccountIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR athlete_user_id = ANY($1::text[])`,
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
      for (const messageId of knownMessageIds) {
        await fs.rm(path.join(STORAGE_ROOT, messageId), { recursive: true, force: true }).catch(() => {});
      }
      if (tinyMp4Path) await fs.rm(tinyMp4Path, { force: true }).catch(() => {});
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "attach");
    orgOwnerUserIds.push(owner.userId);
    const coach = await registerCoach(baseUrl, nonce, "attach");
    coachUserIds.push(coach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "attach");
    athleteUserIds.push(athlete.userId);
    const strangerOwner = await registerOrgOwner(baseUrl, nonce, "attachstranger");
    orgOwnerUserIds.push(strangerOwner.userId);
    const strangerAthlete = await registerAthlete(baseUrl, nonce, "attachstranger");
    athleteUserIds.push(strangerAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_rel_${nonce}_attach`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    const orgId = await createOrg(baseUrl, owner, "Attach Team Org", "shared");
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coach.email, request_id: `invite_${nonce}_attach` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coach");
    await acceptOrgInvite(baseUrl, coach, invite.json?.membership?.membership_id, `accept_${nonce}_attach`);

    // ============================================================
    // A valid image attachment, sent by the owner.
    // ============================================================
    const imageSend = await requestMultipart(
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Here's this week's plan.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "plan.jpg" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(imageSend, 201, "owner sends an image attachment");
    const imageMessageId = imageSend.json?.message?.message_id;
    assert.ok(imageMessageId, "expected a message_id");
    knownMessageIds.add(imageMessageId);
    assert.equal(imageSend.json?.message?.attachment?.media_type, "image");
    const ownerAttachmentUrl = imageSend.json?.message?.attachment?.url;
    assert.ok(ownerAttachmentUrl?.startsWith(`/org/organisations/${orgId}/athlete-messages/attachments/`), "the owner's own URL is nested under their org");

    // ============================================================
    // Idempotent replay must not leave an orphaned attachment directory -
    // checked via the directory-count delta (matches the other two
    // messaging slices' equivalent test).
    // ============================================================
    const entryCountBeforeReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;
    const replay = await requestMultipart(
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Here's this week's plan.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "replay.jpg" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(replay, 201, "idempotent replay with an attachment still returns 201");
    assert.equal(replay.json?.message?.message_id, imageMessageId);
    const entryCountAfterReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;
    assert.equal(entryCountAfterReplay, entryCountBeforeReplay, "the replay attempt's own attachment directory must not persist as an orphan");

    // ============================================================
    // Attachment GET authorization: the sender (owner) and the athlete can
    // both fetch it, each via their own route; an unrelated owner/athlete
    // cannot.
    // ============================================================
    const ownerFetches = await fetch(`${baseUrl}${ownerAttachmentUrl}`, { headers: { cookie: owner.cookie } });
    assert.equal(ownerFetches.status, 200, "the sending owner can fetch the attachment");
    assert.equal(ownerFetches.headers.get("content-type"), "image/jpeg");

    const athleteAttachmentUrl = `/messages/athlete/org-messages/attachments/${encodeURIComponent(imageMessageId)}`;
    const athleteFetches = await fetch(`${baseUrl}${athleteAttachmentUrl}`, { headers: { cookie: athlete.cookie } });
    assert.equal(athleteFetches.status, 200, "the athlete can fetch the same attachment via their own route");

    const strangerOwnerFetches = await fetch(`${baseUrl}${ownerAttachmentUrl}`, { headers: { cookie: strangerOwner.cookie } });
    assert.equal(strangerOwnerFetches.status, 403, "an unrelated org owner cannot fetch the attachment");

    const strangerAthleteFetches = await fetch(`${baseUrl}${athleteAttachmentUrl}`, { headers: { cookie: strangerAthlete.cookie } });
    assert.equal(strangerAthleteFetches.status, 403, "an unrelated athlete cannot fetch the attachment");

    // ============================================================
    // Attachment-only send (no body_text field at all), from the athlete.
    // ============================================================
    const attachmentOnly = await requestMultipart(
      baseUrl, `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { client_request_id: `msg_${nonce}_attachonly` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "no-caption.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(attachmentOnly, 201, "an attachment-only send with no caption is accepted");
    knownMessageIds.add(attachmentOnly.json?.message?.message_id);
    assert.equal(attachmentOnly.json?.message?.body_text, "", "an absent caption reads back as an empty string");
    assert.equal(attachmentOnly.json?.message?.attachment?.media_type, "image");

    // ============================================================
    // A real video attachment gets a real ffmpeg-generated poster frame.
    // ============================================================
    tinyMp4Path = await generateTinyMp4(root);
    const videoBuffer = await fs.readFile(tinyMp4Path);
    const videoSend = await requestMultipart(
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Here's a demo drill.", client_request_id: `msg_${nonce}_video` },
      { buffer: videoBuffer, mimeType: "video/mp4", filename: "drill.mp4" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(videoSend, 201, "owner sends a video attachment");
    const videoMessageId = videoSend.json?.message?.message_id;
    knownMessageIds.add(videoMessageId);
    assert.equal(videoSend.json?.message?.attachment?.media_type, "video");
    assert.equal(videoSend.json?.message?.attachment?.mime_type, "video/mp4");
    const thumbnailUrl = videoSend.json?.message?.attachment?.thumbnail_url;
    assert.ok(thumbnailUrl, "expected a poster/thumbnail URL for a real video");

    const thumbnailFetch = await fetch(`${baseUrl}${thumbnailUrl}`, { headers: { cookie: owner.cookie } });
    assert.equal(thumbnailFetch.status, 200, "the video poster is fetchable");
    assert.equal(thumbnailFetch.headers.get("content-type"), "image/jpeg", "the poster is always a JPEG regardless of the source video codec");
    const thumbnailBytes = Buffer.from(await thumbnailFetch.arrayBuffer());
    assert.ok(thumbnailBytes.length > 0, "the poster file has real content");

    const videoBytesFetch = await fetch(`${baseUrl}${videoSend.json?.message?.attachment?.url}`, { headers: { cookie: owner.cookie } });
    assert.equal(videoBytesFetch.status, 200);
    assert.equal(videoBytesFetch.headers.get("content-type"), "video/mp4");
  }
);

test(
  "Part O.8 - coach visibility into org-owner<->athlete threads: the assigned coach sees the full thread, a coach with the relationship but the wrong org membership gets a quiet empty list yet a genuine 403 on a named thread_id, a coach with no relationship at all is denied outright, attachment fetch mirrors the same gate, and revoking the relationship removes the coach's visibility too",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const knownMessageIds = new Set();

    const cleanup = async () => {
      const allAccountIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      const allUserIds = [...orgOwnerUserIds, ...allAccountIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR athlete_user_id = ANY($1::text[])`,
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
      for (const messageId of knownMessageIds) {
        await fs.rm(path.join(STORAGE_ROOT, messageId), { recursive: true, force: true }).catch(() => {});
      }
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "cv");
    orgOwnerUserIds.push(owner.userId);
    const coachA = await registerCoach(baseUrl, nonce, "cva");
    coachUserIds.push(coachA.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "cv1");
    athleteUserIds.push(athlete1.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_cv_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });

    const orgId = await createOrg(baseUrl, owner, "Coach Visibility Team Org", "shared");
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_cv_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coachA to the shared-mode org");
    await acceptOrgInvite(baseUrl, coachA, invite.json?.membership?.membership_id, `accept_${nonce}_cv_a`);

    // ============================================================
    // Owner sends a message and the athlete replies, exactly like test 1 -
    // this creates the thread this whole test exercises coach visibility
    // against.
    // ============================================================
    const ownerSend = await requestMultipart(
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_cv_1` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "welcome.jpg" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(ownerSend, 201, "owner sends the first message with an attachment");
    const threadId = ownerSend.json?.thread?.thread_id;
    assert.ok(threadId, "expected a thread_id");
    const attachmentMessageId = ownerSend.json?.message?.message_id;
    knownMessageIds.add(attachmentMessageId);

    const athleteReply = await request(
      baseUrl, "POST", `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Thanks, excited to get started.", client_request_id: `msg_${nonce}_cv_2` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteReply, 201, "athlete1 replies");

    // ============================================================
    // The assigned coach sees the full thread: it appears in their thread
    // list, and both messages (both roles) are readable.
    // ============================================================
    const coachAThreads = await request(
      baseUrl, "GET", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/org-messages/threads`, undefined,
      { cookie: coachA.cookie }
    );
    assertStatus(coachAThreads, 200, "coachA lists org-message threads for their own athlete");
    assert.equal(coachAThreads.json?.threads?.length, 1);
    assert.equal(coachAThreads.json?.threads?.[0]?.thread_id, threadId);
    assert.equal(coachAThreads.json?.threads?.[0]?.org_name, "Coach Visibility Team Org");

    const coachAMessages = await request(
      baseUrl, "GET", `/messages/coach/org-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: coachA.cookie }
    );
    assertStatus(coachAMessages, 200, "coachA reads the full thread");
    assert.equal(coachAMessages.json?.messages?.length, 2);
    assert.deepEqual(
      coachAMessages.json?.messages?.map((m) => m.sender_role),
      ["org_owner", "athlete"]
    );

    // ============================================================
    // Attachment fetch mirrors the same gate: coachA (the right coach) can
    // fetch it via their own route.
    // ============================================================
    const coachAttachmentUrl = coachAMessages.json?.messages?.[0]?.attachment?.url;
    assert.ok(coachAttachmentUrl?.startsWith("/messages/coach/org-messages/attachments/"), "the coach's own attachment URL uses the coach viewer base");
    const coachAttachmentFetch = await fetch(`${baseUrl}${coachAttachmentUrl}`, { headers: { cookie: coachA.cookie } });
    assert.equal(coachAttachmentFetch.status, 200, "coachA can fetch the attachment via their own route");
    assert.equal(coachAttachmentFetch.headers.get("content-type"), "image/jpeg");

    // ============================================================
    // coachC: HAS an accepted relationship with athlete1 (passes the
    // strict gate) but is an active member of a DIFFERENT shared org, not
    // orgId - proves the structural "quiet empty" branch (gate passed, no
    // matching active+shared membership) is genuinely distinct from a real
    // access denial.
    // ============================================================
    const coachC = await registerCoach(baseUrl, nonce, "cvc");
    coachUserIds.push(coachC.userId);
    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_cv_rel_${nonce}_c1`, coachUserId: coachC.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    const otherOrgId = await createOrg(baseUrl, owner, "Unrelated Team Org", "shared");
    const otherInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(otherOrgId)}/roster/invite`,
      { coach_email: coachC.email, request_id: `invite_${nonce}_cv_c` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(otherInvite, 201, "invite coachC to an unrelated shared-mode org");
    await acceptOrgInvite(baseUrl, coachC, otherInvite.json?.membership?.membership_id, `accept_${nonce}_cv_c`);

    const coachCThreads = await request(
      baseUrl, "GET", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/org-messages/threads`, undefined,
      { cookie: coachC.cookie }
    );
    assertStatus(coachCThreads, 200, "coachC's list route returns 200, not an error - the gate passed, there is simply nothing to show");
    assert.equal(coachCThreads.json?.threads?.length, 0, "coachC has no active membership in the org that actually has a thread with this athlete");

    const coachCDirectThreadFetch = await request(
      baseUrl, "GET", `/messages/coach/org-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: coachC.cookie }
    );
    assertStatus(coachCDirectThreadFetch, 403, "coachC hitting the real thread_id directly is a genuine access denial, unlike the quiet list");
    assert.equal(coachCDirectThreadFetch.json?.error, "org_athlete_messaging_thread_access_denied");

    const coachCAttachmentFetch = await fetch(`${baseUrl}${coachAttachmentUrl}`, { headers: { cookie: coachC.cookie } });
    assert.equal(coachCAttachmentFetch.status, 403, "coachC cannot fetch the attachment either");

    // ============================================================
    // coachD: no relationship with athlete1 at all - the strict gate
    // itself denies both the list and the direct thread read.
    // ============================================================
    const coachD = await registerCoach(baseUrl, nonce, "cvd");
    coachUserIds.push(coachD.userId);

    const coachDThreads = await request(
      baseUrl, "GET", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/org-messages/threads`, undefined,
      { cookie: coachD.cookie }
    );
    assertStatus(coachDThreads, 403, "coachD has no relationship at all with athlete1 - a real denial, not a quiet empty list");
    assert.equal(coachDThreads.json?.error, "org_athlete_messaging_coach_relationship_not_found");

    const coachDDirectThreadFetch = await request(
      baseUrl, "GET", `/messages/coach/org-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: coachD.cookie }
    );
    assertStatus(coachDDirectThreadFetch, 403, "coachD is denied the direct thread read for the same reason");

    // ============================================================
    // No coach-side send route exists at all - a guessed path 404s,
    // proving the coach never gained a write path into this thread.
    // ============================================================
    const guessedSendAttempt = await request(
      baseUrl, "POST", `/messages/coach/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Can I send here?", client_request_id: `msg_${nonce}_cv_guess` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(guessedSendAttempt, 404, "no coach-facing send route was ever wired for org<->athlete threads");

    // ============================================================
    // Revoking coachA's own relationship with athlete1 removes coachA's
    // visibility too - unlike the org owner/athlete sides (whose reads
    // never depended on relationship state), the coach's whole claim to
    // see this thread IS the relationship, so ending it ends the view.
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `org_ath_cv_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "revoked"
    });

    const coachAThreadsAfterRevoke = await request(
      baseUrl, "GET", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/org-messages/threads`, undefined,
      { cookie: coachA.cookie }
    );
    assertStatus(coachAThreadsAfterRevoke, 403, "coachA loses visibility once their own relationship with the athlete is revoked");

    // ============================================================
    // The thread's history is, of course, still intact for the parties who
    // were always independent of the coach relationship - the owner.
    // ============================================================
    const ownerReadsAfterRevoke = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/athlete-messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(ownerReadsAfterRevoke, 200, "the owner's own read is unaffected by coachA's relationship state");
    assert.equal(ownerReadsAfterRevoke.json?.messages?.length, 2);
  }
);

// File-scoped, not per-test: all three tests above share the same imported
// pool singleton, and node:test runs top-level test() blocks in this file
// sequentially - ending the pool inside either test's own after() would
// leave the pool unusable for whichever test runs next.
after(async () => {
  await pool.end();
});
