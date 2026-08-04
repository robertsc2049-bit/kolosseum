// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.3) - org seat-entitlement billing lifecycle proof. Proves seat usage
// reporting, that an invite is genuinely blocked once the org's seat plan
// is exhausted, that only the org owner can change the seat plan, that
// increasing the plan lets a previously-blocked invite through, and that
// all of this survives a fresh-process restart. Every step crosses only
// public HTTP routes.

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
  const email = `org_billing_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Billing ${label} Owner`,
    password: `OrgBilling${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_billing_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Billing ${label} Coach`,
    email,
    password: `OrgBilling${label}Coach!2026`,
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
  "Org billing lifecycle: seat usage reporting, invite blocked at limit, owner-only seat plan change, invite unblocked after increase, fresh-process restart",
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
    // Create the organisation, then set an explicit small seat plan so
    // this test is deterministic regardless of any env-var default.
    // ============================================================
    const created = await request(baseUrl, "POST", "/org/organisations", { org_name: "Org Billing Test Gym" }, {
      cookie: owner.cookie, csrf: owner.csrf
    });
    assertStatus(created, 201, "create organisation");
    const orgId = created.json?.organisation?.org_id;
    assert.ok(orgId, "expected an org_id");

    const initialStatus = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(initialStatus, 200, "initial billing status");
    assert.equal(initialStatus.json?.billing?.occupied_seat_count, 0, "a fresh org has zero occupied seats");

    const setPlan = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 1, request_id: `seat_plan_${nonce}_initial` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(setPlan, 200, "set initial seat plan to 1");
    assert.equal(setPlan.json?.billing?.seat_limit, 1);

    const statusAfterPlan = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(statusAfterPlan, 200, "billing status after setting plan");
    assert.equal(statusAfterPlan.json?.billing?.seat_plan_configured, true);
    assert.equal(statusAfterPlan.json?.billing?.seat_limit, 1);
    assert.equal(statusAfterPlan.json?.billing?.occupied_seat_count, 0);
    assert.equal(statusAfterPlan.json?.billing?.available_seat_count, 1);

    // ============================================================
    // Inviting coachA consumes the org's one seat (a pending invite
    // reserves the seat, it does not need to be accepted first).
    // ============================================================
    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `invite_${nonce}_a` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA consumes the one available seat");

    const statusAfterInviteA = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(statusAfterInviteA, 200, "billing status after inviting coachA");
    assert.equal(statusAfterInviteA.json?.billing?.occupied_seat_count, 1);
    assert.equal(statusAfterInviteA.json?.billing?.available_seat_count, 0);

    // ============================================================
    // Inviting coachB is genuinely blocked - the org has no seats left.
    // ============================================================
    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 409, "invite coachB is blocked at the seat limit");
    assert.equal(inviteB.json?.error, "org_billing_seat_limit_exceeded");

    // coachB was never actually invited - no membership row exists for them.
    const rosterAtLimit = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/roster`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(rosterAtLimit, 200, "roster while at the seat limit");
    assert.equal(rosterAtLimit.json?.roster?.length, 1, "the blocked invite must not have created a membership row");

    // seat_limit must be a positive integer - zero/negative is rejected
    // before any occupied-seat comparison even happens.
    const invalidSeatLimit = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 0, request_id: `seat_plan_${nonce}_invalid` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invalidSeatLimit, 400, "seat_limit must be a positive integer");

    // ============================================================
    // Only the org owner can change the seat plan - an unrelated org
    // owner (and a coach session) cannot touch this org's billing at all.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);

    const crossOwnerPlanChange = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 5, request_id: `seat_plan_${nonce}_cross` },
      { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assertStatus(crossOwnerPlanChange, 403, "an unrelated org owner cannot change another org's seat plan");

    const crossOwnerStatusRead = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOwnerStatusRead, 403, "an unrelated org owner cannot read another org's billing status");

    const coachPlanChange = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 5, request_id: `seat_plan_${nonce}_coach` },
      { cookie: coachA.cookie, csrf: coachA.csrf }
    );
    assert.notEqual(coachPlanChange.response.status, 200, "a coach session must never satisfy an org-owner-only billing route");

    // ============================================================
    // Increasing the seat plan unblocks the previously-rejected invite.
    // Idempotent retry of the same seat-plan-change request_id is a no-op.
    // ============================================================
    const increasePlan = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 2, request_id: `seat_plan_${nonce}_increase` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(increasePlan, 200, "increase seat plan to 2");
    assert.equal(increasePlan.json?.billing?.seat_limit, 2);

    const increasePlanReplay = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 999, request_id: `seat_plan_${nonce}_increase` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(increasePlanReplay, 200, "idempotent seat-plan-change replay");
    assert.equal(increasePlanReplay.json?.billing?.seat_limit, 2, "a replayed request_id must not apply the new seat_limit value");

    const seatPlanAuditCount = await pool.query(
      "SELECT count(*)::int AS n FROM product_org_audit_records WHERE org_id = $1 AND action_type = 'seat_plan_changed'",
      [orgId]
    );
    assert.equal(seatPlanAuditCount.rows[0].n, 2, "exactly two real seat_plan_changed audit records: initial=1, increase=2");

    const inviteBAfterIncrease = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `invite_${nonce}_b_retry` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteBAfterIncrease, 201, "invite coachB succeeds after the seat plan increase");

    const statusAfterBothInvited = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(statusAfterBothInvited, 200, "billing status with both coaches invited");
    assert.equal(statusAfterBothInvited.json?.billing?.occupied_seat_count, 2);
    assert.equal(statusAfterBothInvited.json?.billing?.available_seat_count, 0);

    // Reducing the seat plan below the number of seats currently occupied
    // is rejected outright - the org cannot end up structurally overdrawn.
    const reduceBelowOccupied = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 1, request_id: `seat_plan_${nonce}_reduce_below_occupied` },
      { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(reduceBelowOccupied, 409, "seat plan cannot be reduced below the currently occupied seat count");
    assert.equal(reduceBelowOccupied.json?.error, "org_billing_seat_limit_below_occupied");

    // ============================================================
    // Removing a coach frees their seat back up.
    // ============================================================
    const membershipAId = inviteA.json?.membership?.membership_id;
    const removedA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/${encodeURIComponent(membershipAId)}/remove`,
      { request_id: `remove_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(removedA, 200, "org owner removes coachA");

    const statusAfterRemove = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(statusAfterRemove, 200, "billing status after removing coachA");
    assert.equal(statusAfterRemove.json?.billing?.occupied_seat_count, 1, "removing a membership frees its seat");
    assert.equal(statusAfterRemove.json?.billing?.available_seat_count, 1);

    // ============================================================
    // Fresh-process restart: seat usage and plan reconstruct identically
    // from Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);
    const restartedStatus = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/billing`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedStatus, 200, "billing status after fresh-process restart");
    assert.equal(restartedStatus.json?.billing?.seat_limit, 2);
    assert.equal(restartedStatus.json?.billing?.occupied_seat_count, 1);
    assert.equal(restartedStatus.json?.billing?.available_seat_count, 1);
  }
);
