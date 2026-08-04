// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.2) - org roster lifecycle proof. Proves an org owner can invite an
// EXISTING coach account by email only (never by typing the coach's
// internal user_id), that the coach accepts/leaves through their own
// session using only a membership_id their own list already supplied, that
// removed/left memberships remain visible as preserved history, idempotent
// retry via request_id, cross-org access denial, and that all of this
// survives a fresh-process restart. Every step crosses only public HTTP
// routes.

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
  const email = `org_roster_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Roster ${label} Owner`,
    password: `OrgRoster${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_roster_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Roster ${label} Coach`,
    email,
    password: `OrgRoster${label}Coach!2026`,
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

test(
  "Org roster lifecycle: invite-by-email, coach accept/leave from own session, org-owner remove, preserved history, idempotent retry, cross-org isolation, fresh-process restart",
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

    // ============================================================
    // Create the organisation.
    // ============================================================
    const created = await request(baseUrl, "POST", "/org/organisations", { org_name: "Org Roster Test Gym" }, {
      cookie: owner.cookie, csrf: owner.csrf
    });
    assertStatus(created, 201, "create organisation");
    const orgId = created.json?.organisation?.org_id;
    assert.ok(orgId, "expected an org_id");

    // ============================================================
    // Invite coachA BY EMAIL ONLY - never the coach's internal user_id.
    // ============================================================
    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coachA by email");
    const membershipAId = invite.json?.membership?.membership_id;
    assert.ok(membershipAId, "expected a membership_id");
    assert.equal(invite.json?.membership?.membership_status, "invited");

    // Idempotent retry: the same request_id must not create a duplicate.
    const inviteReplay = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteReplay, 201, "idempotent invite replay");
    assert.equal(inviteReplay.json?.membership?.membership_id, membershipAId);

    const auditCount = await pool.query(
      "SELECT count(*)::int AS n FROM product_org_audit_records WHERE org_id = $1 AND action_type = 'coach_invited'",
      [orgId]
    );
    assert.equal(auditCount.rows[0].n, 1, "a replayed invite must not create a second audit record");

    // Inviting the same already-invited coach again with a NEW request_id
    // is rejected as already-a-member.
    const duplicateInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a_dup` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(duplicateInvite, 409, "duplicate invite of an already-invited coach");

    // ============================================================
    // coachA reads their OWN pending memberships from their OWN session,
    // never a client-supplied coach id, then accepts.
    // ============================================================
    const coachAMemberships = await request(baseUrl, "GET", "/coach-workspace/org-memberships", undefined, {
      cookie: coachA.cookie
    });
    assertStatus(coachAMemberships, 200, "coachA reads own org memberships");
    assert.equal(coachAMemberships.json?.memberships?.length, 1);
    assert.equal(coachAMemberships.json?.memberships?.[0]?.membership_id, membershipAId);
    assert.equal(coachAMemberships.json?.memberships?.[0]?.membership_status, "invited");

    const accept = await request(
      baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipAId)}/accept`,
      { request_id: `accept_${nonce}_a` }, { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assertStatus(accept, 200, "coachA accepts org membership");
    assert.equal(accept.json?.membership?.membership_status, "active");

    // coachB never accepted coachA's membership - coachB has no memberships.
    const coachBMemberships = await request(baseUrl, "GET", "/coach-workspace/org-memberships", undefined, {
      cookie: coachB.cookie
    });
    assertStatus(coachBMemberships, 200, "coachB reads own (empty) org memberships");
    assert.equal(coachBMemberships.json?.memberships?.length, 0);

    // coachB cannot accept coachA's membership using a copied membership_id.
    const coachBStealAccept = await request(
      baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipAId)}/accept`,
      { request_id: `steal_${nonce}` }, { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(coachBStealAccept, 403, "coachB cannot act on coachA's membership");

    // ============================================================
    // Org owner views the roster - sees coachA active.
    // ============================================================
    const roster = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/roster`, undefined, {
      cookie: owner.cookie
    });
    assertStatus(roster, 200, "org owner views roster");
    assert.equal(roster.json?.roster?.length, 1);
    assert.equal(roster.json?.roster?.[0]?.membership_status, "active");

    // ============================================================
    // Org owner removes coachA. The membership remains visible as
    // preserved history, not deleted.
    // ============================================================
    const removed = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/${encodeURIComponent(membershipAId)}/remove`,
      { request_id: `remove_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(removed, 200, "org owner removes coachA");
    assert.equal(removed.json?.membership?.membership_status, "removed");

    const rosterAfterRemove = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/roster`, undefined, {
      cookie: owner.cookie
    });
    assertStatus(rosterAfterRemove, 200, "roster after remove");
    assert.equal(rosterAfterRemove.json?.roster?.length, 1, "removed membership remains visible as preserved history");
    assert.equal(rosterAfterRemove.json?.roster?.[0]?.membership_status, "removed");

    // ============================================================
    // Invite + coach-initiated self-service leave (coachB).
    // ============================================================
    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB by email");
    const membershipBId = inviteB.json?.membership?.membership_id;

    const acceptB = await request(
      baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipBId)}/accept`,
      { request_id: `accept_${nonce}_b` }, { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(acceptB, 200, "coachB accepts org membership");

    const leaveB = await request(
      baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipBId)}/leave`,
      { request_id: `leave_${nonce}_b` }, { cookie: coachB.cookie, csrf: coachB.csrf }
    );
    assertStatus(leaveB, 200, "coachB leaves the organisation voluntarily");
    assert.equal(leaveB.json?.membership?.membership_status, "removed");

    // ============================================================
    // Cross-org isolation: a second, unrelated org owner cannot read or
    // act on the first owner's organisation.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);

    const crossOrgRosterRead = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/roster`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOrgRosterRead, 403, "an unrelated org owner cannot read another org's roster");

    const crossOrgInvite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `cross_${nonce}` },
      { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assertStatus(crossOrgInvite, 403, "an unrelated org owner cannot invite into another org");

    // ============================================================
    // Isolation from athlete-scoped data: this org owner's own session
    // must never satisfy any coach-scoped or athlete-scoped route.
    // ============================================================
    const ownerAgainstCoachRoute = await request(
      baseUrl, "GET", "/coach-workspace/athletes?coach_user_id=whatever", undefined,
      { cookie: owner.cookie }
    );
    assert.notEqual(ownerAgainstCoachRoute.response.status, 200, "an org owner session must never satisfy a coach-scoped route");

    // ============================================================
    // Fresh-process restart: roster and membership state reconstruct
    // identically from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedRoster = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/roster`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedRoster, 200, "roster after fresh-process restart");
    assert.equal(restartedRoster.json?.roster?.length, 2, "both historical memberships must survive a fresh-process restart");
    assert.ok(
      restartedRoster.json?.roster?.every((entry) => entry.membership_status === "removed"),
      "both memberships must still show removed after restart"
    );
  }
);
