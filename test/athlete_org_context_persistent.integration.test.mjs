// DEV NOTE: Part O.6 - athlete org-context lifecycle proof. Proves an
// athlete's own accepted relationship with a coach who has an ACTIVE org
// membership resolves that org's context (org_id, org_name,
// visibility_mode), that an invited-not-accepted relationship, a declined
// relationship, and an accepted relationship with a coach whose org
// membership is still invited (not active) all resolve to zero contexts,
// that an athlete with contexts in both an individual- and a shared-mode
// org sees both, that this never leaks another athlete's identity, and
// that all of this survives a fresh-process restart. Every step crosses
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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `athlete_org_ctx_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Athlete Org Ctx ${label} Owner`,
    password: `AthleteOrgCtx${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `athlete_org_ctx_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Athlete Org Ctx ${label} Coach`,
    email,
    password: `AthleteOrgCtx${label}Coach!2026`,
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
  const email = `athlete_org_ctx_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Athlete Org Ctx ${label} Athlete`,
    email,
    password: `AthleteOrgCtx${label}Athlete!2026`,
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
    displayName: `Athlete Org Ctx ${label} Athlete`,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

// Seeds a beta17_coach_relationship record directly, mirroring the same
// "connect athlete" test-seeding convention used by
// test/org_visibility_lifecycle_persistent.integration.test.mjs - this is a
// real, live, unauthenticated product-record route, not a test-only
// shortcut.
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
    revoked_at_iso8601: (state === "declined" || state === "revoked") ? now : null,
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

async function getOwnOrgContext(baseUrl, athlete, label) {
  const result = await request(baseUrl, "GET", "/coach-workspace/org-context/mine", undefined, {
    cookie: athlete.cookie
  });
  assertStatus(result, 200, `${label} reads own org context`);
  return result;
}

test(
  "Athlete org context: accepted+active resolves org context, invited/declined/accepted-but-invited-membership all resolve to zero, individual+shared both surface, no cross-athlete leakage, fresh-process restart",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    let restarted = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];

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
      for (const userId of [...coachUserIds, ...athleteUserIds]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      const relationshipUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (relationshipUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [relationshipUserIds]
        ).catch(() => {});
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
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const athlete3 = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(athlete3.userId);
    const athlete4 = await registerAthlete(baseUrl, nonce, "4");
    athleteUserIds.push(athlete4.userId);

    // ============================================================
    // A shared-mode org with coachA as an ACTIVE member, and an
    // individual-mode org with coachB as an ACTIVE member.
    // ============================================================
    const sharedOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Athlete Org Ctx Shared Team", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(sharedOrg, 201, "create shared-mode org");
    const sharedOrgId = sharedOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to shared org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `accept_${nonce}_a`);

    const individualOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Athlete Org Ctx Individual Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(individualOrg, 201, "create individual-mode org");
    const individualOrgId = individualOrg.json?.organisation?.org_id;

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB to individual org");
    await acceptOrgInvite(baseUrl, coachB, inviteB.json?.membership?.membership_id, `accept_${nonce}_b`);

    // coachC is invited to the shared org but never accepts - membership
    // stays "invited", never "active".
    const inviteC = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachC.email, request_id: `invite_${nonce}_c` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteC, 201, "invite coachC to shared org (never accepted)");

    // ============================================================
    // athlete1: accepted with coachA (shared, active) AND accepted with
    // coachB (individual, active) - expects both org contexts.
    // athlete2: only INVITED (not accepted) with coachA - expects zero.
    // athlete3: DECLINED with coachA - expects zero.
    // athlete4: ACCEPTED with coachC, but coachC's org membership is still
    // invited (not active) - expects zero.
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `athlete_org_ctx_rel_${nonce}_1a`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `athlete_org_ctx_rel_${nonce}_1b`, coachUserId: coachB.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `athlete_org_ctx_rel_${nonce}_2a`, coachUserId: coachA.userId, athleteUserId: athlete2.userId, state: "invited"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `athlete_org_ctx_rel_${nonce}_3a`, coachUserId: coachA.userId, athleteUserId: athlete3.userId, state: "declined"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `athlete_org_ctx_rel_${nonce}_4c`, coachUserId: coachC.userId, athleteUserId: athlete4.userId, state: "accepted"
    });

    const athlete1Context = await getOwnOrgContext(baseUrl, athlete1, "athlete1");
    const athlete1Contexts = athlete1Context.json?.contexts ?? [];
    assert.equal(athlete1Contexts.length, 2, "athlete1 should see both org contexts");
    const athlete1Shared = athlete1Contexts.find((entry) => entry.org_id === sharedOrgId);
    const athlete1Individual = athlete1Contexts.find((entry) => entry.org_id === individualOrgId);
    assert.ok(athlete1Shared, "expected the shared org context");
    assert.equal(athlete1Shared.org_name, "Athlete Org Ctx Shared Team");
    assert.equal(athlete1Shared.visibility_mode, "shared");
    assert.ok(athlete1Individual, "expected the individual org context");
    assert.equal(athlete1Individual.org_name, "Athlete Org Ctx Individual Gym");
    assert.equal(athlete1Individual.visibility_mode, "individual");

    const athlete2Context = await getOwnOrgContext(baseUrl, athlete2, "athlete2");
    assert.equal(athlete2Context.json?.contexts?.length, 0, "athlete2 (invited-only relationship) should see zero contexts");

    const athlete3Context = await getOwnOrgContext(baseUrl, athlete3, "athlete3");
    assert.equal(athlete3Context.json?.contexts?.length, 0, "athlete3 (declined relationship) should see zero contexts");

    const athlete4Context = await getOwnOrgContext(baseUrl, athlete4, "athlete4");
    assert.equal(athlete4Context.json?.contexts?.length, 0, "athlete4 (accepted but coach's org membership still invited) should see zero contexts");

    // ============================================================
    // No cross-athlete leakage: none of the other athletes' raw responses
    // ever mention the shared org's name/id that only athlete1 should see.
    // ============================================================
    for (const [label, result] of [["athlete2", athlete2Context], ["athlete3", athlete3Context], ["athlete4", athlete4Context]]) {
      assert.equal(result.text.includes(sharedOrgId), false, `${label} response must never mention the shared org id`);
      assert.equal(result.text.includes("Athlete Org Ctx Shared Team"), false, `${label} response must never mention the shared org name`);
    }

    // ============================================================
    // Fresh-process restart: athlete1's two contexts reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedContext = await getOwnOrgContext(restarted.baseUrl, athlete1, "athlete1 (restarted)");
    const restartedContexts = restartedContext.json?.contexts ?? [];
    assert.equal(restartedContexts.length, 2, "athlete1 should still see both org contexts after restart");
    assert.ok(restartedContexts.some((entry) => entry.org_id === sharedOrgId && entry.visibility_mode === "shared"));
    assert.ok(restartedContexts.some((entry) => entry.org_id === individualOrgId && entry.visibility_mode === "individual"));
  }
);
