// DEV NOTE: FULL-UI-19 data rights and consent static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const accountUi = read("public/app/account_ui.js");
const routes = read("src/api/product_account.routes.ts");
const service = read("src/api/data_rights_service.ts");
const gdprExportContract = read("src/v1GdprExportHandling.mjs");
const gdprDeleteContract = read("src/v1GdprDeleteQueue.mjs");
const athleteHistoryExportService = read("src/api/athlete_history_export_service.ts");

test("current terms and consent version, and consent history, are displayed (reusing the existing real identity_account surface)", () => {
  for (const id of [
    "accountCurrentTermsVersion",
    "accountAcceptedTermsVersion",
    "accountCurrentConsentVersion",
    "accountAcceptedConsentVersion",
    "accountConsentHistory"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /function renderTermsState/u);
  assert.match(js, /function renderAccountHistory/u);
});

test("export routes are session-authenticated and delegate to data_rights_service, distinct from Athlete History export", () => {
  assert.match(routes, /"\/data-rights\/export"/u);
  assert.match(routes, /"\/data-rights\/export\/:export_request_id\/download"/u);
  assert.match(routes, /requestDataExport/u);
  assert.match(routes, /downloadDataExport/u);
  assert.match(routes, /getDataExportStatus/u);

  // Every data-rights route must resolve the caller's identity from their own
  // authenticated session - never from a client-supplied user id.
  assert.match(routes, /"\/data-rights\/export"[\s\S]{0,300}sessionToken\(request\)/u);
  assert.match(routes, /"\/data-rights\/export"[\s\S]{0,400}resolveProductSession\(token\)/u);

  assert.match(service, /from "\.\.\/v1GdprExportHandling\.mjs"/u);
  assert.match(service, /createGdprExportHandling/u);

  // The complete personal-data export must never be confused with the
  // narrower Athlete History export - the two must be separate services.
  assert.doesNotMatch(service, /athlete_history_export_service/u);
  assert.doesNotMatch(athleteHistoryExportService, /data_rights_service/u);
});

test("export covers the complete personal-data category surface, not just session history", () => {
  for (const category of [
    "account",
    "phase1_declarations",
    "relationships",
    "programme_assignments",
    "session_records",
    "runtime_events",
    "coach_notes_authored",
    "legal_document_acknowledgements",
    "billing_records"
  ]) {
    assert.match(service, new RegExp(`\\b${category}\\b`, "u"), `Expected export category ${category}`);
  }
});

test("export status and download are lawfully bounded: status, ready_at, expires_at, and access control on download", () => {
  assert.match(service, /'pending'/u);
  assert.match(service, /expires_at/u);
  assert.match(service, /EXPORT_TTL_MS/u);

  // Download must re-check ownership, readiness and expiry at download time,
  // not just at request time.
  assert.match(service, /cleanString\(row\.user_id\) !== userId/u);
  assert.match(service, /row\.status !== "ready"/u);
  assert.match(service, /expires_at.*Date\.now\(\)/su);

  assert.match(js, /async function triggerDataExportDownload/u);
  assert.match(js, /downloadDataExport/u);
});

test("an athlete's own export card shows whether they have actually downloaded it, not just its ready/expiry status", () => {
  // getDataExportStatus has always computed downloaded_at_iso8601 from the
  // real downloaded_at column that downloadDataExport() sets, but until now
  // dataExportRecordCard never read it - an athlete had no way to tell which
  // of their export requests they had already retrieved. Same phantom-field
  // bug class as PR #877-#882.
  assert.match(service, /downloaded_at_iso8601: isoString\(row\.downloaded_at\)/u);
  assert.match(js, /entry\.downloaded_at_iso8601/u);
});

test("deletion review, request and status all route through the sealed S-V1-L-03 delete queue contract, never performing a hard delete", () => {
  assert.match(routes, /"\/data-rights\/deletion\/preview"/u);
  assert.match(routes, /"\/data-rights\/deletion"/u);
  assert.match(service, /from "\.\.\/v1GdprDeleteQueue\.mjs"/u);
  assert.match(service, /createGdprDeleteQueueRequest/u);
  assert.match(service, /previewDataDeletion/u);
  assert.match(service, /confirmDataDeletion/u);
  assert.match(service, /getDataDeletionStatus/u);

  // The sealed contract's own boundary must never be widened or bypassed by
  // this wiring file.
  assert.doesNotMatch(service, /hard_delete_performed:\s*true/u);
  assert.doesNotMatch(service, /delete_runtime_events|delete_engine_truth|purge/u);

  assert.match(gdprDeleteContract, /hard_delete_performed: false/u);
});

test("deletion consequence review shows factual retention copy without inventing legal policy", () => {
  assert.match(service, /function buildRetentionCopy/u);
  assert.match(service, /retention_notices/u);
  assert.match(service, /factual_notice/u);

  // Copy must be plainly factual (what is retained and why) - not a legal
  // guarantee, promise of immediate deletion, or invented policy claim.
  assert.doesNotMatch(service, /guarantee|we promise|immediately delete|permanently erased on request/iu);

  assert.match(js, /function renderDataDeletionRetentionPreview/u);
  assert.match(html, /id="dataDeletionRetentionNotice"/u);
  assert.match(html, /id="dataDeletionRetentionList"/u);
});

test("deletion confirmation is explicit and resistant to duplicate submission", () => {
  assert.match(html, /placeholder="Type DELETE"/u);
  assert.match(service, /cleanString\(confirmation\) !== "DELETE"/u);

  // Server-side: a repeated client_request_id for the same user replays the
  // original result instead of creating a second queue entry.
  assert.match(service, /UNIQUE \(user_id, client_request_id\)|WHERE user_id = \$1 AND client_request_id = \$2/u);
  assert.match(service, /replayed: true/u);
  assert.match(routes, /client_request_id/u);

  // Client-side: the idempotency key persists across a failed submission so
  // a retry replays rather than duplicates.
  assert.match(js, /state\.dataDeletionClientRequestId/u);
  assert.match(js, /newClientRequestId/u);
});

test("data rights schema tables never record a performed hard delete", () => {
  const schema = read("schema.sql");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS data_export_requests/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS data_deletion_requests/u);
  assert.doesNotMatch(schema, /data_deletion_requests[\s\S]{0,600}hard_delete/u);
});

test("actor access: data rights functions are scoped to the caller's own account via session cookie, not a client-supplied id", () => {
  assert.doesNotMatch(routes, /"\/data-rights\/export"[\s\S]{0,200}request\.body\.user_id/u);
  assert.doesNotMatch(routes, /"\/data-rights\/deletion"[\s\S]{0,200}request\.body\.user_id/u);
  assert.match(service, /downloadDataExport\(userId: string, exportRequestId: string\)/u);
  assert.match(service, /confirmDataDeletion\(\s*userId: string/u);
});

test("every new interactive data-rights control is a real focusable button/form, not a div handler (keyboard reachability)", () => {
  for (const id of [
    "requestDataExportButton", "reviewDataDeletionButton", "dataRightsRetryButton"
  ]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }

  assert.match(html, /<form id="dataDeletionConfirmForm"/u);
  assert.match(html, /<input id="dataDeletionConfirmation"/u);
});

test("data rights markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of ["data-rights-section", "data-deletion-review"]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.data-rights-section\b/u);
  assert.match(css, /\.data-deletion-review\b/u);
});

test("standard path requires no operator/API/database intervention: every function is reachable from the product client transport", () => {
  for (const fn of [
    "requestDataExport", "loadDataExportStatus", "downloadDataExport",
    "loadDataDeletionPreview", "confirmDataDeletion", "loadDataDeletionStatus"
  ]) {
    assert.match(accountUi, new RegExp(`export (?:function|async function) ${fn}`, "u"), `Expected account_ui.js export ${fn}`);
  }
});
