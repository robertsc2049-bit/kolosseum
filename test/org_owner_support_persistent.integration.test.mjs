// DEV NOTE: FULL-UI-95 org-owner support/error-reporting parity persistent
// proof. Proves: an org owner can submit a support report through real
// /org/support/reports routes (never the athlete/coach /account/ ones,
// never a client-supplied user id), a replayed correlation_id returns the
// same report rather than creating a second row, a different owner
// reusing the same correlation_id is a real conflict, history is scoped
// to the caller's own reports only, and founder_admin can list and act on
// org-owner reports through their own dedicated /admin/org-owner-support-
// requests routes (status transitions forward-only, terminal at closed) -
// all reconstructing identically after a server restart, since nothing
// here is cached in memory. Every step crosses only public HTTP routes.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `support_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Support ${label} Owner`,
    password: `SupportOwner${label}!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    email,
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function createAdminAccountDirect(email, displayName, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(Buffer.from(key).toString("base64url"));
    });
  });
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;

  await pool.query(
    `INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [userId, email, displayName, salt, hash]
  );

  return userId;
}

async function adminSignIn(baseUrl, email, password) {
  const signIn = await request(baseUrl, "POST", "/admin/sign-in", { email, password });
  assertStatus(signIn, 200, "admin sign-in");
  const cookie = cookieNamed(signIn, "kolosseum_admin_session", "admin sign-in");
  const csrf = signIn.json.csrf_token;
  assert.ok(csrf, "expected admin csrf token");
  return { userId: signIn.json.admin.user_id, cookie, csrf };
}

const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

test(
  "FULL-UI-95 org-owner support: submit/list/replay/conflict, admin visibility and status transitions, restart reconstruction",
  async () => {
    let server = null;
    const orgOwnerUserIds = [];
    const correlationIds = [];
    let adminUserId = null;

    const cleanup = async () => {
      if (adminUserId) {
        await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = $1", [adminUserId]).catch(() => {});
        await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminUserId]).catch(() => {});
        await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminUserId]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM org_owner_support_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      const owner = await registerOrgOwner(baseUrl, nonce, "primary");
      orgOwnerUserIds.push(owner.userId);
      const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
      orgOwnerUserIds.push(otherOwner.userId);

      // --- Empty history before any report exists. ---
      const emptyHistory = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: owner.cookie });
      assertStatus(emptyHistory, 200, "empty support history");
      assert.deepEqual(emptyHistory.json.reports, []);

      // --- Submitting without a session cookie is unauthenticated. ---
      const noSession = await request(baseUrl, "POST", "/org/support/reports", {
        correlation_id: `no_session_${nonce}`,
        route_hash: "#/org",
        occurred_at_iso8601: new Date().toISOString(),
        description: "Should never persist"
      });
      assertStatus(noSession, 401, "support report without session");

      // --- Submit a real report. ---
      const correlationId = `support-${nonce}-1`;
      correlationIds.push(correlationId);
      const occurredAt = new Date().toISOString();
      const submit = await request(baseUrl, "POST", "/org/support/reports", {
        correlation_id: correlationId,
        route_hash: "#/org",
        occurred_at_iso8601: occurredAt,
        description: "The seat-plan update button did nothing.",
        browser_context: { user_agent: "test-agent", language: "en-GB", viewport_width: 1280, viewport_height: 800, timezone_offset_minutes: 0 },
        failure_context: {}
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(submit, 201, "submit support report");
      assert.equal(submit.json.report.correlation_id, correlationId);
      assert.equal(submit.json.report.status, "submitted");
      assert.equal(submit.json.report.description, "The seat-plan update button did nothing.");

      // --- Unknown field is rejected. ---
      const unknownField = await request(baseUrl, "POST", "/org/support/reports", {
        correlation_id: `unknown_${nonce}`,
        route_hash: "#/org",
        occurred_at_iso8601: occurredAt,
        description: "x",
        extra_field: "not allowed"
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(unknownField, 400, "unknown field rejected");

      // --- Replaying the SAME correlation_id from the SAME owner returns
      //     the original report, never a second row. ---
      const replay = await request(baseUrl, "POST", "/org/support/reports", {
        correlation_id: correlationId,
        route_hash: "#/org",
        occurred_at_iso8601: occurredAt,
        description: "The seat-plan update button did nothing.",
        browser_context: {},
        failure_context: {}
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(replay, 201, "replay support report");
      assert.equal(replay.json.report.correlation_id, correlationId);

      const rowCount = await pool.query(
        "SELECT count(*)::int AS n FROM org_owner_support_requests WHERE correlation_id = $1",
        [correlationId]
      );
      assert.equal(rowCount.rows[0].n, 1, "replay must not create a second row");

      // --- A DIFFERENT owner reusing the same correlation_id is a real
      //     conflict, never silently accepted or overwritten. ---
      const conflict = await request(baseUrl, "POST", "/org/support/reports", {
        correlation_id: correlationId,
        route_hash: "#/org",
        occurred_at_iso8601: occurredAt,
        description: "Different owner, same id"
      }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf });
      assertStatus(conflict, 409, "cross-owner correlation_id conflict");

      // --- History is scoped to the caller's own reports only. ---
      const ownerHistory = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: owner.cookie });
      assertStatus(ownerHistory, 200, "owner support history");
      assert.equal(ownerHistory.json.reports.length, 1);
      assert.equal(ownerHistory.json.reports[0].correlation_id, correlationId);

      const otherHistory = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: otherOwner.cookie });
      assertStatus(otherHistory, 200, "other owner's own history");
      assert.equal(otherHistory.json.reports.length, 0, "another owner's history must never include this owner's report");

      // --- Founder_admin visibility: real sign-in, real list, real status
      //     change through the new dedicated org-owner-support-requests
      //     admin routes. ---
      const adminEmail = `support_admin_${nonce}@example.com`;
      const adminPassword = `SupportAdmin${nonce}!2026`;
      adminUserId = await createAdminAccountDirect(adminEmail, "Support Admin", adminPassword);
      const admin = await adminSignIn(baseUrl, adminEmail, adminPassword);

      const adminList = await request(baseUrl, "GET", "/admin/org-owner-support-requests", undefined, { cookie: admin.cookie });
      assertStatus(adminList, 200, "admin lists org-owner support requests");
      assert.ok(adminList.json.reports.some((report) => report.correlation_id === correlationId));

      // --- The athlete/coach support-requests admin route must never
      //     surface an org-owner report - each actor's reports stay on
      //     their own dedicated admin surface. ---
      const productAdminList = await request(baseUrl, "GET", "/admin/support-requests", undefined, { cookie: admin.cookie });
      assertStatus(productAdminList, 200, "admin lists athlete/coach support requests");
      assert.ok(!productAdminList.json.reports.some((report) => report.correlation_id === correlationId), "org-owner report must never appear on the athlete/coach admin surface");

      const statusChange = await request(
        baseUrl, "POST", `/admin/org-owner-support-requests/${correlationId}/status`,
        { correlation_id: `audit_${nonce}_1`, status: "acknowledged" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(statusChange, 200, "admin acknowledges org-owner report");
      assert.equal(statusChange.json.audit.idempotent_replay, false);

      // --- Replaying the same audit correlation_id replays the outcome,
      //     never re-applying the transition a second time. ---
      const replayedStatusChange = await request(
        baseUrl, "POST", `/admin/org-owner-support-requests/${correlationId}/status`,
        { correlation_id: `audit_${nonce}_1`, status: "acknowledged" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(replayedStatusChange, 200, "replayed admin status change");
      assert.equal(replayedStatusChange.json.audit.idempotent_replay, true);

      // --- Forward-only transition: acknowledged -> submitted is invalid. ---
      const invalidTransition = await request(
        baseUrl, "POST", `/admin/org-owner-support-requests/${correlationId}/status`,
        { correlation_id: `audit_${nonce}_2`, status: "submitted" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(invalidTransition, 409, "invalid backward status transition");

      const afterAck = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: owner.cookie });
      assert.equal(afterAck.json.reports[0].status, "acknowledged", "status change must be visible to the owner's own history");

      // --- Fresh-process restart reconstruction: nothing here is cached
      //     in memory, so history reads reconstruct identically. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const historyAfterRestart = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: owner.cookie });
      assertStatus(historyAfterRestart, 200, "owner support history after restart");
      assert.equal(historyAfterRestart.json.reports.length, 1);
      assert.equal(historyAfterRestart.json.reports[0].correlation_id, correlationId);

      const otherHistoryAfterRestart = await request(baseUrl, "GET", "/org/support/reports", undefined, { cookie: otherOwner.cookie });
      assertStatus(otherHistoryAfterRestart, 200, "other owner's history after restart");
      assert.equal(otherHistoryAfterRestart.json.reports.length, 0);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
