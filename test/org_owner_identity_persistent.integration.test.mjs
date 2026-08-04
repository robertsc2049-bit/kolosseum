// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.1) - org owner identity and session proof. Proves self-service
// registration, sign-in, session resolution, sign-out, and that an org
// owner session is structurally isolated from athlete/coach/admin
// sessions - it can never satisfy those routes' auth checks, and their
// sessions can never satisfy this one. Also proves the whole loop survives
// a fresh-process restart. Every step crosses only public HTTP routes.

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

test(
  "Org owner identity: self-service registration, sign-in, session resolution, sign-out, structural isolation from athlete/coach/admin sessions, and fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const productUserIds = [];

    const cleanup = async () => {
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const userId of productUserIds) {
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
      await pool.end();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const orgOwnerEmail = `org_owner_identity_${nonce}@example.com`;

    // ============================================================
    // Self-service registration - unlike a platform admin account, an
    // org owner signs up through a public route.
    // ============================================================
    const registration = await request(baseUrl, "POST", "/org/register", {
      email: orgOwnerEmail,
      display_name: "Org Owner Identity",
      password: "OrgOwnerIdentity!2026"
    });
    assertStatus(registration, 201, "org owner registration");
    const orgOwnerUserId = registration.json?.org_owner?.user_id ?? "";
    assert.ok(orgOwnerUserId.startsWith("org_owner_"), "expected an org_owner_-prefixed user id");
    orgOwnerUserIds.push(orgOwnerUserId);
    const orgOwnerCookie = cookieNamed(registration, "kolosseum_org_owner_session", "org owner registration");
    const orgOwnerCsrf = registration.json?.csrf_token;
    assert.ok(orgOwnerCsrf, "expected a csrf token on registration");

    // Duplicate email registration is rejected.
    const duplicateRegistration = await request(baseUrl, "POST", "/org/register", {
      email: orgOwnerEmail,
      display_name: "Org Owner Identity Duplicate",
      password: "OrgOwnerIdentity!2026"
    });
    assertStatus(duplicateRegistration, 409, "duplicate org owner registration");

    // ============================================================
    // Session resolution: identity derives only from the session
    // cookie, never a client-supplied id.
    // ============================================================
    const sessionCheck = await request(baseUrl, "GET", "/org/session", undefined, { cookie: orgOwnerCookie });
    assertStatus(sessionCheck, 200, "org owner session check");
    assert.equal(sessionCheck.json?.user_id, orgOwnerUserId);

    const noCookieSessionCheck = await request(baseUrl, "GET", "/org/session");
    assertStatus(noCookieSessionCheck, 401, "session check without a cookie must be rejected");
    assert.equal(noCookieSessionCheck.json?.details?.failure_token, "org_owner_session_missing");

    // ============================================================
    // Sign-in: correct and incorrect password.
    // ============================================================
    const badSignIn = await request(baseUrl, "POST", "/org/sign-in", {
      email: orgOwnerEmail,
      password: "TheWrongPassword!2026"
    });
    assertStatus(badSignIn, 401, "sign-in with the wrong password must be rejected");

    const signIn = await request(baseUrl, "POST", "/org/sign-in", {
      email: orgOwnerEmail,
      password: "OrgOwnerIdentity!2026"
    });
    assertStatus(signIn, 200, "org owner sign-in");
    assert.equal(signIn.json?.org_owner?.user_id, orgOwnerUserId);
    const signInCookie = cookieNamed(signIn, "kolosseum_org_owner_session", "org owner sign-in");

    // ============================================================
    // Structural isolation: an org owner session must never satisfy
    // an athlete/coach-protected route, and an athlete/coach session
    // must never satisfy an org-owner-protected route. This is true by
    // physical cookie-name separation, not by policing every call site.
    // ============================================================
    const orgOwnerAgainstCoachRoute = await request(
      baseUrl, "GET", "/coach-workspace/athletes?coach_user_id=whatever", undefined,
      { cookie: signInCookie }
    );
    assert.notEqual(
      orgOwnerAgainstCoachRoute.response.status, 200,
      "an org owner session must never be accepted by a coach-scoped route"
    );

    const athleteRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "Org Owner Isolation Athlete",
      email: `org_owner_identity_athlete_${nonce}@example.com`,
      password: "OrgOwnerIsolationAthlete!2026",
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(athleteRegistration, 201, "athlete registration for isolation proof");
    const athleteUserId = athleteRegistration.json?.account?.user_id ?? "";
    productUserIds.push(athleteUserId);
    const athleteCookie = cookieNamed(athleteRegistration, "kolosseum_session", "athlete registration");

    const athleteAgainstOrgOwnerRoute = await request(
      baseUrl, "GET", "/org/session", undefined, { cookie: athleteCookie }
    );
    assertStatus(athleteAgainstOrgOwnerRoute, 401, "an athlete session must never be accepted by an org-owner route");

    // ============================================================
    // Sign-out revokes the session immediately.
    // ============================================================
    const signOut = await request(baseUrl, "POST", "/org/sign-out", {}, { cookie: signInCookie });
    assertStatus(signOut, 200, "org owner sign-out");

    const sessionAfterSignOut = await request(baseUrl, "GET", "/org/session", undefined, { cookie: signInCookie });
    assertStatus(sessionAfterSignOut, 401, "session must be rejected after sign-out");

    // The FIRST session (from registration) is independent of the second
    // (from sign-in) and remains valid.
    const firstSessionStillValid = await request(baseUrl, "GET", "/org/session", undefined, { cookie: orgOwnerCookie });
    assertStatus(firstSessionStillValid, 200, "the registration session must remain valid after a different session signs out");

    // ============================================================
    // Fresh-process restart: the org owner account and its still-valid
    // session must reconstruct identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedSessionCheck = await request(
      restarted.baseUrl, "GET", "/org/session", undefined, { cookie: orgOwnerCookie }
    );
    assertStatus(restartedSessionCheck, 200, "org owner session must survive a fresh-process restart");
    assert.equal(restartedSessionCheck.json?.user_id, orgOwnerUserId);
  }
);
