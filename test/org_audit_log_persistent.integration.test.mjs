// DEV NOTE: Organisation/team billing commercial expansion (part O.9) - org
// owner audit-log read proof. Every real mutation in org_roster_service.ts
// and org_billing_service.ts already writes a factual audit record via
// writeAuditRecord()/withIdempotentAudit() (org_created, coach_invited,
// coach_membership_activated, coach_membership_removed, seat_plan_changed),
// but until this slice the only SELECT against product_org_audit_records
// anywhere was the write-side's own idempotency lookup - the org owner had
// no route to ever read their own organisation's recorded activity back.
// This proves the new GET .../audit-log route surfaces every one of those
// facts, newest-first, isolated per org, and survives a fresh-process
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
  const email = `org_audit_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Org Audit ${label} Owner`,
    password: `OrgAudit${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `org_audit_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Org Audit ${label} Coach`,
    email,
    password: `OrgAudit${label}Coach!2026`,
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
  "Org audit log: every real mutation (org_created, coach_invited, coach_membership_activated, seat_plan_changed, coach_membership_removed) is surfaced newest-first through the new audit-log route, isolated per org, and survives a fresh-process restart",
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
    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);

    // ============================================================
    // Creating an org already writes an org_created audit record - before
    // this route existed, this fact was permanently write-only.
    // ============================================================
    const createdOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Audit Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(createdOrg, 201, "create org");
    const orgId = createdOrg.json?.organisation?.org_id;

    const invite = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
      { coach_email: coach.email, request_id: `invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(invite, 201, "invite coach");
    const membershipId = invite.json?.membership?.membership_id;

    const accept = await request(
      baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
      { request_id: `accept_${nonce}` }, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(accept, 200, "coach accepts membership");

    const seatPlan = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/billing/seat-plan`,
      { seat_limit: 5, request_id: `seat_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(seatPlan, 200, "change seat plan");

    const remove = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/${encodeURIComponent(membershipId)}/remove`,
      { request_id: `remove_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(remove, 200, "remove coach membership");

    // ============================================================
    // The audit-log route surfaces every one of those five facts,
    // newest-first (created_at DESC).
    // ============================================================
    const auditLog = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/audit-log`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(auditLog, 200, "org owner reads audit log");
    const records = auditLog.json?.audit_log ?? [];
    assert.equal(records.length, 5, "expected all five recorded mutations");

    const actionTypesNewestFirst = records.map((record) => record.action_type);
    assert.deepEqual(
      actionTypesNewestFirst,
      [
        "coach_membership_removed",
        "seat_plan_changed",
        "coach_membership_activated",
        "coach_invited",
        "org_created"
      ],
      "expected newest-first ordering matching the real mutation sequence"
    );

    const orgCreatedRecord = records.find((record) => record.action_type === "org_created");
    assert.equal(orgCreatedRecord.actor_role, "org_owner");
    assert.equal(orgCreatedRecord.actor_user_id, owner.userId);
    assert.equal(orgCreatedRecord.after_state?.org_name, "Org Audit Gym");

    const activatedRecord = records.find((record) => record.action_type === "coach_membership_activated");
    assert.equal(activatedRecord.actor_role, "coach");
    assert.equal(activatedRecord.actor_user_id, coach.userId);

    const seatPlanRecord = records.find((record) => record.action_type === "seat_plan_changed");
    assert.equal(seatPlanRecord.after_state?.seat_limit, 5);

    // ============================================================
    // Cross-org isolation: an unrelated org owner cannot read this org's
    // audit log.
    // ============================================================
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
    orgOwnerUserIds.push(otherOwner.userId);
    const crossOrgAuditLog = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/audit-log`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(crossOrgAuditLog, 403, "an unrelated org owner cannot read another org's audit log");

    // A freshly created org for the unrelated owner has zero audit records
    // of its own until they act - the empty-state path.
    const otherOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Org Audit Other Gym", visibility_mode: "individual"
    }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf });
    assertStatus(otherOrg, 201, "create unrelated org");
    const otherOrgId = otherOrg.json?.organisation?.org_id;
    const otherOrgAuditLog = await request(
      baseUrl, "GET", `/org/organisations/${encodeURIComponent(otherOrgId)}/audit-log`, undefined,
      { cookie: otherOwner.cookie }
    );
    assertStatus(otherOrgAuditLog, 200, "unrelated owner reads own org's audit log");
    assert.equal(otherOrgAuditLog.json?.audit_log?.length, 1, "expected only the unrelated org's own org_created record");
    assert.equal(otherOrgAuditLog.json?.audit_log?.[0]?.action_type, "org_created");

    // ============================================================
    // Fresh-process restart: the audit log reconstructs identically from
    // Postgres.
    // ============================================================
    restarted = await startFreshServerProcess(root, process.env);

    const restartedAuditLog = await request(
      restarted.baseUrl, "GET", `/org/organisations/${encodeURIComponent(orgId)}/audit-log`, undefined,
      { cookie: owner.cookie }
    );
    assertStatus(restartedAuditLog, 200, "audit log after fresh-process restart");
    assert.deepEqual(
      restartedAuditLog.json?.audit_log?.map((record) => record.action_type),
      [
        "coach_membership_removed",
        "seat_plan_changed",
        "coach_membership_activated",
        "coach_invited",
        "org_created"
      ]
    );
  }
);
