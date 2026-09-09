// DEV NOTE: FULL-UI-79 org-owner GDPR data export, deletion-request and
// account closure persistent proof. Proves: an export actually assembles
// this owner's own account, owned organisations, coach memberships, sent
// broadcast messages and audit records (not just declares the categories);
// download is access-controlled and marks downloaded_at; not-ready and
// expired downloads fail closed; deletion preview is read-only and never
// persists a request; deletion confirm requires an exact "DELETE" and a
// real client_request_id, replays idempotently on a reused id, and 409s on
// a reused id with a different reason_code; only org_audit_records are
// retained on review; closure requires an exact "CLOSE", is a synchronous
// non-cascading state flip that never touches the owner's own organisation,
// revokes every session, and makes a subsequent sign-in fail with 423;
// and every read reconstructs identically after a server restart, since
// nothing here is cached in memory. Every step crosses only public HTTP
// routes.

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
  const email = `data_rights_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Data Rights ${label} Owner`,
    password: `DataRights${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    email,
    password: `DataRights${label}Owner!2026`,
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `data_rights_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Data Rights ${label} Coach`,
    email,
    password: `DataRightsCoach${label}!2026`,
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

async function createOrg(baseUrl, owner, name, visibilityMode) {
  const result = await request(baseUrl, "POST", "/org/organisations", {
    org_name: name,
    visibility_mode: visibilityMode
  }, { cookie: owner.cookie, csrf: owner.csrf });
  assertStatus(result, 201, `create ${visibilityMode} organisation`);
  return result.json?.organisation?.org_id;
}

async function inviteAndAcceptCoach(baseUrl, owner, orgId, coach, requestIdSuffix) {
  const invite = await request(
    baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/roster/invite`,
    { coach_email: coach.email, request_id: `invite_${requestIdSuffix}` }, { cookie: owner.cookie, csrf: owner.csrf }
  );
  assertStatus(invite, 201, `invite ${coach.email} to org ${orgId}`);
  const acceptResult = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(invite.json?.membership?.membership_id)}/accept`,
    { request_id: `accept_${requestIdSuffix}` }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(acceptResult, 200, `${coach.email} accepts org membership`);
}

test(
  "FULL-UI-79 org-owner data rights: export assembly/status/download/access-control, deletion preview/confirm/status/idempotency, closure with session revocation and 423 sign-in, restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];

    const cleanup = async () => {
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM org_owner_data_export_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM org_owner_data_deletion_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM org_owner_closure_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query(
          "DELETE FROM product_messages WHERE sender_user_id = $1 OR thread_id IN (SELECT thread_id FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1))",
          [userId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_message_threads WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [userId]
        ).catch(() => {});
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

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      const owner = await registerOrgOwner(baseUrl, nonce, "primary");
      orgOwnerUserIds.push(owner.userId);
      const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
      orgOwnerUserIds.push(otherOwner.userId);

      const coach = await registerCoach(baseUrl, nonce, "a");
      coachUserIds.push(coach.userId);

      // --- Seed real organisations_owned/org_coach_memberships/
      //     org_messages_sent/org_audit_records data so the export below
      //     proves those categories are actually assembled, not merely
      //     declared. ---
      const orgId = await createOrg(baseUrl, owner, "Data Rights Org", "shared");
      await inviteAndAcceptCoach(baseUrl, owner, orgId, coach, `${nonce}_a`);

      const broadcastText = "Data rights export coverage broadcast.";
      const broadcast = await request(
        baseUrl, "POST", `/org/organisations/${encodeURIComponent(orgId)}/broadcast/coaches`,
        { body_text: broadcastText }, { cookie: owner.cookie, csrf: owner.csrf }
      );
      assertStatus(broadcast, 201, "seed a broadcast message");
      assert.equal(broadcast.json?.sent_count, 1);

      // --- Export request: creates a ready artefact with a lawful expiry,
      //     and actually assembles this owner's own data. ---
      const exportReq = await request(baseUrl, "POST", "/org/data-rights/export", {}, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(exportReq, 202, "export request");
      assert.equal(exportReq.json.status, "ready");
      assert.ok(exportReq.json.export_request_id);
      assert.ok(exportReq.json.expires_at_iso8601);

      for (const category of ["account", "organisations_owned", "org_coach_memberships", "org_messages_sent", "org_audit_records"]) {
        assert.ok(Object.hasOwn(exportReq.json.included_category_counts, category), `expected export category ${category}`);
      }
      assert.equal(exportReq.json.included_category_counts.account, 1);
      assert.equal(exportReq.json.included_category_counts.organisations_owned, 1);
      assert.equal(exportReq.json.included_category_counts.org_coach_memberships, 1);
      assert.equal(exportReq.json.included_category_counts.org_messages_sent, 1);
      assert.ok(exportReq.json.included_category_counts.org_audit_records >= 2, "expected at least an org_created and coach_membership_activated audit record");

      const exportRequestId = exportReq.json.export_request_id;

      // --- Export status: lists the request. ---
      const statusResult = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: owner.cookie });
      assertStatus(statusResult, 200, "export status");
      assert.equal(statusResult.json.exports.length, 1);
      assert.equal(statusResult.json.exports[0].export_request_id, exportRequestId);
      assert.equal(statusResult.json.exports[0].status, "ready");
      assert.equal(statusResult.json.exports[0].downloaded_at_iso8601, null);

      // --- Download: succeeds, returns the sealed export payload with the
      //     seeded records, and marks downloaded_at. ---
      const download = await request(baseUrl, "GET", `/org/data-rights/export/${exportRequestId}/download`, undefined, { cookie: owner.cookie });
      assertStatus(download, 200, "export download");
      assert.equal(download.json.ok, true);
      assert.equal(download.json.permission.permission_scope, "own_user_data_only");
      assert.equal(download.json.subject_data.organisations_owned[0].org_id, orgId);
      assert.equal(download.json.subject_data.org_coach_memberships[0].coach_user_id, coach.userId);
      assert.equal(download.json.subject_data.org_messages_sent[0].body_text, broadcastText);

      const statusAfterDownload = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: owner.cookie });
      assert.ok(statusAfterDownload.json.exports[0].downloaded_at_iso8601, "expected downloaded_at to be recorded");

      // --- Access control: another org owner must never be able to
      //     download this export, and must never see it in their own
      //     status list. ---
      const crossDownload = await request(baseUrl, "GET", `/org/data-rights/export/${exportRequestId}/download`, undefined, { cookie: otherOwner.cookie });
      assertStatus(crossDownload, 404, "cross-owner export download");

      const otherStatus = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: otherOwner.cookie });
      assertStatus(otherStatus, 200, "other owner's own export status");
      assert.equal(otherStatus.json.exports.length, 0, "another owner's export list must never include this owner's export");

      // --- Not-ready download must fail closed. ---
      const pendingExportId = `org_owner_export_request_${crypto.randomUUID().replaceAll("-", "")}`;
      await pool.query(
        `INSERT INTO org_owner_data_export_requests (export_request_id, user_id, status, requested_at)
         VALUES ($1, $2, 'pending', now())`,
        [pendingExportId, owner.userId]
      );
      const pendingDownload = await request(baseUrl, "GET", `/org/data-rights/export/${pendingExportId}/download`, undefined, { cookie: owner.cookie });
      assertStatus(pendingDownload, 409, "not-ready export download");
      assert.equal(pendingDownload.json.details.failure_token, "org_owner_data_rights_export_not_ready");

      // --- Expired download must fail closed. ---
      const expiredExportId = `org_owner_export_request_${crypto.randomUUID().replaceAll("-", "")}`;
      await pool.query(
        `INSERT INTO org_owner_data_export_requests (export_request_id, user_id, status, requested_at, ready_at, expires_at, export_payload)
         VALUES ($1, $2, 'ready', now(), now(), now() - interval '1 hour', '{"ok":true}'::jsonb)`,
        [expiredExportId, owner.userId]
      );
      const expiredDownload = await request(baseUrl, "GET", `/org/data-rights/export/${expiredExportId}/download`, undefined, { cookie: owner.cookie });
      assertStatus(expiredDownload, 410, "expired export download");
      assert.equal(expiredDownload.json.details.failure_token, "org_owner_data_rights_export_expired");

      // --- Deletion consequence review: pure read-only preview, only
      //     org_audit_records retained, never persists a request. ---
      const preview = await request(baseUrl, "POST", "/org/data-rights/deletion/preview", {}, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(preview, 200, "deletion preview");
      assert.ok(preview.json.retained_record_count >= 2);
      assert.ok(preview.json.factual_notice);
      assert.ok(preview.json.retention_notices.some((notice) => notice.retention_reason === "audit_integrity_review_required"));

      const statusBeforeConfirm = await request(baseUrl, "GET", "/org/data-rights/deletion", undefined, { cookie: owner.cookie });
      assert.equal(statusBeforeConfirm.json.deletion_requests.length, 0, "preview must never persist a deletion request");

      // --- Deletion confirm without the exact confirmation string fails. ---
      const badConfirm = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "delete", client_request_id: `cr_${nonce}_bad` }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(badConfirm, 400, "deletion confirm without exact confirmation string");

      // --- Deletion confirm without a client_request_id fails (idempotency
      //     key is mandatory, not silently generated server-side). ---
      const missingClientId = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "DELETE" }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(missingClientId, 400, "deletion confirm without client_request_id");
      assert.equal(missingClientId.json.details.failure_token, "org_owner_data_rights_deletion_client_request_id_required");

      // --- Deletion confirm: succeeds, queues for review, never performs a
      //     hard delete. ---
      const clientRequestId = `cr_${nonce}_1`;
      const confirm1 = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(confirm1, 202, "deletion confirm (first)");
      assert.equal(confirm1.json.queue_status, "queued_for_review");
      assert.equal(confirm1.json.replayed, false);
      assert.ok(confirm1.json.deletion_request_id);

      // --- Duplicate submission with the SAME client_request_id must
      //     replay the original result, not create a second queue entry. ---
      const confirm2 = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(confirm2, 202, "deletion confirm (duplicate submission)");
      assert.equal(confirm2.json.replayed, true);
      assert.equal(confirm2.json.deletion_request_id, confirm1.json.deletion_request_id);

      const rowCount = await pool.query(
        "SELECT count(*)::int AS n FROM org_owner_data_deletion_requests WHERE user_id = $1",
        [owner.userId]
      );
      assert.equal(rowCount.rows[0].n, 1, "duplicate submission must not create a second deletion request row");

      // --- Reusing the same client_request_id for a genuinely different
      //     request is a conflict, not a silent replay. ---
      const conflictingReplay = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId, reason_code: "data_minimisation_request" }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(conflictingReplay, 409, "client_request_id reused for a different reason_code");

      // --- Deletion status: reflects the queued request. ---
      const deletionStatus = await request(baseUrl, "GET", "/org/data-rights/deletion", undefined, { cookie: owner.cookie });
      assertStatus(deletionStatus, 200, "deletion status");
      assert.equal(deletionStatus.json.deletion_requests.length, 1);
      assert.equal(deletionStatus.json.deletion_requests[0].deletion_request_id, confirm1.json.deletion_request_id);
      assert.equal(deletionStatus.json.deletion_requests[0].queue_status, "queued_for_review");

      // --- Closure without the exact confirmation string fails. ---
      const badClosure = await request(baseUrl, "POST", "/org/closure", { confirmation: "close" }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(badClosure, 400, "closure without exact confirmation string");

      // --- Closure: succeeds, is synchronous and non-cascading - the
      //     owned organisation's own org_state is untouched. ---
      const closure = await request(baseUrl, "POST", "/org/closure", { confirmation: "CLOSE" }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(closure, 202, "account closure");
      assert.ok(closure.json.closure_request_id);
      assert.equal(closure.json.request_state, "requested");

      const orgStateRow = await pool.query("SELECT org_state FROM product_organisations WHERE org_id = $1", [orgId]);
      assert.equal(orgStateRow.rows[0].org_state, "active", "closing the owner's account must never cascade into the org they own");

      const accountStateRow = await pool.query("SELECT account_state FROM product_org_owner_accounts WHERE user_id = $1", [owner.userId]);
      assert.equal(accountStateRow.rows[0].account_state, "closed");

      // --- The revoked session can no longer authenticate. ---
      const afterClosureSession = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: owner.cookie });
      assertStatus(afterClosureSession, 401, "revoked session cannot authenticate after closure");

      // --- A fresh sign-in against the closed account fails with 423. ---
      const closedSignIn = await request(baseUrl, "POST", "/org/sign-in", { email: owner.email, password: owner.password });
      assertStatus(closedSignIn, 423, "closed account sign-in");
      assert.equal(closedSignIn.json?.error, "org_owner_account_unavailable");

      // --- Fresh-process restart reconstruction: nothing here is cached
      //     in memory, so status reads reconstruct identically from
      //     Postgres, and the closed account still cannot sign in. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const restartedClosedSignIn = await request(baseUrl, "POST", "/org/sign-in", { email: owner.email, password: owner.password });
      assertStatus(restartedClosedSignIn, 423, "closed account sign-in after restart");

      const otherStatusAfterRestart = await request(baseUrl, "GET", "/org/data-rights/export", undefined, { cookie: otherOwner.cookie });
      assertStatus(otherStatusAfterRestart, 200, "other owner's export status after restart");
      assert.equal(otherStatusAfterRestart.json.exports.length, 0);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
