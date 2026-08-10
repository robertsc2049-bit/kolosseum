// DEV NOTE: FULL-UI-30 - exercise reference-media lookup proof. Proves both
// an athlete and a coach can read the same route, a real (S-REG-34 schema
// extension) exercise returns reference_media: null (content-free until a
// later slice adds real videos), an unknown exercise_id returns 404, an
// unauthenticated request is rejected, and the route survives a fresh
// process restart. Every step crosses only public HTTP routes; this feature
// touches no database table of its own, so restart-survival here proves the
// route is a genuinely deployed endpoint, not an in-memory-only artefact.

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

async function registerCoach(baseUrl, nonce) {
  const email = `refmedia_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: "Reference Media Coach",
    email,
    password: "RefMediaCoach!2026",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, "coach registration");
  const cookie = cookieNamed(result, "kolosseum_session", "coach registration");
  const csrf = result.json?.csrf_token;

  const onboardingProfile = await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: "Reference Media Coach", email },
    { cookie, csrf }
  );
  assertStatus(onboardingProfile, 200, "coach onboarding profile");

  const onboardingTerms = await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  );
  assertStatus(onboardingTerms, 200, "coach onboarding terms");

  const onboardingComplete = await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  );
  assertStatus(onboardingComplete, 200, "coach onboarding complete");

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce) {
  const email = `refmedia_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: "Reference Media Athlete",
    email,
    password: "RefMediaAthlete!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, "athlete registration");
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", "athlete registration"),
    csrf: result.json?.csrf_token
  };
}

test(
  "Exercise reference media: athlete and coach both read the same content-free route, unknown exercise 404s, unauthenticated is rejected, survives a fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds.filter(Boolean)) {
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

    const athlete = await registerAthlete(baseUrl, nonce);
    userIds.push(athlete.userId);
    const coach = await registerCoach(baseUrl, nonce);
    userIds.push(coach.userId);

    // ============================================================
    // A real, S-REG-34-extended exercise returns reference_media: null -
    // content-free until a later slice adds real videos. Both actor types
    // read the identical route and get the identical response shape.
    // ============================================================
    const athleteLookup = await request(
      baseUrl, "GET", "/exercises/back_squat/reference-media", undefined, { cookie: athlete.cookie }
    );
    assertStatus(athleteLookup, 200, "athlete reads exercise reference media");
    assert.equal(athleteLookup.json?.ok, true);
    assert.equal(athleteLookup.json?.exercise_id, "back_squat");
    assert.equal(athleteLookup.json?.reference_media, null);

    const coachLookup = await request(
      baseUrl, "GET", "/exercises/back_squat/reference-media", undefined, { cookie: coach.cookie }
    );
    assertStatus(coachLookup, 200, "coach reads the identical exercise reference media route");
    assert.equal(coachLookup.json?.exercise_id, "back_squat");
    assert.equal(coachLookup.json?.reference_media, null);

    // ============================================================
    // An unknown exercise_id 404s rather than silently returning null -
    // the distinction between "no content yet" and "not a real exercise".
    // ============================================================
    const unknownLookup = await request(
      baseUrl, "GET", "/exercises/not_a_real_exercise_id/reference-media", undefined, { cookie: athlete.cookie }
    );
    assertStatus(unknownLookup, 404, "an unknown exercise_id returns 404, not a null-content 200");
    assert.equal(unknownLookup.json?.error, "exercise_not_found");

    // ============================================================
    // No session cookie at all is rejected - this route is never public.
    // ============================================================
    const unauthenticatedLookup = await request(
      baseUrl, "GET", "/exercises/back_squat/reference-media", undefined, {}
    );
    assertStatus(unauthenticatedLookup, 401, "an unauthenticated request is rejected");

    // ============================================================
    // Fresh-process restart: the route is live on a genuinely new process,
    // not an in-memory-only artefact of the still-running test server.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedLookup = await request(
      restarted.baseUrl, "GET", "/exercises/back_squat/reference-media", undefined, { cookie: athlete.cookie }
    );
    assertStatus(restartedLookup, 200, "exercise reference media lookup after fresh-process restart");
    assert.equal(restartedLookup.json?.exercise_id, "back_squat");
    assert.equal(restartedLookup.json?.reference_media, null);
  }
);
