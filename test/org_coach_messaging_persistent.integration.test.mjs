// DEV NOTE: Part D.2 - org-owner<->coach messaging lifecycle proof. Proves
// a message thread is created lazily on first send, both directions can
// send/read while the coach's org membership is exactly 'active', sending
// is blocked while merely 'invited' and again after 'removed' (with
// existing history preserved and readable), idempotent replay via
// client_request_id does not duplicate, cross-org isolation holds, and
// all of this survives a fresh-process restart. Every step crosses only
// public HTTP routes.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test, { after } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { STORAGE_ROOT } from "../dist/src/api/message_attachment_storage.js";

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
  const email = `org_msg_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Msg ${label} Owner`,
    password: `OrgMsg${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_msg_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Msg ${label} Coach`,
    email,
    password: `OrgMsg${label}Coach!2026`,
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

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

test(
  "Org-owner<->coach messaging: lazy thread creation, both directions while active, blocked while invited and after removal with preserved history, idempotent replay, cross-org isolation, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...orgOwnerUserIds, ...coachUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR coach_user_id = ANY($1::text[])`,
          [allUserIds]
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
      for (const userId of coachUserIds) {
        if (!userId) continue;
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

    const org = await request(baseUrl, "POST", "/org/organisations", { org_name: "Org Msg Test Gym" }, {
      cookie: owner.cookie, csrf: owner.csrf
    });
    assertStatus(org, 201, "create organisation");
    const orgId = org.json?.organisation?.org_id;

    // ============================================================
    // While merely invited (not yet accepted), messaging is blocked in
    // both directions.
    // ============================================================
    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA");

    const sendWhileInvitedFromOwner = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Welcome aboard!", client_request_id: `msg_${nonce}_owner_early` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(sendWhileInvitedFromOwner, 403, "owner cannot message a merely-invited coach");
    assert.equal(sendWhileInvitedFromOwner.json?.error, "org_coach_messaging_membership_not_active");

    const sendWhileInvitedFromCoach = await request(
      baseUrl, "POST", `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hi, is this org active?", client_request_id: `msg_${nonce}_coach_early` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(sendWhileInvitedFromCoach, 403, "a merely-invited coach cannot message the org owner");

    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `accept_${nonce}_a`);

    // ============================================================
    // No thread exists until the first message is actually sent.
    // ============================================================
    const threadsBeforeFirstMessage = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(threadsBeforeFirstMessage, 200, "owner's threads before any message");
    assert.equal(threadsBeforeFirstMessage.json?.threads?.length, 0, "no thread should exist before a first send");

    // ============================================================
    // Owner sends the first message - this is what lazily creates the
    // thread.
    // ============================================================
    const firstSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(firstSend, 201, "owner sends the first message");
    const threadId = firstSend.json?.thread?.thread_id;
    assert.ok(threadId, "expected a thread_id");
    assert.equal(firstSend.json?.message?.sender_role, "org_owner");

    // ============================================================
    // Coach reads their own threads and replies.
    // ============================================================
    const coachThreads = await request(baseUrl, "GET", "/coach-workspace/org-messages/threads", undefined, {
      cookie: coachA.cookie
    });
    assertStatus(coachThreads, 200, "coachA reads own org-message threads");
    assert.equal(coachThreads.json?.threads?.length, 1);
    assert.equal(coachThreads.json?.threads?.[0]?.thread_id, threadId);

    const reply = await request(
      baseUrl, "POST", `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Thanks, excited to get started.", client_request_id: `msg_${nonce}_2` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(reply, 201, "coachA replies");
    assert.equal(reply.json?.thread?.thread_id, threadId, "the reply must reuse the same lazily-created thread");

    const ownerMessagesAfterReply = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(ownerMessagesAfterReply, 200, "owner reads both messages");
    assert.equal(ownerMessagesAfterReply.json?.messages?.length, 2);
    assert.deepEqual(
      ownerMessagesAfterReply.json?.messages?.map((m) => m.sender_role),
      ["org_owner", "coach"]
    );

    // ============================================================
    // Idempotent replay: the same client_request_id must not duplicate.
    // ============================================================
    const replaySend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Welcome to the team!", client_request_id: `msg_${nonce}_1` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(replaySend, 201, "idempotent replay of the first send");
    assert.equal(replaySend.json?.message?.message_id, firstSend.json?.message?.message_id);

    const messagesAfterReplay = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assert.equal(messagesAfterReplay.json?.messages?.length, 2, "a replayed send must not create a duplicate message");

    // ============================================================
    // Cross-org isolation: an unrelated org owner cannot read or send
    // into this org's coach threads.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);

    const crossOwnerRead = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOwnerRead, 403, "an unrelated org owner cannot read this org's message threads");

    const crossOwnerSend = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Hi from a different org", client_request_id: `msg_${nonce}_cross` },
      { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assertStatus(crossOwnerSend, 403, "an unrelated org owner cannot message into this org");

    // ============================================================
    // After removal: sending is blocked in both directions, but existing
    // history remains readable (matches the "preserved history" pattern
    // used throughout this product).
    // ============================================================
    const membershipId = inviteA.json?.membership?.membership_id;
    const removed = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/${encodeURIComponent(membershipId)}/remove`,
      { request_id: `remove_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(removed, 200, "owner removes coachA");

    const sendAfterRemoveFromOwner = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Are you still there?", client_request_id: `msg_${nonce}_after_remove_owner` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(sendAfterRemoveFromOwner, 403, "owner cannot message a removed coach");

    const sendAfterRemoveFromCoach = await request(
      baseUrl, "POST", `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { body_text: "Hello?", client_request_id: `msg_${nonce}_after_remove_coach` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(sendAfterRemoveFromCoach, 403, "a removed coach cannot message the org owner");

    const readAfterRemove = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(readAfterRemove, 200, "existing message history remains readable after removal");
    assert.equal(readAfterRemove.json?.messages?.length, 2);

    // ============================================================
    // Fresh-process restart: the thread and its messages reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedMessages = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/messages/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedMessages, 200, "thread messages after fresh-process restart");
    assert.equal(restartedMessages.json?.messages?.length, 2);
    assert.deepEqual(
      restartedMessages.json?.messages?.map((m) => m.sender_role),
      ["org_owner", "coach"]
    );
  }
);

test(
  "Org-owner<->coach messaging: photo/video attachments persist, authorize per-membership, clean up idempotent-replay orphans, and support attachment-only sends",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const knownMessageIds = new Set();

    const cleanup = async () => {
      const allUserIds = [...orgOwnerUserIds, ...coachUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = ANY($1::text[])) OR coach_user_id = ANY($1::text[])`,
          [allUserIds]
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
      for (const userId of coachUserIds) {
        if (!userId) continue;
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

    const owner = await registerOrgOwner(baseUrl, nonce, "attach");
    orgOwnerUserIds.push(owner.userId);
    const coach = await registerCoach(baseUrl, nonce, "attach");
    coachUserIds.push(coach.userId);
    const strangerOwner = await registerOrgOwner(baseUrl, nonce, "attachstranger");
    orgOwnerUserIds.push(strangerOwner.userId);
    const strangerCoach = await registerCoach(baseUrl, nonce, "attachstranger");
    coachUserIds.push(strangerCoach.userId);

    const org = await request(baseUrl, "POST", "/org/organisations", { org_name: "Attach Test Gym" }, {
      cookie: owner.cookie, csrf: owner.csrf
    });
    assertStatus(org, 201, "create organisation");
    const orgId = org.json?.organisation?.org_id;

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
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coach.userId)}/send`,
      { body_text: "Here's the new equipment.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "equipment.jpg" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(imageSend, 201, "owner sends an image attachment");
    const imageMessageId = imageSend.json?.message?.message_id;
    assert.ok(imageMessageId, "expected a message_id");
    knownMessageIds.add(imageMessageId);
    assert.equal(imageSend.json?.message?.attachment?.media_type, "image");
    const ownerAttachmentUrl = imageSend.json?.message?.attachment?.url;
    assert.ok(ownerAttachmentUrl?.startsWith(`/org/organisations/${orgId}/messages/attachments/`), "the owner's own URL is nested under their org");

    // ============================================================
    // Idempotent replay must not leave an orphaned attachment directory
    // - checked via the directory-count delta, matching the coach<->
    // athlete side's equivalent test (a stale/unrelated leftover under
    // the shared storage root must never make this assertion flaky).
    // ============================================================
    const entryCountBeforeReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;
    const replay = await requestMultipart(
      baseUrl, `/org/organisations/${encodeURIComponent(orgId)}/messages/coaches/${encodeURIComponent(coach.userId)}/send`,
      { body_text: "Here's the new equipment.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "replay.jpg" },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(replay, 201, "idempotent replay with an attachment still returns 201");
    assert.equal(replay.json?.message?.message_id, imageMessageId);
    const entryCountAfterReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;
    assert.equal(entryCountAfterReplay, entryCountBeforeReplay, "the replay attempt's own attachment directory must not persist as an orphan");

    // ============================================================
    // Attachment GET authorization: the sender (owner) and the active
    // member coach can both fetch it, each via their own route; an
    // unrelated owner/coach cannot (matching the existing membership-
    // based authorization already proven for thread reads above).
    // ============================================================
    const ownerFetches = await fetch(`${baseUrl}${ownerAttachmentUrl}`, { headers: { cookie: owner.cookie } });
    assert.equal(ownerFetches.status, 200, "the sending owner can fetch the attachment");
    assert.equal(ownerFetches.headers.get("content-type"), "image/jpeg");

    const coachAttachmentUrl = `/coach-workspace/org-messages/attachments/${encodeURIComponent(imageMessageId)}`;
    const coachFetches = await fetch(`${baseUrl}${coachAttachmentUrl}`, { headers: { cookie: coach.cookie } });
    assert.equal(coachFetches.status, 200, "the active-member coach can fetch the same attachment via their own route");

    const strangerOwnerFetches = await fetch(`${baseUrl}${ownerAttachmentUrl}`, { headers: { cookie: strangerOwner.cookie } });
    assert.equal(strangerOwnerFetches.status, 403, "an unrelated org owner cannot fetch the attachment");

    const strangerCoachFetches = await fetch(`${baseUrl}${coachAttachmentUrl}`, { headers: { cookie: strangerCoach.cookie } });
    assert.equal(strangerCoachFetches.status, 403, "an unrelated coach cannot fetch the attachment");

    // ============================================================
    // Attachment-only send (no body_text field at all), from the coach.
    // ============================================================
    const attachmentOnly = await requestMultipart(
      baseUrl, `/coach-workspace/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      { client_request_id: `msg_${nonce}_attachonly` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "no-caption.jpg" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(attachmentOnly, 201, "an attachment-only send with no caption is accepted");
    knownMessageIds.add(attachmentOnly.json?.message?.message_id);
    assert.equal(attachmentOnly.json?.message?.body_text, "", "an absent caption reads back as an empty string");
    assert.equal(attachmentOnly.json?.message?.attachment?.media_type, "image");
  }
);

// File-scoped, not per-test: both tests above share the same imported
// pool singleton, and node:test runs top-level test() blocks in this file
// sequentially - ending the pool inside either test's own after() would
// leave the pool unusable for whichever test runs next.
after(async () => {
  await pool.end();
});
