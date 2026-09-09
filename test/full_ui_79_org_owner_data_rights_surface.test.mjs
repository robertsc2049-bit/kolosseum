// DEV NOTE: FULL-UI-79 org-owner GDPR data export, deletion-request and
// account closure static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/org_owner_data_rights_service.ts");
const accountService = read("src/api/org_owner_account_service.ts");
const routes = read("src/api/org_owner.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const exportContract = read("src/v1GdprExportHandling.mjs");
const deleteQueueContract = read("src/v1GdprDeleteQueue.mjs");
const schema = read("schema.sql");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("both sealed GDPR contracts' actor-type allow-lists were widened to include org_owner", () => {
  assert.match(exportContract, /GDPR_EXPORT_ALLOWED_ACTOR_TYPES = Object\.freeze\(\[\s*"athlete",\s*"coach",\s*"org_owner"\s*\]\)/u);
  assert.match(deleteQueueContract, /GDPR_DELETE_ALLOWED_ACTOR_TYPES = Object\.freeze\(\[\s*"athlete",\s*"coach",\s*"org_owner"\s*\]\)/u);
});

test("the closure and data-rights routes are mounted org-owner-only, mutation-gated where they mutate, and rate-limited", () => {
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n\s*"\/closure",\s*\n\s*orgOwnerDataRightsRateLimit/u);
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n\s*"\/data-rights\/export",\s*\n\s*orgOwnerDataRightsRateLimit/u);
  assert.match(routes, /orgOwnerRouter\.get\(\s*\n\s*"\/data-rights\/export",/u);
  assert.match(routes, /orgOwnerRouter\.get\(\s*\n\s*"\/data-rights\/export\/:export_request_id\/download",/u);
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n\s*"\/data-rights\/deletion\/preview",\s*\n\s*orgOwnerDataRightsRateLimit/u);
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n\s*"\/data-rights\/deletion",\s*\n\s*orgOwnerDataRightsRateLimit/u);
  assert.match(routes, /orgOwnerRouter\.get\(\s*\n\s*"\/data-rights\/deletion",/u);

  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const result = await requestOrgOwnerAccountClosure/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const result = await requestOrgOwnerDataExport/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const result = await previewOrgOwnerDataDeletion/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const body: Record<string, unknown>/u);
});

test("the new service never performs a hard delete - deletion is request-then-queue-for-review only", () => {
  assert.doesNotMatch(service, /DELETE FROM/u);
  assert.doesNotMatch(accountService, /DELETE FROM org_owner/u);
  assert.match(service, /queued_for_review/u);
});

test("closure is a synchronous, non-cascading state flip - it never touches product_organisations", () => {
  assert.match(accountService, /export async function requestOrgOwnerAccountClosure/u);
  assert.match(accountService, /UPDATE product_org_owner_accounts SET account_state = 'closed'/u);
  assert.match(accountService, /UPDATE product_org_owner_sessions SET revoked_at = now\(\)/u);
  assert.doesNotMatch(accountService, /UPDATE product_organisations/u);
});

test("closure and deletion-confirm both require an exact, literal typed-confirmation string before doing anything", () => {
  assert.match(accountService, /input\.confirmation !== "CLOSE"/u);
  assert.match(service, /cleanString\(confirmation\) !== "DELETE"/u);
});

test("deletion-confirm replays idempotently on a reused client_request_id, and 409s on a reused id with a different reason_code", () => {
  assert.match(service, /WHERE user_id = \$1 AND client_request_id = \$2/u);
  assert.match(service, /client_request_id reused for a different deletion reason/u);
  assert.match(service, /replayed: true/u);
  assert.match(service, /replayed: false/u);
});

test("only org_audit_records are retained on deletion review - every other org-owner data category is implicitly deletable on review", () => {
  assert.match(service, /record_type: "audit_record"/u);
  assert.match(service, /retention_reason: "audit_integrity_review_required"/u);
});

test("org-owner data is assembled only from tables scoped to the caller's own user_id/owner_user_id - never a client-supplied id", () => {
  assert.doesNotMatch(service, /request\.body/u);
  assert.match(service, /WHERE user_id = \$1/u);
  assert.match(service, /WHERE owner_user_id = \$1/u);
  assert.match(service, /WHERE actor_user_id = \$1/u);
});

test("no org-owner data-rights file imports any engine-truth service", () => {
  for (const source of [service, accountService, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the three new org-owner tables are FK'd to product_org_owner_accounts, never product_accounts", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_owner_closure_requests \(/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_owner_data_export_requests \(/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_owner_data_deletion_requests \(/u);
  const orgOwnerTablesBlock = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS org_owner_closure_requests"), schema.indexOf("CREATE TABLE IF NOT EXISTS org_owner_data_deletion_requests") + 2000);
  assert.match(orgOwnerTablesBlock, /REFERENCES product_org_owner_accounts\(user_id\)\s*\n\s*ON DELETE CASCADE/u);
  assert.doesNotMatch(orgOwnerTablesBlock, /REFERENCES product_accounts\(/u);
});

test("the org owner workspace has a real export section (request + per-export download once ready)", () => {
  assert.match(indexHtml, /id="orgAccountExportRequestButton"/u);
  assert.match(indexHtml, /id="orgAccountExportList"/u);

  assert.match(orgJs, /async function requestAccountExport\(\)/u);
  assert.match(orgJs, /async function downloadAccountExport\(exportRequestId\)/u);
  assert.match(orgJs, /data-download-export/u);
  assert.match(orgJs, /new Blob\(\[JSON\.stringify\(payload, null, 2\)\]/u);
});

test("the deletion UI only shows a confirm form after a successful review fetch, gated behind a real idempotency key", () => {
  assert.match(indexHtml, /id="orgAccountDeletionReviewButton"/u);
  assert.match(indexHtml, /id="orgAccountDeletionReview" hidden/u);
  assert.match(indexHtml, /id="orgAccountDeletionConfirmForm"/u);
  assert.match(indexHtml, /id="orgAccountDeletionConfirmText"/u);

  assert.match(orgJs, /async function reviewAccountDeletion\(\)/u);
  assert.match(orgJs, /el\("orgAccountDeletionReview"\)\.hidden = false;/u);
  assert.match(orgJs, /ORG_OWNER_DELETION_CLIENT_REQUEST_ID_KEY/u);
  assert.match(orgJs, /window\.localStorage\.removeItem\(ORG_OWNER_DELETION_CLIENT_REQUEST_ID_KEY\)/u);
});

test("the org owner workspace has a real closure form requiring typed confirmation, reloading on success", () => {
  assert.match(indexHtml, /id="orgAccountClosureForm"/u);
  assert.match(indexHtml, /id="orgAccountClosureConfirmText"/u);

  assert.match(orgJs, /async function closeAccount\(event\)/u);
  assert.match(orgJs, /location\.reload\(\)/u);
});

test("every new account control is wired up in boot()", () => {
  assert.match(orgJs, /el\("orgAccountExportRequestButton"\)\.addEventListener\("click", \(\) => requestAccountExport\(\)/u);
  assert.match(orgJs, /el\("orgAccountDeletionReviewButton"\)\.addEventListener\("click", \(\) => reviewAccountDeletion\(\)/u);
  assert.match(orgJs, /el\("orgAccountDeletionConfirmForm"\)\.addEventListener\("submit", \(event\) => confirmAccountDeletion\(event\)/u);
  assert.match(orgJs, /el\("orgAccountClosureForm"\)\.addEventListener\("submit", \(event\) => closeAccount\(event\)/u);
});

test("the FULL-UI-79 manifest functions are declared as implemented with real tests inside the existing organisation_billing area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  for (const functionId of [
    "org_owner_account_closure",
    "org_owner_data_export_request",
    "org_owner_data_export_status",
    "org_owner_data_export_download",
    "org_owner_data_deletion_review",
    "org_owner_data_deletion_confirm",
    "org_owner_data_deletion_status"
  ]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.deepEqual(fn.actors, ["org_owner"]);
    assert.equal(fn.direct_test, "test/full_ui_79_org_owner_data_rights_surface.test.mjs");
    assert.equal(fn.integration_test, "test/org_owner_data_rights_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-79" && slice.state === "implemented"));
});
