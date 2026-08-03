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
    server.close((error) => error ? reject(error) : resolve());
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

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function anyCookie(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const match = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(match, `${label}: expected ${cookieName} cookie`);
  return String(match).split(";")[0];
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full21FounderAdmin!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(registration, 201, `${label} account registration`);

  const userId = registration.json?.account?.user_id ?? "";
  assert.ok(userId, `${label}: expected registered user_id`);
  const cookie = anyCookie(registration, "kolosseum_session", `${label} account registration`);
  const csrf = registration.json?.csrf_token;
  assert.ok(csrf, `${label}: expected csrf token`);

  return { userId, cookie, csrf };
}

async function createAdminAccountDirect(email, displayName, password) {
  const crypto_ = await import("node:crypto");
  const salt = crypto_.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => {
    crypto_.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(Buffer.from(key).toString("base64url"));
    });
  });
  const userId = `admin_${crypto_.randomUUID().replaceAll("-", "")}`;

  await pool.query(
    `INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`,
    [userId, email, displayName, salt, hash]
  );

  return userId;
}

async function adminSignIn(baseUrl, email, password) {
  const signIn = await request(baseUrl, "POST", "/admin/sign-in", { email, password });
  assertStatus(signIn, 200, "admin sign-in");
  const cookie = anyCookie(signIn, "kolosseum_admin_session", "admin sign-in");
  const csrf = signIn.json.csrf_token;
  assert.ok(csrf, "expected admin csrf token");
  return { userId: signIn.json.admin.user_id, cookie, csrf };
}

test(
  "FULL-UI-21 founder/admin operations: auth, review surfaces, confirmed actions, immutable audit, negative actor-boundary access and restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;

    const userIds = [];
    const adminUserIds = [];
    const correlationIds = [];

    const cleanup = async () => {
      await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = ANY($1::text[])", [adminUserIds]).catch(() => {});
      await pool.query("DELETE FROM product_test_accounts WHERE user_id = ANY($1::text[])", [userIds]).catch(() => {});
      await pool.query("DELETE FROM product_support_requests WHERE user_id = ANY($1::text[])", [userIds]).catch(() => {});
      await pool.query("DELETE FROM product_admin_sessions WHERE user_id = ANY($1::text[])", [adminUserIds]).catch(() => {});
      await pool.query("DELETE FROM product_admin_accounts WHERE user_id = ANY($1::text[])", [adminUserIds]).catch(() => {});
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      const athlete = await registerAccount(baseUrl, "athlete", "Full21 Athlete", nonce);
      userIds.push(athlete.userId);
      const coach = await registerAccount(baseUrl, "coach", "Full21 Coach", nonce);
      userIds.push(coach.userId);

      // A support request for the athlete to review later.
      const supportCorrelationId = crypto.randomUUID();
      const supportReport = await request(baseUrl, "POST", "/account/support/reports", {
        correlation_id: supportCorrelationId,
        route_hash: "#/athlete/today",
        occurred_at_iso8601: new Date().toISOString(),
        description: "Full21 fixture support report",
        browser_context: { user_agent: "test", language: "en-GB", viewport_width: 1280, viewport_height: 800, timezone_offset_minutes: 0 },
        failure_context: {}
      }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(supportReport, 201, "create support report fixture");

      // --- Founder/admin account bootstrap (out-of-band, mirroring the
      //     documented script's INSERT shape) and sign-in. ---
      const adminEmail = `full21_admin_${nonce}@example.com`;
      const adminUserId = await createAdminAccountDirect(adminEmail, "Full21 Admin", "Full21AdminPassword1234");
      adminUserIds.push(adminUserId);

      const admin = await adminSignIn(baseUrl, adminEmail, "Full21AdminPassword1234");
      assert.equal(admin.userId, adminUserId);

      // --- Wrong password / unknown email are rejected without leaking
      //     which case applies. ---
      assertStatus(
        await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "wrong-password-wrong-password" }),
        401,
        "wrong admin password"
      );
      assertStatus(
        await request(baseUrl, "POST", "/admin/sign-in", { email: "no_such_admin@example.com", password: "irrelevant-password-value" }),
        401,
        "unknown admin email"
      );

      // ============================================================
      // Negative access: an athlete/coach session cookie can never
      // satisfy any admin route, and an unauthenticated request is
      // rejected too.
      // ============================================================
      assertStatus(await request(baseUrl, "GET", "/admin/accounts"), 401, "anonymous admin account search");
      assertStatus(
        await request(baseUrl, "GET", "/admin/accounts", undefined, { cookie: athlete.cookie }),
        401,
        "athlete session cookie against admin route"
      );
      assertStatus(
        await request(baseUrl, "GET", "/admin/accounts", undefined, { cookie: coach.cookie }),
        401,
        "coach session cookie against admin route"
      );
      assertStatus(
        await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
          { correlation_id: crypto.randomUUID(), account_state: "suspended" },
          { cookie: athlete.cookie, csrf: athlete.csrf }),
        401,
        "athlete session cookie attempting an admin mutation"
      );
      // Conversely, the admin session cookie must never satisfy an
      // athlete/coach-authenticated route.
      assertStatus(
        await request(baseUrl, "GET", "/account/detail", undefined, { cookie: admin.cookie }),
        401,
        "admin session cookie against an athlete/coach route"
      );

      // ============================================================
      // Account search and account-state review.
      // ============================================================
      const search = await request(baseUrl, "GET", `/admin/accounts?query=${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(search, 200, "account search");
      assert.ok(search.json.accounts.some((a) => a.user_id === athlete.userId));

      const detail = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(detail, 200, "account detail");
      assert.equal(detail.json.account.account_state, "active");
      assert.equal(detail.json.account.is_test_account, false);

      assertStatus(
        await request(baseUrl, "GET", "/admin/accounts/no-such-user", undefined, { cookie: admin.cookie }),
        404,
        "unknown account detail"
      );

      // ============================================================
      // Confirmed operational action: account suspend, with a real
      // before/after audit record, and CSRF enforcement.
      // ============================================================
      const suspendCorrelationId = crypto.randomUUID();
      correlationIds.push(suspendCorrelationId);

      assertStatus(
        await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
          { correlation_id: suspendCorrelationId, account_state: "suspended" },
          { cookie: admin.cookie }), // no csrf header
        403,
        "account state change without CSRF token"
      );

      const suspend = await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
        { correlation_id: suspendCorrelationId, account_state: "suspended" },
        { cookie: admin.cookie, csrf: admin.csrf });
      assertStatus(suspend, 200, "suspend account");
      assert.equal(suspend.json.audit.before_state.account_state, "active");
      assert.equal(suspend.json.audit.after_state.account_state, "suspended");
      assert.equal(suspend.json.audit.idempotent_replay, false);

      const detailAfterSuspend = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assert.equal(detailAfterSuspend.json.account.account_state, "suspended");

      // Idempotent replay: the same correlation_id must not re-mutate or
      // create a second audit record.
      const beforeReplayAuditCount = await pool.query(
        "SELECT count(*)::int AS c FROM product_admin_audit_records WHERE actor_user_id = $1",
        [adminUserId]
      );
      const replay = await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
        { correlation_id: suspendCorrelationId, account_state: "active" }, // different target state - must be ignored
        { cookie: admin.cookie, csrf: admin.csrf });
      assertStatus(replay, 200, "replay suspend correlation_id");
      assert.equal(replay.json.audit.idempotent_replay, true);
      assert.equal(replay.json.audit.after_state.account_state, "suspended", "the replay must return the ORIGINAL audit outcome, not re-derive a new one");

      const detailAfterReplay = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assert.equal(detailAfterReplay.json.account.account_state, "suspended", "a replayed correlation_id must never mutate state again");

      const afterReplayAuditCount = await pool.query(
        "SELECT count(*)::int AS c FROM product_admin_audit_records WHERE actor_user_id = $1",
        [adminUserId]
      );
      assert.equal(afterReplayAuditCount.rows[0].c, beforeReplayAuditCount.rows[0].c, "replaying a correlation_id must not create a second audit record");

      // Reactivate for the rest of the test.
      const reactivateCorrelationId = crypto.randomUUID();
      correlationIds.push(reactivateCorrelationId);
      assertStatus(
        await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
          { correlation_id: reactivateCorrelationId, account_state: "active" },
          { cookie: admin.cookie, csrf: admin.csrf }),
        200,
        "reactivate account"
      );

      assertStatus(
        await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/state`,
          { correlation_id: crypto.randomUUID(), account_state: "closed" },
          { cookie: admin.cookie, csrf: admin.csrf }),
        400,
        "admin cannot close/delete an account directly - that stays inside the sealed GDPR deletion queue"
      );

      // ============================================================
      // Test-user management.
      // ============================================================
      const markCorrelationId = crypto.randomUUID();
      correlationIds.push(markCorrelationId);
      const mark = await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/test-marking`,
        { correlation_id: markCorrelationId, marked: true, reason: "fixture" },
        { cookie: admin.cookie, csrf: admin.csrf });
      assertStatus(mark, 200, "mark test account");
      assert.equal(mark.json.audit.before_state.is_test_account, false);
      assert.equal(mark.json.audit.after_state.is_test_account, true);

      const detailAfterMark = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assert.equal(detailAfterMark.json.account.is_test_account, true);

      const unmarkCorrelationId = crypto.randomUUID();
      correlationIds.push(unmarkCorrelationId);
      assertStatus(
        await request(baseUrl, "POST", `/admin/accounts/${encodeURIComponent(athlete.userId)}/test-marking`,
          { correlation_id: unmarkCorrelationId, marked: false },
          { cookie: admin.cookie, csrf: admin.csrf }),
        200,
        "unmark test account"
      );
      const detailAfterUnmark = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: admin.cookie });
      assert.equal(detailAfterUnmark.json.account.is_test_account, false);

      // ============================================================
      // Coach entitlement/payment review (read-only, cross-user).
      // ============================================================
      const commercial = await request(baseUrl, "GET", "/admin/commercial", undefined, { cookie: admin.cookie });
      assertStatus(commercial, 200, "commercial review");
      assert.ok(Array.isArray(commercial.json.records));

      // ============================================================
      // Support/error-record review, and the one place a support
      // request's status is ever changed.
      // ============================================================
      const supportList = await request(baseUrl, "GET", "/admin/support-requests", undefined, { cookie: admin.cookie });
      assertStatus(supportList, 200, "support request review");
      assert.ok(supportList.json.reports.some((r) => r.correlation_id === supportCorrelationId));

      const ackCorrelationId = crypto.randomUUID();
      correlationIds.push(ackCorrelationId);
      const ack = await request(baseUrl, "POST", `/admin/support-requests/${encodeURIComponent(supportCorrelationId)}/status`,
        { correlation_id: ackCorrelationId, status: "acknowledged" },
        { cookie: admin.cookie, csrf: admin.csrf });
      assertStatus(ack, 200, "acknowledge support request");
      assert.equal(ack.json.audit.before_state.status, "submitted");
      assert.equal(ack.json.audit.after_state.status, "acknowledged");

      const supportOwnHistory = await request(baseUrl, "GET", "/account/support/reports", undefined, { cookie: athlete.cookie });
      assertStatus(supportOwnHistory, 200, "athlete's own support history after admin acknowledgement");
      assert.equal(
        supportOwnHistory.json.reports.find((r) => r.correlation_id === supportCorrelationId)?.status,
        "acknowledged"
      );

      // ============================================================
      // Export/deletion request review (read-only).
      // ============================================================
      const exportsReview = await request(baseUrl, "GET", "/admin/data-rights/exports", undefined, { cookie: admin.cookie });
      assertStatus(exportsReview, 200, "export request review");
      assert.ok(Array.isArray(exportsReview.json.requests));

      const deletionsReview = await request(baseUrl, "GET", "/admin/data-rights/deletions", undefined, { cookie: admin.cookie });
      assertStatus(deletionsReview, 200, "deletion request review");
      assert.ok(Array.isArray(deletionsReview.json.requests));

      // ============================================================
      // Immutable operational audit trail: every confirmed action
      // above produced exactly one audit record (except the replay),
      // and every one carries actor/action/target/before/after/
      // correlation id/timestamp.
      // ============================================================
      const auditList = await request(baseUrl, "GET", "/admin/audit-records", undefined, { cookie: admin.cookie });
      assertStatus(auditList, 200, "audit record review");
      const auditByCorrelation = Object.fromEntries(auditList.json.records.map((r) => [r.correlation_id, r]));

      for (const correlationId of correlationIds) {
        const record = auditByCorrelation[correlationId];
        assert.ok(record, `expected an audit record for correlation_id ${correlationId}`);
        assert.equal(record.actor_user_id, adminUserId);
        assert.ok(record.action_type);
        assert.ok(record.target_record_type);
        assert.ok(record.target_record_id);
        assert.ok(record.before_state && typeof record.before_state === "object");
        assert.ok(record.after_state && typeof record.after_state === "object");
        assert.ok(record.created_at_iso8601);
      }

      // ============================================================
      // Sign-out revokes the admin session.
      // ============================================================
      assertStatus(
        await request(baseUrl, "POST", "/admin/sign-out", {}, { cookie: admin.cookie, csrf: admin.csrf }),
        200,
        "admin sign-out"
      );
      assertStatus(
        await request(baseUrl, "GET", "/admin/accounts", undefined, { cookie: admin.cookie }),
        401,
        "revoked admin session cannot be reused"
      );

      // Sign back in for the restart-reconstruction check below.
      const adminAfterSignOut = await adminSignIn(baseUrl, adminEmail, "Full21AdminPassword1234");

      // ============================================================
      // Fresh-process restart reconstruction.
      // ============================================================
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const detailAfterRestart = await request(baseUrl, "GET", `/admin/accounts/${encodeURIComponent(athlete.userId)}`, undefined, { cookie: adminAfterSignOut.cookie });
      assertStatus(detailAfterRestart, 200, "account detail after restart");
      assert.equal(detailAfterRestart.json.account.account_state, "active");
      assert.equal(detailAfterRestart.json.account.is_test_account, false);

      const auditAfterRestart = await request(baseUrl, "GET", "/admin/audit-records", undefined, { cookie: adminAfterSignOut.cookie });
      assertStatus(auditAfterRestart, 200, "audit records after restart");
      assert.equal(auditAfterRestart.json.records.length, auditList.json.records.length, "restart must reconstruct the same audit trail, not lose or duplicate rows");
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
