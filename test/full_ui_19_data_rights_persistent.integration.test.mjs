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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

async function registerAthlete(baseUrl, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full19DataRights!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(registration, 201, `${label} account registration`);

  const userId = registration.json?.account?.user_id ?? "";
  assert.ok(userId, `${label}: expected registered user_id`);
  const cookie = sessionCookie(registration, `${label} account registration`);
  const csrf = registration.json?.csrf_token;
  assert.ok(csrf, `${label}: expected csrf token`);

  return { userId, cookie, csrf };
}

test(
  "FULL-UI-19 data rights and consent: export request/status/download/access-control, deletion preview/confirm/status/idempotency, retention handling and restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM data_export_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM data_deletion_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = $1 OR actor_user_id = $1", [userId]).catch(() => {});
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

      const athlete = await registerAthlete(baseUrl, "Full19 Athlete", nonce);
      userIds.push(athlete.userId);

      const otherAthlete = await registerAthlete(baseUrl, "Full19 Other Athlete", nonce);
      userIds.push(otherAthlete.userId);

      // --- Terms/consent already server-authoritative (identity_account). ---
      const terms = await request(baseUrl, "GET", "/account/terms");
      assertStatus(terms, 200, "current terms");
      assert.ok(terms.json.current_terms_version);
      assert.ok(terms.json.current_consent_version);

      // --- Export request: creates a ready artefact with a lawful expiry. ---
      const exportReq = await request(baseUrl, "POST", "/account/data-rights/export", {}, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(exportReq, 202, "export request");
      assert.equal(exportReq.json.status, "ready");
      assert.ok(exportReq.json.export_request_id);
      assert.ok(exportReq.json.expires_at_iso8601);
      assert.ok(exportReq.json.included_category_counts);

      const exportRequestId = exportReq.json.export_request_id;

      // Every allowed GDPR export category must be present in the preview
      // counts, even if some are legitimately empty.
      for (const category of [
        "account", "phase1_declarations", "relationships", "programme_assignments",
        "session_records", "runtime_events", "coach_notes_authored",
        "legal_document_acknowledgements", "billing_records"
      ]) {
        assert.ok(
          Object.hasOwn(exportReq.json.included_category_counts, category),
          `expected export category ${category}`
        );
      }
      assert.equal(exportReq.json.included_category_counts.account, 1);

      // --- Export status: lists the request. ---
      const statusResult = await request(baseUrl, "GET", "/account/data-rights/export", undefined, { cookie: athlete.cookie });
      assertStatus(statusResult, 200, "export status");
      assert.equal(statusResult.json.exports.length, 1);
      assert.equal(statusResult.json.exports[0].export_request_id, exportRequestId);
      assert.equal(statusResult.json.exports[0].status, "ready");
      assert.equal(statusResult.json.exports[0].downloaded_at_iso8601, null);

      // --- Download: succeeds, returns the sealed export payload, marks
      //     downloaded_at, and is access controlled. ---
      const download = await request(baseUrl, "GET", `/account/data-rights/export/${exportRequestId}/download`, undefined, { cookie: athlete.cookie });
      assertStatus(download, 200, "export download");
      assert.equal(download.json.ok, true);
      assert.equal(download.json.permission.permission_scope, "own_user_data_only");
      assert.equal(download.json.included_category_counts.account, 1);

      const statusAfterDownload = await request(baseUrl, "GET", "/account/data-rights/export", undefined, { cookie: athlete.cookie });
      assert.ok(statusAfterDownload.json.exports[0].downloaded_at_iso8601, "expected downloaded_at to be recorded");

      // --- Access control: another authenticated user must never be able to
      //     download this export, and must never see it in their own status
      //     list. ---
      const crossDownload = await request(baseUrl, "GET", `/account/data-rights/export/${exportRequestId}/download`, undefined, { cookie: otherAthlete.cookie });
      assertStatus(crossDownload, 404, "cross-user export download");

      const otherStatus = await request(baseUrl, "GET", "/account/data-rights/export", undefined, { cookie: otherAthlete.cookie });
      assertStatus(otherStatus, 200, "other athlete's own export status");
      assert.equal(otherStatus.json.exports.length, 0, "another user's export list must never include this athlete's export");

      // --- Not-ready download must fail closed (simulated via direct row
      //     manipulation of a genuinely reachable pending state). ---
      const pendingExportId = `export_request_${crypto.randomUUID().replaceAll("-", "")}`;
      await pool.query(
        `INSERT INTO data_export_requests (export_request_id, user_id, status, requested_at)
         VALUES ($1, $2, 'pending', now())`,
        [pendingExportId, athlete.userId]
      );
      const pendingDownload = await request(baseUrl, "GET", `/account/data-rights/export/${pendingExportId}/download`, undefined, { cookie: athlete.cookie });
      assertStatus(pendingDownload, 409, "not-ready export download");
      assert.equal(pendingDownload.json.details.failure_token, "data_rights_export_not_ready");

      // --- Expired download must fail closed. ---
      const expiredExportId = `export_request_${crypto.randomUUID().replaceAll("-", "")}`;
      await pool.query(
        `INSERT INTO data_export_requests (export_request_id, user_id, status, requested_at, ready_at, expires_at, export_payload)
         VALUES ($1, $2, 'ready', now(), now(), now() - interval '1 hour', '{"ok":true}'::jsonb)`,
        [expiredExportId, athlete.userId]
      );
      const expiredDownload = await request(baseUrl, "GET", `/account/data-rights/export/${expiredExportId}/download`, undefined, { cookie: athlete.cookie });
      assertStatus(expiredDownload, 410, "expired export download");
      assert.equal(expiredDownload.json.details.failure_token, "data_rights_export_expired");

      // --- Deletion consequence review: pure read-only preview, never
      //     persists a request. ---
      const preview = await request(baseUrl, "POST", "/account/data-rights/deletion/preview", {}, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(preview, 200, "deletion preview");
      assert.ok(typeof preview.json.retained_record_count === "number");
      assert.ok(preview.json.factual_notice);

      const statusBeforeConfirm = await request(baseUrl, "GET", "/account/data-rights/deletion", undefined, { cookie: athlete.cookie });
      assert.equal(statusBeforeConfirm.json.deletion_requests.length, 0, "preview must never persist a deletion request");

      // --- Deletion confirm without the exact confirmation string fails. ---
      const badConfirm = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "delete", client_request_id: `cr_${nonce}_bad` }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(badConfirm, 400, "deletion confirm without exact confirmation string");
      assert.equal(badConfirm.json.details.failure_token, "data_rights_deletion_confirmation_required");

      // --- Deletion confirm without a client_request_id fails (idempotency
      //     key is mandatory, not silently generated server-side). ---
      const missingClientId = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "DELETE" }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(missingClientId, 400, "deletion confirm without client_request_id");

      // --- Deletion confirm: succeeds, queues for review, never performs a
      //     hard delete. ---
      const clientRequestId = `cr_${nonce}_1`;
      const confirm1 = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(confirm1, 202, "deletion confirm (first)");
      assert.equal(confirm1.json.queue_status, "queued_for_review");
      assert.equal(confirm1.json.replayed, false);
      assert.ok(confirm1.json.deletion_request_id);
      assert.equal(confirm1.json.retention_boundary.proof_or_audit_records_hard_deleted, false);
      assert.equal(confirm1.json.retention_boundary.legal_review_required_before_any_action, true);

      // --- Duplicate submission with the SAME client_request_id must replay
      //     the original result, not create a second queue entry. ---
      const confirm2 = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(confirm2, 202, "deletion confirm (duplicate submission)");
      assert.equal(confirm2.json.replayed, true);
      assert.equal(confirm2.json.deletion_request_id, confirm1.json.deletion_request_id);

      const rowCount = await pool.query(
        "SELECT count(*)::int AS n FROM data_deletion_requests WHERE user_id = $1",
        [athlete.userId]
      );
      assert.equal(rowCount.rows[0].n, 1, "duplicate submission must not create a second deletion request row");

      // --- Reusing the same client_request_id for a genuinely different
      //     request is a conflict, not a silent replay. ---
      const conflictingReplay = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "DELETE", client_request_id: clientRequestId, reason_code: "data_minimisation_request" }, { cookie: athlete.cookie, csrf: athlete.csrf });
      assertStatus(conflictingReplay, 409, "client_request_id reused for a different reason_code");

      // --- Deletion status: reflects the queued request with retained
      //     records and retention boundary. ---
      const deletionStatus = await request(baseUrl, "GET", "/account/data-rights/deletion", undefined, { cookie: athlete.cookie });
      assertStatus(deletionStatus, 200, "deletion status");
      assert.equal(deletionStatus.json.deletion_requests.length, 1);
      assert.equal(deletionStatus.json.deletion_requests[0].deletion_request_id, confirm1.json.deletion_request_id);
      assert.equal(deletionStatus.json.deletion_requests[0].queue_status, "queued_for_review");

      // --- Confirm the account itself was never altered by any of this -
      //     data rights requests never touch account_state. ---
      const accountRow = await pool.query("SELECT account_state FROM product_accounts WHERE user_id = $1", [athlete.userId]);
      assert.equal(accountRow.rows[0].account_state, "active");

      // --- Fresh-process restart reconstruction. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const statusAfterRestart = await request(baseUrl, "GET", "/account/data-rights/export", undefined, { cookie: athlete.cookie });
      assertStatus(statusAfterRestart, 200, "export status after restart");
      assert.equal(statusAfterRestart.json.exports.length, 3);
      const readyAfterRestart = statusAfterRestart.json.exports.find((e) => e.export_request_id === exportRequestId);
      assert.equal(readyAfterRestart.status, "ready");
      assert.ok(readyAfterRestart.downloaded_at_iso8601);

      const expiredAfterRestart = statusAfterRestart.json.exports.find((e) => e.export_request_id === expiredExportId);
      assert.equal(expiredAfterRestart.status, "expired", "expiry must be recognized as expired on restart, not just at request time");

      const deletionStatusAfterRestart = await request(baseUrl, "GET", "/account/data-rights/deletion", undefined, { cookie: athlete.cookie });
      assertStatus(deletionStatusAfterRestart, 200, "deletion status after restart");
      assert.equal(deletionStatusAfterRestart.json.deletion_requests.length, 1);
      assert.equal(deletionStatusAfterRestart.json.deletion_requests[0].deletion_request_id, confirm1.json.deletion_request_id);

      const downloadAfterRestart = await request(baseUrl, "GET", `/account/data-rights/export/${exportRequestId}/download`, undefined, { cookie: athlete.cookie });
      assertStatus(downloadAfterRestart, 200, "export download after restart");
      assert.deepEqual(downloadAfterRestart.json.subject_data, download.json.subject_data);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
