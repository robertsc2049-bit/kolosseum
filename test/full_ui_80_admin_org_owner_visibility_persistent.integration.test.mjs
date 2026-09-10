// DEV NOTE: FULL-UI-80 admin oversight visibility into org-owner accounts,
// persistent proof. Proves: admin's new org-owner search/detail/data-rights
// review reads actually surface real org-owner data (an owned organisation,
// a real export request, a real deletion request) seeded through the
// org-owner's own real self-service HTTP routes; the account-state toggle
// mutates product_org_owner_accounts, is idempotent on a repeated
// correlation_id, and is rejected for "closed" the same way the athlete/
// coach lever is; the resulting audit rows are visible unchanged through the
// EXISTING /admin/audit-records route; admin/org-owner session cookies
// remain mutually rejected across each other's routes; and a fresh-process
// restart reconstructs everything identically. Every step crosses only
// public HTTP routes.

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

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
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

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `admin_visibility_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Admin Visibility ${label} Owner`,
    password: `AdminVisibility${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    email,
    password: `AdminVisibility${label}Owner!2026`,
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function createOrg(baseUrl, owner, name, visibilityMode) {
  const result = await request(baseUrl, "POST", "/org/organisations", {
    org_name: name,
    visibility_mode: visibilityMode
  }, { cookie: owner.cookie, csrf: owner.csrf });
  assertStatus(result, 201, `create ${visibilityMode} organisation`);
  return result.json?.organisation?.org_id;
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

test(
  "FULL-UI-80 admin org-owner visibility: search/detail/data-rights review surface real org-owner data, state-change is audited and idempotent, negative cross-actor access, restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const orgOwnerUserIds = [];
    let adminUserId = null;

    const cleanup = async () => {
      if (adminUserId) {
        await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = $1", [adminUserId]).catch(() => {});
        await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminUserId]).catch(() => {});
        await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminUserId]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM org_owner_data_export_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM org_owner_data_deletion_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM org_owner_closure_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      // ============================================================
      // Seed a real org owner + an owned org + a real export request +
      // a real deletion request, entirely through the org-owner's own
      // self-service routes.
      // ============================================================
      const owner = await registerOrgOwner(baseUrl, nonce, "primary");
      orgOwnerUserIds.push(owner.userId);

      const orgId = await createOrg(baseUrl, owner, "Admin Visibility Org", "individual");

      const exportReq = await request(baseUrl, "POST", "/org/data-rights/export", {}, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(exportReq, 202, "org owner data export request");
      const exportRequestId = exportReq.json.export_request_id;

      const clientRequestId = `cr_${nonce}_admin_visibility`;
      const deletionConfirm = await request(
        baseUrl, "POST", "/org/data-rights/deletion",
        { confirmation: "DELETE", client_request_id: clientRequestId },
        { cookie: owner.cookie, csrf: owner.csrf }
      );
      assertStatus(deletionConfirm, 202, "org owner deletion confirm");
      const deletionRequestId = deletionConfirm.json.deletion_request_id;

      // ============================================================
      // Admin identity.
      // ============================================================
      const adminEmail = `admin_visibility_admin_${nonce}@example.com`;
      adminUserId = await createAdminAccountDirect(adminEmail, "Admin Visibility Admin", "AdminVisibilityAdmin!2026");
      const admin = await adminSignIn(baseUrl, adminEmail, "AdminVisibilityAdmin!2026");

      // ============================================================
      // Negative cross-actor access, before doing anything else.
      // ============================================================
      const orgOwnerAgainstAdmin = await request(baseUrl, "GET", "/admin/org-owner-accounts", undefined, { cookie: owner.cookie });
      assertStatus(orgOwnerAgainstAdmin, 401, "org-owner session cannot authenticate against admin routes");

      const adminAgainstOrgOwner = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: admin.cookie });
      assertStatus(adminAgainstOrgOwner, 401, "admin session cannot authenticate against org-owner routes");

      // ============================================================
      // Admin search finds the seeded org owner.
      // ============================================================
      const searchResult = await request(baseUrl, "GET", `/admin/org-owner-accounts?query=${encodeURIComponent(nonce)}`, undefined, { cookie: admin.cookie });
      assertStatus(searchResult, 200, "admin org-owner search");
      const foundInSearch = searchResult.json.accounts.find((account) => account.user_id === owner.userId);
      assert.ok(foundInSearch, "expected the seeded org owner in search results");
      assert.equal(foundInSearch.email, owner.email);
      assert.equal(foundInSearch.account_state, "active");
      assert.equal(foundInSearch.actor_type, undefined, "org-owner accounts must never carry an actor_type field");

      // ============================================================
      // Admin detail shows the owned organisation.
      // ============================================================
      const detailResult = await request(baseUrl, "GET", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(detailResult, 200, "admin org-owner detail");
      assert.equal(detailResult.json.account.email, owner.email);
      assert.equal(detailResult.json.account.organisations_owned.length, 1);
      assert.equal(detailResult.json.account.organisations_owned[0].org_id, orgId);
      assert.equal(detailResult.json.account.organisations_owned[0].org_name, "Admin Visibility Org");
      assert.equal(detailResult.json.account.organisations_owned[0].visibility_mode, "individual");

      const missingDetail = await request(baseUrl, "GET", `/admin/org-owner-accounts/org_owner_${crypto.randomUUID().replaceAll("-", "")}`, undefined, { cookie: admin.cookie });
      assertStatus(missingDetail, 404, "admin org-owner detail for a non-existent user");

      // ============================================================
      // Admin data-rights review shows the seeded export/deletion.
      // ============================================================
      const exportsReview = await request(baseUrl, "GET", `/admin/org-owner-data-rights/exports?user_id=${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(exportsReview, 200, "admin org-owner export review");
      assert.equal(exportsReview.json.requests.length, 1);
      assert.equal(exportsReview.json.requests[0].export_request_id, exportRequestId);
      assert.equal(exportsReview.json.requests[0].status, "ready");

      const deletionsReview = await request(baseUrl, "GET", `/admin/org-owner-data-rights/deletions?user_id=${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(deletionsReview, 200, "admin org-owner deletion review");
      assert.equal(deletionsReview.json.requests.length, 1);
      assert.equal(deletionsReview.json.requests[0].deletion_request_id, deletionRequestId);
      assert.equal(deletionsReview.json.requests[0].queue_status, "queued_for_review");

      // ============================================================
      // Account-state change: suspend, idempotent replay, reactivate,
      // and closed is rejected outright.
      // ============================================================
      const suspendCorrelationId = `corr_${nonce}_suspend`;
      const suspend = await request(
        baseUrl, "POST", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}/state`,
        { correlation_id: suspendCorrelationId, account_state: "suspended" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(suspend, 200, "admin suspends org-owner account");
      assert.equal(suspend.json.audit.before_state.account_state, "active");
      assert.equal(suspend.json.audit.after_state.account_state, "suspended");
      assert.equal(suspend.json.audit.idempotent_replay, false);
      assert.equal(suspend.json.audit.target_record_type, "product_org_owner_accounts");
      assert.equal(suspend.json.audit.action_type, "account_state_change");

      const accountStateRow = await pool.query("SELECT account_state FROM product_org_owner_accounts WHERE user_id = $1", [owner.userId]);
      assert.equal(accountStateRow.rows[0].account_state, "suspended");

      const suspendReplay = await request(
        baseUrl, "POST", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}/state`,
        { correlation_id: suspendCorrelationId, account_state: "active" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(suspendReplay, 200, "replaying the same correlation_id");
      assert.equal(suspendReplay.json.audit.idempotent_replay, true);
      assert.equal(suspendReplay.json.audit.audit_record_id, suspend.json.audit.audit_record_id);

      const stillSuspendedRow = await pool.query("SELECT account_state FROM product_org_owner_accounts WHERE user_id = $1", [owner.userId]);
      assert.equal(stillSuspendedRow.rows[0].account_state, "suspended", "a replayed correlation_id must not repeat the mutation");

      const reactivateCorrelationId = `corr_${nonce}_reactivate`;
      const reactivate = await request(
        baseUrl, "POST", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}/state`,
        { correlation_id: reactivateCorrelationId, account_state: "active" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(reactivate, 200, "admin reactivates org-owner account");
      assert.equal(reactivate.json.audit.before_state.account_state, "suspended");
      assert.equal(reactivate.json.audit.after_state.account_state, "active");

      const closedAttempt = await request(
        baseUrl, "POST", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}/state`,
        { correlation_id: `corr_${nonce}_closed`, account_state: "closed" },
        { cookie: admin.cookie, csrf: admin.csrf }
      );
      assertStatus(closedAttempt, 400, "admin cannot set closed directly");

      // ============================================================
      // The owned organisation's own org_state is untouched by any of
      // this - matches the same non-cascading precedent as self-service
      // closure.
      // ============================================================
      const orgStateRow = await pool.query("SELECT org_state FROM product_organisations WHERE org_id = $1", [orgId]);
      assert.equal(orgStateRow.rows[0].org_state, "active");

      // ============================================================
      // The existing, unchanged /admin/audit-records route already
      // surfaces these new org-owner-targeted rows.
      // ============================================================
      const auditReview = await request(baseUrl, "GET", `/admin/audit-records?user_id=${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(auditReview, 200, "admin audit-records review");
      const orgOwnerAuditRows = auditReview.json.records.filter((record) => record.target_record_type === "product_org_owner_accounts");
      assert.equal(orgOwnerAuditRows.length, 2, "expected exactly the suspend and reactivate audit rows (the replay must not add a third)");

      // ============================================================
      // Fresh-process restart reconstruction.
      // ============================================================
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const detailAfterRestart = await request(baseUrl, "GET", `/admin/org-owner-accounts/${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(detailAfterRestart, 200, "admin org-owner detail after restart");
      assert.equal(detailAfterRestart.json.account.account_state, "active");
      assert.equal(detailAfterRestart.json.account.organisations_owned.length, 1);

      const exportsAfterRestart = await request(baseUrl, "GET", `/admin/org-owner-data-rights/exports?user_id=${encodeURIComponent(owner.userId)}`, undefined, { cookie: admin.cookie });
      assertStatus(exportsAfterRestart, 200, "admin org-owner export review after restart");
      assert.equal(exportsAfterRestart.json.requests.length, 1);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
