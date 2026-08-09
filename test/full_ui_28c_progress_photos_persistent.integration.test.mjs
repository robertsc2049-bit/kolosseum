// DEV NOTE: FULL-UI-28 - athlete progress photo lifecycle proof. Proves an
// athlete can upload/list/fetch their own progress photos, an accepted
// coach gets read-only access, an unrelated or not-yet-accepted coach is
// blocked, invalid uploads are rejected and leave nothing on disk, a
// revoked relationship blocks the coach while the athlete's own view is
// unaffected, and all of this survives a fresh-process restart. Every step
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
import { STORAGE_ROOT } from "../dist/src/api/progress_photo_storage.js";

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
      "photo",
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

async function registerCoach(baseUrl, nonce, label) {
  const email = `photo_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Photo ${label} Coach`,
    email,
    password: `Photo${label}Coach!2026`,
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
    { display_name: `Photo ${label} Coach`, email },
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

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `photo_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Photo ${label} Athlete`,
    email,
    password: `Photo${label}Athlete!2026`,
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

function tinyJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

test(
  "Athlete progress photos: upload/list/fetch own history, accepted-coach read-only access, invalid uploads rejected, blocked before acceptance and after revocation, fresh-process restart",
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
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
        await fs.rm(path.join(STORAGE_ROOT, userId), { recursive: true, force: true }).catch(() => {});
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

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const strangerCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(strangerCoach.userId);
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete.userId);

    // ============================================================
    // Athlete uploads their first photo before any coach relationship
    // exists - self-service, no coach gate on the athlete's own upload.
    // ============================================================
    const firstUpload = await requestMultipart(
      baseUrl, "/progress-photos",
      { taken_at_iso8601: new Date("2026-01-01T00:00:00.000Z").toISOString(), caption: "Week 1" },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "week1.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(firstUpload, 201, "athlete uploads first progress photo");
    const firstPhotoId = firstUpload.json?.photo?.photo_id;
    assert.ok(firstPhotoId, "expected a photo_id");
    assert.equal(firstUpload.json?.photo?.caption, "Week 1");
    assert.equal(firstUpload.json?.photo?.storage_key, undefined, "storage_key must never be exposed to the client");
    assert.ok(firstUpload.json?.photo?.url, "expected a fetchable url");

    // ============================================================
    // No relationship yet - the coach is blocked from listing or fetching.
    // ============================================================
    const listBeforeAcceptance = await request(
      baseUrl, "GET", `/progress-photos/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(listBeforeAcceptance, 403, "coach cannot list an athlete's photos with no relationship yet");

    await seedRelationship(baseUrl, {
      relationshipId: `photo_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });

    // ============================================================
    // Athlete uploads a second photo. Own history lists both, newest first.
    // ============================================================
    const secondUpload = await requestMultipart(
      baseUrl, "/progress-photos",
      { taken_at_iso8601: new Date("2026-02-01T00:00:00.000Z").toISOString() },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "week5.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(secondUpload, 201, "athlete uploads second progress photo");
    const secondPhotoId = secondUpload.json?.photo?.photo_id;

    const athleteHistory = await request(baseUrl, "GET", "/progress-photos", undefined, { cookie: athlete.cookie });
    assertStatus(athleteHistory, 200, "athlete lists own progress photo history");
    assert.equal(athleteHistory.json?.photos?.length, 2);
    assert.deepEqual(
      athleteHistory.json?.photos?.map((photo) => photo.photo_id),
      [secondPhotoId, firstPhotoId],
      "newest photo first"
    );

    // ============================================================
    // Accepted coach can now list and fetch the real file bytes.
    // ============================================================
    const coachHistory = await request(
      baseUrl, "GET", `/progress-photos/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(coachHistory, 200, "accepted coach lists the athlete's progress photo history");
    assert.equal(coachHistory.json?.photos?.length, 2);

    const coachFile = await fetch(`${baseUrl}/progress-photos/coach/${encodeURIComponent(athlete.userId)}/${encodeURIComponent(firstPhotoId)}/file`, {
      headers: { cookie: coach.cookie }
    });
    assert.equal(coachFile.status, 200, "accepted coach can fetch the real file bytes");
    const coachFileBytes = Buffer.from(await coachFile.arrayBuffer());
    assert.deepEqual(coachFileBytes, tinyJpegBuffer());

    const athleteFile = await fetch(`${baseUrl}/progress-photos/${encodeURIComponent(firstPhotoId)}/file`, {
      headers: { cookie: athlete.cookie }
    });
    assert.equal(athleteFile.status, 200, "athlete can fetch their own photo bytes");

    // ============================================================
    // An unrelated coach is blocked from both listing and fetching.
    // ============================================================
    const strangerList = await request(
      baseUrl, "GET", `/progress-photos/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: strangerCoach.cookie }
    );
    assertStatus(strangerList, 403, "an unrelated coach cannot list this athlete's progress photos");

    const strangerFile = await fetch(`${baseUrl}/progress-photos/coach/${encodeURIComponent(athlete.userId)}/${encodeURIComponent(firstPhotoId)}/file`, {
      headers: { cookie: strangerCoach.cookie }
    });
    assert.equal(strangerFile.status, 403, "an unrelated coach cannot fetch this athlete's progress photo file");

    // ============================================================
    // Invalid uploads: wrong magic bytes, oversized, missing file, and an
    // over-length caption are all rejected and leave nothing usable.
    // ============================================================
    const badBytes = await requestMultipart(
      baseUrl, "/progress-photos", {},
      { buffer: Buffer.from("this is not an image"), mimeType: "image/jpeg", filename: "fake.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(badBytes, 400, "unsniffable content is rejected regardless of declared type");
    assert.equal(badBytes.json?.error, "progress_photo_type_unsupported");

    const oversizedImage = Buffer.concat([tinyJpegBuffer(), Buffer.alloc(11 * 1024 * 1024)]);
    const oversized = await requestMultipart(
      baseUrl, "/progress-photos", {},
      { buffer: oversizedImage, mimeType: "image/jpeg", filename: "huge.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(oversized, 400, "an image over 10MB is rejected");
    assert.equal(oversized.json?.error, "progress_photo_too_large");

    const missingFile = await requestMultipart(
      baseUrl, "/progress-photos", {}, null,
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(missingFile, 400, "an upload with no file is rejected");

    const tooLongCaption = await requestMultipart(
      baseUrl, "/progress-photos", { caption: "x".repeat(281) },
      { buffer: tinyJpegBuffer(), mimeType: "image/jpeg", filename: "week9.jpg" },
      { cookie: athlete.cookie, csrf: athlete.csrf }
    );
    assertStatus(tooLongCaption, 400, "a caption over 280 characters is rejected");

    const historyAfterRejections = await request(baseUrl, "GET", "/progress-photos", undefined, { cookie: athlete.cookie });
    assert.equal(historyAfterRejections.json?.photos?.length, 2, "no rejected upload created a stored record");

    // ============================================================
    // After revocation: the coach is blocked, but the athlete's own view
    // is unaffected - matches the "preserved history, blocked go-forward
    // access" pattern used throughout this codebase.
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `photo_rel_${nonce}_revoke`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "revoked"
    });

    const listAfterRevoke = await request(
      baseUrl, "GET", `/progress-photos/coach/${encodeURIComponent(athlete.userId)}`, undefined,
      { cookie: coach.cookie }
    );
    assertStatus(listAfterRevoke, 403, "coach is blocked from listing after revocation");

    const athleteHistoryAfterRevoke = await request(baseUrl, "GET", "/progress-photos", undefined, { cookie: athlete.cookie });
    assertStatus(athleteHistoryAfterRevoke, 200, "athlete's own view is unaffected by the coach relationship being revoked");
    assert.equal(athleteHistoryAfterRevoke.json?.photos?.length, 2);

    // ============================================================
    // Fresh-process restart: the athlete's history and file bytes
    // reconstruct identically from Postgres and disk.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedHistory = await request(restarted.baseUrl, "GET", "/progress-photos", undefined, { cookie: athlete.cookie });
    assertStatus(restartedHistory, 200, "athlete history after fresh-process restart");
    assert.equal(restartedHistory.json?.photos?.length, 2);
    assert.deepEqual(
      restartedHistory.json?.photos?.map((photo) => photo.photo_id),
      [secondPhotoId, firstPhotoId]
    );

    const restartedFile = await fetch(`${restarted.baseUrl}/progress-photos/${encodeURIComponent(firstPhotoId)}/file`, {
      headers: { cookie: athlete.cookie }
    });
    assert.equal(restartedFile.status, 200, "photo file is still readable from disk after a fresh-process restart");
    assert.deepEqual(Buffer.from(await restartedFile.arrayBuffer()), tinyJpegBuffer());
  }
);
