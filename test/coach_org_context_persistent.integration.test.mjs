// DEV NOTE: Part O.7 - coach org-context/fellow-roster lifecycle proof.
// Proves an active coach in a shared (team) org sees the org's full
// roster (including themselves and fellow coaches, by name/email), an
// active coach in an individual (gym) org sees an empty roster (never
// fellow-coach identity), an invited-but-not-yet-accepted coach is denied
// outright, a coach with no membership in the org at all is denied,
// cross-org isolation holds, and all of this survives a fresh-process
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
  const email = `coach_org_ctx_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Coach Org Ctx ${label} Owner`,
    password: `CoachOrgCtx${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `coach_org_ctx_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Coach Org Ctx ${label} Coach`,
    email,
    password: `CoachOrgCtx${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    displayName: `Coach Org Ctx ${label} Coach`,
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

async function getRoster(baseUrl, coach, orgId, label) {
  return await request(
    baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(orgId)}/roster`, undefined,
    { cookie: coach.cookie }
  );
}

test(
  "Coach org context: active membership in a shared org resolves the fellow-coach roster (including self), individual-mode resolves empty, invited-only and non-member coaches are denied, cross-org isolation, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];

    const cleanup = async () => {
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
      await pool.end();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "primary");
    orgOwnerUserIds.push(owner.userId);
    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const coachC = await registerCoach(baseUrl, nonce, "c");
    coachUserIds.push(coachC.userId);
    const coachD = await registerCoach(baseUrl, nonce, "d");
    coachUserIds.push(coachD.userId);

    // ============================================================
    // Shared org: coachA and coachB both ACTIVE. coachD INVITED only.
    // ============================================================
    const sharedOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Coach Org Ctx Shared Team", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(sharedOrg, 201, "create shared-mode org");
    const sharedOrgId = sharedOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to shared org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `accept_${nonce}_a`);

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB to shared org");
    await acceptOrgInvite(baseUrl, coachB, inviteB.json?.membership?.membership_id, `accept_${nonce}_b`);

    const inviteD = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachD.email, request_id: `invite_${nonce}_d` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteD, 201, "invite coachD to shared org (never accepted)");

    // ============================================================
    // Individual org: coachC ACTIVE.
    // ============================================================
    const individualOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Coach Org Ctx Individual Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(individualOrg, 201, "create individual-mode org");
    const individualOrgId = individualOrg.json?.organisation?.org_id;

    const inviteC = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachC.email, request_id: `invite_${nonce}_c` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteC, 201, "invite coachC to individual org");
    await acceptOrgInvite(baseUrl, coachC, inviteC.json?.membership?.membership_id, `accept_${nonce}_c`);

    // ============================================================
    // Active coachA sees the shared org's full roster - self AND coachB
    // by name/email, plus coachD as "invited".
    // ============================================================
    const sharedRosterForA = await getRoster(baseUrl, coachA, sharedOrgId, "coachA");
    assertStatus(sharedRosterForA, 200, "coachA reads shared org roster");
    const rosterEntries = sharedRosterForA.json?.roster ?? [];
    assert.equal(rosterEntries.length, 3, "expected coachA, coachB and coachD in the shared roster");

    const selfEntry = rosterEntries.find((entry) => entry.coach_user_id === coachA.userId);
    assert.ok(selfEntry, "expected coachA's own row");
    assert.equal(selfEntry.coach_display_name, coachA.displayName);
    assert.equal(selfEntry.membership_status, "active");

    const fellowEntry = rosterEntries.find((entry) => entry.coach_user_id === coachB.userId);
    assert.ok(fellowEntry, "expected coachB's row");
    assert.equal(fellowEntry.coach_display_name, coachB.displayName);
    assert.equal(fellowEntry.coach_email, coachB.email);
    assert.equal(fellowEntry.membership_status, "active");

    const invitedEntry = rosterEntries.find((entry) => entry.coach_user_id === coachD.userId);
    assert.ok(invitedEntry, "expected coachD's row");
    assert.equal(invitedEntry.membership_status, "invited");

    // ============================================================
    // Active coachC sees an EMPTY roster for the individual-mode org -
    // never coachC's own row, never anyone else's identity.
    // ============================================================
    const individualRosterForC = await getRoster(baseUrl, coachC, individualOrgId, "coachC");
    assertStatus(individualRosterForC, 200, "coachC reads individual org roster");
    assert.equal(individualRosterForC.json?.roster?.length, 0, "individual-mode roster must be empty");

    // ============================================================
    // coachD is only INVITED (not active) on the shared org - denied
    // outright, never sees the roster.
    // ============================================================
    const sharedRosterForD = await getRoster(baseUrl, coachD, sharedOrgId, "coachD");
    assertStatus(sharedRosterForD, 403, "invited-only coachD is denied the shared org roster");
    assert.equal(sharedRosterForD.json?.error, "org_roster_membership_access_denied");

    // ============================================================
    // Cross-org isolation: coachC (only a member of the individual org)
    // is denied the shared org's roster outright - not a member at all.
    // ============================================================
    const crossOrgRoster = await getRoster(baseUrl, coachC, sharedOrgId, "coachC (cross-org)");
    assertStatus(crossOrgRoster, 403, "a coach with no membership in the org is denied its roster");
    assert.equal(crossOrgRoster.json?.error, "org_roster_membership_access_denied");

    // ============================================================
    // Fresh-process restart: coachA's shared-org roster reconstructs
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedRoster = await getRoster(restarted.baseUrl, coachA, sharedOrgId, "coachA (restarted)");
    assertStatus(restartedRoster, 200, "coachA reads shared org roster after restart");
    const restartedEntries = restartedRoster.json?.roster ?? [];
    assert.equal(restartedEntries.length, 3);
    assert.ok(restartedEntries.some((entry) => entry.coach_user_id === coachA.userId));
    assert.ok(restartedEntries.some((entry) => entry.coach_user_id === coachB.userId));
  }
);
