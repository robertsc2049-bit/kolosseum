// DEV NOTE: Organisation/team billing commercial expansion (part C) - org
// owner athlete visibility lifecycle proof. Proves an "individual"-mode org
// owner sees aggregate athlete counts ONLY (no athlete_user_id, no name,
// anywhere in the raw response), a "shared"-mode org owner sees a real
// per-coach athlete roster, a coach sees the org's visibility_mode before
// they accept an invite, cross-org isolation holds, an invalid
// visibility_mode is rejected at creation, and all of this survives a
// fresh-process restart. Every step crosses only public HTTP routes.

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
  const email = `org_vis_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Vis ${label} Owner`,
    password: `OrgVis${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_vis_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Vis ${label} Coach`,
    email,
    password: `OrgVis${label}Coach!2026`,
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
  const email = `org_vis_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Org Vis ${label} Athlete`,
    email,
    password: `OrgVis${label}Athlete!2026`,
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
    displayName: `Org Vis ${label} Athlete`
  };
}

// Seeds a beta17_coach_relationship record directly, mirroring the same
// "connect athlete" test-seeding convention used by
// test/full_ui_23_coach_athlete_journey_persistent.integration.test.mjs
// (POST /sessions/beta-coach-relationship) - this is a real, live,
// unauthenticated product-record route, not a test-only shortcut.
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
    revoked_at_iso8601: null,
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

test(
  "Org athlete visibility: individual-mode aggregate-only counts, shared-mode full roster, pre-acceptance visibility signal, cross-org isolation, invalid visibility_mode rejected, fresh-process restart",
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
    const coachD = await registerCoach(baseUrl, nonce, "d");
    coachUserIds.push(coachD.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athlete2.userId);
    const athlete3 = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(athlete3.userId);
    const athlete4 = await registerAthlete(baseUrl, nonce, "4");
    athleteUserIds.push(athlete4.userId);

    // ============================================================
    // Invalid visibility_mode is rejected outright at creation.
    // ============================================================
    const invalidModeOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Vis Invalid Mode", visibility_mode: "everyone"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(invalidModeOrg, 400, "invalid visibility_mode is rejected");
    assert.equal(invalidModeOrg.json?.error, "org_roster_visibility_mode_invalid");

    // ============================================================
    // Create an "individual"-mode org, invite+accept coachA and coachB.
    // ============================================================
    const individualOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Vis Individual Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(individualOrg, 201, "create individual-mode org");
    assert.equal(individualOrg.json?.organisation?.visibility_mode, "individual");
    const individualOrgId = individualOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to individual org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `accept_${nonce}_a`);

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB to individual org");
    await acceptOrgInvite(baseUrl, coachB, inviteB.json?.membership?.membership_id, `accept_${nonce}_b`);

    // ============================================================
    // Seed real relationships: coachA has 1 accepted + 1 invited athlete,
    // coachB has 1 accepted athlete.
    // ============================================================
    await seedRelationship(baseUrl, {
      relationshipId: `org_vis_rel_${nonce}_a1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `org_vis_rel_${nonce}_a2`, coachUserId: coachA.userId, athleteUserId: athlete2.userId, state: "invited"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `org_vis_rel_${nonce}_b3`, coachUserId: coachB.userId, athleteUserId: athlete3.userId, state: "accepted"
    });

    // ============================================================
    // The individual-mode org owner sees AGGREGATE COUNTS ONLY - the raw
    // response must never contain an athlete_user_id or any athlete's
    // display name/email, anywhere.
    // ============================================================
    const individualVisibility = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(individualVisibility, 200, "individual-mode org owner reads athlete visibility");
    assert.equal(individualVisibility.json?.visibility?.visibility_mode, "individual");

    const individualCoaches = individualVisibility.json?.visibility?.coaches ?? [];
    const coachAEntry = individualCoaches.find((entry) => entry.coach_user_id === coachA.userId);
    const coachBEntry = individualCoaches.find((entry) => entry.coach_user_id === coachB.userId);
    assert.ok(coachAEntry, "expected coachA in the aggregate view");
    assert.ok(coachBEntry, "expected coachB in the aggregate view");
    assert.equal(coachAEntry.active_athlete_count, 1);
    assert.equal(coachAEntry.invited_athlete_count, 1);
    assert.equal(coachBEntry.active_athlete_count, 1);
    assert.equal(coachBEntry.invited_athlete_count, 0);

    const rawIndividualResponse = individualVisibility.text;
    assert.equal(rawIndividualResponse.includes("athlete_user_id"), false, "individual mode must never mention athlete_user_id");
    for (const athlete of [athlete1, athlete2, athlete3]) {
      assert.equal(rawIndividualResponse.includes(athlete.userId), false, `individual mode must never mention ${athlete.userId}`);
      assert.equal(rawIndividualResponse.includes(athlete.email), false, `individual mode must never mention ${athlete.email}`);
      assert.equal(rawIndividualResponse.includes(athlete.displayName), false, `individual mode must never mention ${athlete.displayName}`);
    }

    // ============================================================
    // Pre-acceptance visibility signal: a coach invited (but not yet
    // accepted) to the individual org already sees its visibility_mode.
    // ============================================================
    const inviteD = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(individualOrgId)}/roster/invite`,
      { coach_email: coachD.email, request_id: `invite_${nonce}_d_individual` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteD, 201, "invite coachD to individual org (not yet accepted)");

    const coachDMembershipsIndividual = await request(baseUrl, "GET", "/coach-workspace/org-memberships", undefined, {
      cookie: coachD.cookie
    });
    assertStatus(coachDMembershipsIndividual, 200, "coachD reads own pending memberships (individual org)");
    const pendingIndividual = coachDMembershipsIndividual.json?.memberships?.find(
      (entry) => entry.membership_id === inviteD.json?.membership?.membership_id
    );
    assert.ok(pendingIndividual, "expected the pending individual-org membership");
    assert.equal(pendingIndividual.visibility_mode, "individual");

    // ============================================================
    // Cross-org isolation: an unrelated org owner cannot read this org's
    // athlete visibility.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);
    const crossOrgVisibility = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOrgVisibility, 403, "an unrelated org owner cannot read another org's athlete visibility");

    // ============================================================
    // Create a "shared"-mode org (e.g. a team/unit), invite+accept coachC,
    // seed a real accepted relationship, and confirm the owner sees the
    // full roster - athlete identity IS present here, by design.
    // ============================================================
    const sharedOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Vis Shared Team", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(sharedOrg, 201, "create shared-mode org");
    assert.equal(sharedOrg.json?.organisation?.visibility_mode, "shared");
    const sharedOrgId = sharedOrg.json?.organisation?.org_id;

    const inviteC = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachC.email, request_id: `invite_${nonce}_c` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteC, 201, "invite coachC to shared org");
    await acceptOrgInvite(baseUrl, coachC, inviteC.json?.membership?.membership_id, `accept_${nonce}_c`);

    await seedRelationship(baseUrl, {
      relationshipId: `org_vis_rel_${nonce}_c4`, coachUserId: coachC.userId, athleteUserId: athlete4.userId, state: "accepted"
    });

    const sharedVisibility = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/athlete-visibility`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(sharedVisibility, 200, "shared-mode org owner reads athlete visibility");
    assert.equal(sharedVisibility.json?.visibility?.visibility_mode, "shared");

    const sharedCoaches = sharedVisibility.json?.visibility?.coaches ?? [];
    const coachCEntry = sharedCoaches.find((entry) => entry.coach_user_id === coachC.userId);
    assert.ok(coachCEntry, "expected coachC in the shared roster view");
    assert.equal(coachCEntry.athletes?.length, 1);
    assert.equal(coachCEntry.athletes?.[0]?.athlete_user_id, athlete4.userId);
    assert.equal(coachCEntry.athletes?.[0]?.display_name, athlete4.displayName);
    assert.equal(coachCEntry.athletes?.[0]?.relationship_state, "accepted");

    // ============================================================
    // Pre-acceptance visibility signal for a "shared" org: invite coachD
    // (not yet accepted) and confirm they see "shared" before accepting.
    // ============================================================
    const inviteDShared = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(sharedOrgId)}/roster/invite`,
      { coach_email: coachD.email, request_id: `invite_${nonce}_d_shared` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteDShared, 201, "invite coachD to shared org (not yet accepted)");

    const coachDMembershipsShared = await request(baseUrl, "GET", "/coach-workspace/org-memberships", undefined, {
      cookie: coachD.cookie
    });
    assertStatus(coachDMembershipsShared, 200, "coachD reads own pending memberships (shared org)");
    const pendingShared = coachDMembershipsShared.json?.memberships?.find(
      (entry) => entry.membership_id === inviteDShared.json?.membership?.membership_id
    );
    assert.ok(pendingShared, "expected the pending shared-org membership");
    assert.equal(pendingShared.visibility_mode, "shared");

    // ============================================================
    // Fresh-process restart: both visibility results reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedIndividual = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(individualOrgId)}/athlete-visibility`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedIndividual, 200, "individual-mode visibility after fresh-process restart");
    assert.equal(restartedIndividual.json?.visibility?.visibility_mode, "individual");
    const restartedCoachA = restartedIndividual.json?.visibility?.coaches?.find((entry) => entry.coach_user_id === coachA.userId);
    assert.equal(restartedCoachA?.active_athlete_count, 1);
    assert.equal(restartedCoachA?.invited_athlete_count, 1);
    assert.equal(restartedIndividual.text.includes("athlete_user_id"), false);

    const restartedShared = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(sharedOrgId)}/athlete-visibility`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedShared, 200, "shared-mode visibility after fresh-process restart");
    assert.equal(restartedShared.json?.visibility?.visibility_mode, "shared");
    const restartedCoachC = restartedShared.json?.visibility?.coaches?.find((entry) => entry.coach_user_id === coachC.userId);
    assert.equal(restartedCoachC?.athletes?.[0]?.athlete_user_id, athlete4.userId);
  }
);
