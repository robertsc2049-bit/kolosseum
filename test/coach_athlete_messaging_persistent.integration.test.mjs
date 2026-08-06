// DEV NOTE: Part D.1 - coach<->athlete messaging lifecycle proof. Proves a
// message thread is created lazily on first send (never before), both
// directions can send/read, idempotent replay via client_request_id does
// not duplicate, sending is blocked before acceptance and after
// revocation while existing history remains readable, body_text is
// bounded, cross-pair isolation holds, and all of this survives a
// fresh-process restart. Every step crosses only public HTTP routes.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
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

// The coach-athlete relationship gate (requireAcceptedCoachAthleteRelationship)
// requires a real beta17_coach_profile record to exist, not just an
// account row - that record is written as a side effect of completing
// coach onboarding, mirroring the exact flow used by
// test/full_ui_23_coach_athlete_journey_persistent.integration.test.mjs.
async function registerCoach(baseUrl, nonce, label) {
  const email = `msg_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Msg ${label} Coach`,
    email,
    password: `Msg${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  const onboardingProfile = await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Msg ${label} Coach`, email },
    { cookie, csrf }
  );
  assertStatus(onboardingProfile, 200, `${label} coach onboarding profile`);

  const onboardingTerms = await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  );
  assertStatus(onboardingTerms, 200, `${label} coach onboarding terms`);

  const onboardingComplete = await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  );
  assertStatus(onboardingComplete, 200, `${label} coach onboarding complete`);

  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie,
    csrf
  };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `msg_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Msg ${label} Athlete`,
    email,
    password: `Msg${label}Athlete!2026`,
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

// Seeds a beta17_coach_relationship record directly, mirroring the same
// "connect athlete" test-seeding convention used by
// test/full_ui_23_coach_athlete_journey_persistent.integration.test.mjs
// and test/org_visibility_lifecycle_persistent.integration.test.mjs
// (POST /sessions/beta-coach-relationship) - a real, live, unauthenticated
// product-record route, not a test-only shortcut.
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

test(
  "Coach<->athlete messaging: lazy thread creation, both directions, idempotent replay, blocked before acceptance and after revocation with preserved history, cross-pair isolation, fresh-process restart",
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
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])`,
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
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);

    // ============================================================
    // No accepted relationship yet - sending is blocked outright.
    // ============================================================
    const beforeAcceptance = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Hello before we're connected", client_request_id: `msg_${nonce}_early` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(beforeAcceptance, 403, "coach cannot message an athlete with no relationship yet");
    assert.equal(beforeAcceptance.json?.error, "coach_athlete_messaging_relationship_not_found");

    await seedRelationship(baseUrl, {
      relationshipId: `msg_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });

    // ============================================================
    // No thread exists until the first message is actually sent.
    // ============================================================
    const threadsBeforeFirstMessage = await request(baseUrl, "GET", "/messages/coach/threads", undefined, {
      cookie: coachA.cookie
    });
    assertStatus(threadsBeforeFirstMessage, 200, "coachA's threads before any message");
    assert.equal(threadsBeforeFirstMessage.json?.threads?.length, 0, "no thread should exist before a first send");

    // ============================================================
    // Coach sends the first message - this is what lazily creates the
    // thread.
    // ============================================================
    const firstSend = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome! Let's get started on your programme.", client_request_id: `msg_${nonce}_1` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(firstSend, 201, "coachA sends the first message");
    const threadId = firstSend.json?.thread?.thread_id;
    assert.ok(threadId, "expected a thread_id");
    assert.equal(firstSend.json?.message?.sender_role, "coach");

    // ============================================================
    // Athlete reads their own threads and the thread's messages.
    // ============================================================
    const athleteThreads = await request(baseUrl, "GET", "/messages/athlete/threads", undefined, {
      cookie: athlete1.cookie
    });
    assertStatus(athleteThreads, 200, "athlete1 reads own threads");
    assert.equal(athleteThreads.json?.threads?.length, 1);
    assert.equal(athleteThreads.json?.threads?.[0]?.thread_id, threadId);

    const athleteMessages = await request(baseUrl, "GET", `/messages/athlete/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: athlete1.cookie
    });
    assertStatus(athleteMessages, 200, "athlete1 reads thread messages");
    assert.equal(athleteMessages.json?.messages?.length, 1);

    // ============================================================
    // Athlete replies - reuses the SAME thread, does not create a second.
    // ============================================================
    const athleteReply = await request(
      baseUrl, "POST", `/messages/athlete/coaches/${encodeURIComponent(coachA.userId)}/send`,
      { body_text: "Thanks coach, ready to go.", client_request_id: `msg_${nonce}_2` },
      { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(athleteReply, 201, "athlete1 replies");
    assert.equal(athleteReply.json?.thread?.thread_id, threadId, "the reply must reuse the same lazily-created thread");

    const coachThreadsAfterReply = await request(baseUrl, "GET", "/messages/coach/threads", undefined, {
      cookie: coachA.cookie
    });
    assertStatus(coachThreadsAfterReply, 200, "coachA's threads after the reply");
    assert.equal(coachThreadsAfterReply.json?.threads?.length, 1, "still exactly one thread, not two");

    const messagesAfterReply = await request(baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: coachA.cookie
    });
    assertStatus(messagesAfterReply, 200, "coachA reads both messages");
    assert.equal(messagesAfterReply.json?.messages?.length, 2);
    assert.deepEqual(
      messagesAfterReply.json?.messages?.map((m) => m.sender_role),
      ["coach", "athlete"]
    );

    // ============================================================
    // Idempotent replay: the same client_request_id must not duplicate.
    // ============================================================
    const replaySend = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Welcome! Let's get started on your programme.", client_request_id: `msg_${nonce}_1` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(replaySend, 201, "idempotent replay of the first send");
    assert.equal(replaySend.json?.message?.message_id, firstSend.json?.message?.message_id);

    const messagesAfterReplay = await request(baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: coachA.cookie
    });
    assert.equal(messagesAfterReplay.json?.messages?.length, 2, "a replayed send must not create a duplicate message");

    // ============================================================
    // body_text validation.
    // ============================================================
    const emptyBody = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "   ", client_request_id: `msg_${nonce}_empty` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(emptyBody, 400, "empty/whitespace-only body_text is rejected");

    const tooLongBody = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "x".repeat(4001), client_request_id: `msg_${nonce}_toolong` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(tooLongBody, 400, "body_text over 4000 characters is rejected");

    // ============================================================
    // Cross-pair isolation: coachB (unrelated) cannot message athlete1,
    // and cannot read or send into coachA/athlete1's thread.
    // ============================================================
    const crossCoachSend = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Hi, I'm a different coach", client_request_id: `msg_${nonce}_cross` },
      { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(crossCoachSend, 403, "an unrelated coach cannot message athlete1");

    const crossCoachRead = await request(baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: coachB.cookie
    });
    assertStatus(crossCoachRead, 403, "an unrelated coach cannot read coachA/athlete1's thread");

    const crossAthleteRead = await request(baseUrl, "GET", `/messages/athlete/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: athlete2.cookie
    });
    assertStatus(crossAthleteRead, 403, "an unrelated athlete cannot read coachA/athlete1's thread");

    // ============================================================
    // After revocation: sending is blocked, but existing history remains
    // readable (matches the "preserved history" pattern used everywhere
    // else in this codebase - a removed org membership, a past
    // relationship, etc.).
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `msg_rel_${nonce}_a1_revoke`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "revoked"
    });

    const sendAfterRevoke = await request(
      baseUrl, "POST", `/messages/coach/athletes/${encodeURIComponent(athlete1.userId)}/send`,
      { body_text: "Are you still there?", client_request_id: `msg_${nonce}_after_revoke` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(sendAfterRevoke, 403, "sending is blocked after the relationship is revoked");
    assert.equal(sendAfterRevoke.json?.error, "coach_athlete_messaging_relationship_not_accepted");

    const readAfterRevoke = await request(baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`, undefined, {
      cookie: coachA.cookie
    });
    assertStatus(readAfterRevoke, 200, "existing message history remains readable after revocation");
    assert.equal(readAfterRevoke.json?.messages?.length, 2);

    // ============================================================
    // Fresh-process restart: the thread and its messages reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedMessages = await request(
      restarted.baseUrl, "GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`, undefined,
      { cookie: coachA.cookie }
    );
    assertStatus(restartedMessages, 200, "thread messages after fresh-process restart");
    assert.equal(restartedMessages.json?.messages?.length, 2);
    assert.deepEqual(
      restartedMessages.json?.messages?.map((m) => m.sender_role),
      ["coach", "athlete"]
    );
  }
);

// A minimal valid-enough JPEG for message_attachment_storage.ts's own
// content sniff (which only inspects the leading FF D8 FF magic bytes) -
// deliberately not a fully decodable image, since nothing in this send
// path ever attempts to decode/render server-side.
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

test(
  "Coach<->athlete messaging: photo/video attachments validate, persist, authorize per-relationship, generate a video poster, clean up idempotent-replay orphans, and support attachment-only sends",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const coachUserIds = [];
    const athleteUserIds = [];
    const knownMessageIds = new Set();
    let tinyMp4Path = null;

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM product_messages WHERE sender_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
        await pool.query(
          `DELETE FROM product_message_threads WHERE coach_user_id = ANY($1::text[]) OR athlete_user_id = ANY($1::text[])`,
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

    const coach = await registerCoach(baseUrl, nonce, "attach");
    coachUserIds.push(coach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "attach");
    athleteUserIds.push(athlete.userId);
    const strangerCoach = await registerCoach(baseUrl, nonce, "attachstranger");
    coachUserIds.push(strangerCoach.userId);
    const strangerAthlete = await registerAthlete(baseUrl, nonce, "attachstranger");
    athleteUserIds.push(strangerAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `msg_rel_${nonce}_attach`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Wrong-magic-bytes upload is rejected regardless of the declared
    // field/Content-Type, and leaves nothing on disk.
    // ============================================================
    const badBytes = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { client_request_id: `msg_${nonce}_badbytes` },
      { buffer: Buffer.from("this is not an image or video"), mimeType: "image/jpeg", filename: "fake.jpg" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(badBytes, 400, "unsniffable content is rejected regardless of declared type");
    assert.equal(badBytes.json?.error, "message_attachment_type_unsupported");

    // ============================================================
    // Oversized image (under multer's overall ceiling, over the
    // type-specific 10MB image cap) is rejected, and cleans up its own
    // staged temp file.
    // ============================================================
    const oversizedImage = Buffer.concat([tinyJpegBuffer(), Buffer.alloc(11 * 1024 * 1024)]);
    const oversized = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { client_request_id: `msg_${nonce}_oversized` },
      { buffer: oversizedImage, mimeType: "image/jpeg", filename: "big.jpg" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(oversized, 400, "an 11MB image exceeds the 10MB image cap even though it is under multer's overall ceiling");
    assert.equal(oversized.json?.error, "message_attachment_image_too_large");

    // ============================================================
    // A valid image attachment, with a caption, sent by the coach.
    // ============================================================
    const imageSend = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Check your form on this rep.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "form-check.jpg" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(imageSend, 201, "coach sends an image attachment with a caption");
    const imageMessageId = imageSend.json?.message?.message_id;
    assert.ok(imageMessageId, "expected a message_id");
    knownMessageIds.add(imageMessageId);
    assert.equal(imageSend.json?.message?.attachment?.media_type, "image");
    assert.equal(imageSend.json?.message?.attachment?.mime_type, "image/jpeg");
    assert.equal(imageSend.json?.message?.attachment?.thumbnail_url, null, "images never get a poster/thumbnail");
    assert.equal(imageSend.json?.message?.body_text, "Check your form on this rep.");
    const imageUrl = imageSend.json?.message?.attachment?.url;
    assert.ok(imageUrl?.startsWith("/messages/coach/attachments/"), "the sender's own URL uses the coach-side prefix");

    // ============================================================
    // Idempotent replay of the SAME client_request_id, this time with a
    // (different) attachment attached to the replay attempt - the
    // second attempt's file must never persist as an orphan, since the
    // DB row it would have referenced never gets created. Checked via the
    // directory-count DELTA (before vs. after), not an exhaustive
    // allowlist of every entry under STORAGE_ROOT - the storage root is
    // shared process-wide, so unrelated concurrent/leftover state must
    // never make this assertion flaky.
    // ============================================================
    const entryCountBeforeReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;

    const replayWithAttachment = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Check your form on this rep.", client_request_id: `msg_${nonce}_image` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "replay.jpg" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(replayWithAttachment, 201, "idempotent replay with an attachment still returns 201 (unchanged status semantics)");
    assert.equal(replayWithAttachment.json?.message?.message_id, imageMessageId, "the replay resolves to the original message, not a new one");

    const entryCountAfterReplay = (await fs.readdir(STORAGE_ROOT).catch(() => [])).length;
    assert.equal(entryCountAfterReplay, entryCountBeforeReplay, "the replay attempt's own attachment directory must not persist as an orphan");

    // ============================================================
    // Attachment GET authorization: the sender (coach) and the peer
    // (athlete) can both fetch it; an unrelated coach/athlete cannot.
    // ============================================================
    const coachFetchesOwn = await fetch(`${baseUrl}${imageUrl}`, { headers: { cookie: coach.cookie } });
    assert.equal(coachFetchesOwn.status, 200, "the sending coach can fetch the attachment");
    assert.equal(coachFetchesOwn.headers.get("content-type"), "image/jpeg");
    const coachFetchedBytes = Buffer.from(await coachFetchesOwn.arrayBuffer());
    assert.deepEqual(coachFetchedBytes, tinyJpegBuffer(), "the served bytes match exactly what was uploaded");

    const athleteFetchesPeerUrl = `/messages/athlete/attachments/${encodeURIComponent(imageMessageId)}`;
    const athleteFetches = await fetch(`${baseUrl}${athleteFetchesPeerUrl}`, { headers: { cookie: athlete.cookie } });
    assert.equal(athleteFetches.status, 200, "the accepted-relationship athlete peer can fetch the same attachment via their own route");

    const strangerCoachFetches = await fetch(`${baseUrl}${imageUrl}`, { headers: { cookie: strangerCoach.cookie } });
    assert.equal(strangerCoachFetches.status, 403, "an unrelated coach cannot fetch the attachment");

    const strangerAthleteFetches = await fetch(`${baseUrl}${athleteFetchesPeerUrl}`, { headers: { cookie: strangerAthlete.cookie } });
    assert.equal(strangerAthleteFetches.status, 403, "an unrelated athlete cannot fetch the attachment");

    const anonymousFetches = await fetch(`${baseUrl}${imageUrl}`);
    assert.equal(anonymousFetches.status, 401, "an unauthenticated request cannot fetch the attachment");

    // ============================================================
    // Attachment-only send (no body_text field at all) is allowed.
    // ============================================================
    const attachmentOnly = await requestMultipart(
      baseUrl, `/messages/athlete/coaches/${encodeURIComponent(coach.userId)}/send`,
      { client_request_id: `msg_${nonce}_attachonly` },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "no-caption.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(attachmentOnly, 201, "an attachment-only send with no caption is accepted");
    knownMessageIds.add(attachmentOnly.json?.message?.message_id);
    assert.equal(attachmentOnly.json?.message?.body_text, "", "an absent caption reads back as an empty string, never null/undefined");
    assert.equal(attachmentOnly.json?.message?.attachment?.media_type, "image");

    // ============================================================
    // A real video attachment gets a real ffmpeg-generated poster frame.
    // ============================================================
    tinyMp4Path = await generateTinyMp4(root);
    const videoBuffer = await fs.readFile(tinyMp4Path);
    const videoSend = await requestMultipart(
      baseUrl, `/messages/coach/athletes/${encodeURIComponent(athlete.userId)}/send`,
      { body_text: "Here's your squat from today.", client_request_id: `msg_${nonce}_video` },
      { buffer: videoBuffer, mimeType: "video/mp4", filename: "squat.mp4" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(videoSend, 201, "coach sends a video attachment");
    const videoMessageId = videoSend.json?.message?.message_id;
    knownMessageIds.add(videoMessageId);
    assert.equal(videoSend.json?.message?.attachment?.media_type, "video");
    assert.equal(videoSend.json?.message?.attachment?.mime_type, "video/mp4");
    const thumbnailUrl = videoSend.json?.message?.attachment?.thumbnail_url;
    assert.ok(thumbnailUrl, "expected a poster/thumbnail URL for a real video");

    const thumbnailFetch = await fetch(`${baseUrl}${thumbnailUrl}`, { headers: { cookie: coach.cookie } });
    assert.equal(thumbnailFetch.status, 200, "the video poster is fetchable");
    assert.equal(thumbnailFetch.headers.get("content-type"), "image/jpeg", "the poster is always a JPEG regardless of the source video codec");
    const thumbnailBytes = Buffer.from(await thumbnailFetch.arrayBuffer());
    assert.ok(thumbnailBytes.length > 0, "the poster file has real content");

    const videoBytesFetch = await fetch(`${baseUrl}${videoSend.json?.message?.attachment?.url}`, { headers: { cookie: coach.cookie } });
    assert.equal(videoBytesFetch.status, 200);
    assert.equal(videoBytesFetch.headers.get("content-type"), "video/mp4");
  }
);

// File-scoped, not per-test: both tests above share the same imported
// pool singleton, and node:test runs top-level test() blocks in this file
// sequentially - ending the pool inside either test's own after() would
// leave the pool unusable for whichever test runs next.
after(async () => {
  await pool.end();
});
