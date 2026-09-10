// DEV NOTE: FULL-UI-80 admin oversight visibility into org-owner accounts,
// static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const reviewService = read("src/api/product_admin_review_service.ts");
const actionService = read("src/api/product_admin_action_service.ts");
const routes = read("src/api/product_admin.routes.ts");
const html = read("public/admin/index.html");
const js = read("public/admin/admin.js");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const schema = read("schema.sql");

test("the five org-owner admin routes are mounted, admin-gated, rate-limited, and mutation-gated where they mutate", () => {
  assert.match(routes, /orgOwnerAdminRateLimit = rateLimit\(/u);

  assert.match(routes, /productAdminRouter\.get\(\s*\n\s*"\/org-owner-accounts",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(routes, /await authenticatedAdmin\(request, false\);\s*\n\s*const accounts = await searchAdminOrgOwnerAccounts/u);

  assert.match(routes, /productAdminRouter\.get\(\s*\n\s*"\/org-owner-accounts\/:user_id",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(routes, /await authenticatedAdmin\(request, false\);\s*\n\s*const detail = await getAdminOrgOwnerAccountDetail/u);

  assert.match(routes, /productAdminRouter\.post\(\s*\n\s*"\/org-owner-accounts\/:user_id\/state",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(routes, /const admin = await authenticatedAdmin\(request, true\);[\s\S]{0,200}changeOrgOwnerAccountState/u);

  assert.match(routes, /productAdminRouter\.get\(\s*\n\s*"\/org-owner-data-rights\/exports",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(routes, /await authenticatedAdmin\(request, false\);\s*\n\s*const requests = await listAdminOrgOwnerDataExportRequests/u);

  assert.match(routes, /productAdminRouter\.get\(\s*\n\s*"\/org-owner-data-rights\/deletions",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(routes, /await authenticatedAdmin\(request, false\);\s*\n\s*const requests = await listAdminOrgOwnerDataDeletionRequests/u);
});

test("org-owner account search and detail are new, parallel read functions - not a union into searchAdminAccounts/getAdminAccountDetail", () => {
  assert.match(reviewService, /export async function searchAdminOrgOwnerAccounts/u);
  assert.match(reviewService, /export async function getAdminOrgOwnerAccountDetail/u);
  assert.match(reviewService, /FROM product_org_owner_accounts/u);

  // No actor_type, email_verified or test-account fields - none of these
  // concepts exist for org-owner accounts.
  const orgOwnerDetailFn = reviewService.match(/export async function getAdminOrgOwnerAccountDetail[\s\S]*?\n\}\n/u)?.[0] ?? "";
  assert.ok(orgOwnerDetailFn, "expected to isolate getAdminOrgOwnerAccountDetail's body");
  assert.doesNotMatch(orgOwnerDetailFn, /actor_type|email_verified|is_test_account|test_account/u);
});

test("the org-owner state-change action reuses the existing account_state_change action_type (target_record_type distinguishes it), and is closed to active/suspended only", () => {
  assert.match(actionService, /export async function changeOrgOwnerAccountState/u);
  assert.match(actionService, /actionType: "account_state_change"/u);
  assert.match(actionService, /targetRecordType: "product_org_owner_accounts"/u);

  const orgOwnerStateFn = actionService.match(/export async function changeOrgOwnerAccountState[\s\S]*?\n\}\n/u)?.[0] ?? "";
  assert.ok(orgOwnerStateFn, "expected to isolate changeOrgOwnerAccountState's body");
  assert.match(orgOwnerStateFn, /ADMIN_ACCOUNT_STATES\.has\(cleanState\)/u);
  assert.match(orgOwnerStateFn, /UPDATE product_org_owner_accounts SET account_state = \$2 WHERE user_id = \$1/u);

  // No new CHECK-constraint value was added to product_admin_audit_records -
  // reusing the existing enum value means zero schema.sql changes are
  // needed for this slice.
  assert.match(schema, /action_type IN \(\s*\n\s*'account_state_change',\s*\n\s*'test_account_marked',\s*\n\s*'test_account_unmarked',\s*\n\s*'support_request_status_change'\s*\n\s*\)/u);
});

test("the org-owner review functions never mutate anything - no INSERT/UPDATE/DELETE against product_org_owner_accounts or product_organisations in the review service", () => {
  const orgOwnerReadFns = reviewService.slice(reviewService.indexOf("export async function searchAdminOrgOwnerAccounts"));
  assert.doesNotMatch(orgOwnerReadFns, /INSERT INTO|UPDATE |DELETE FROM/iu);
});

test("the organisations-owned sub-list joins product_organisations by owner_user_id, read-only, mirroring the athlete/coach account-events sub-list's shape", () => {
  assert.match(reviewService, /FROM product_organisations\s*\n\s*WHERE owner_user_id = \$1/u);
  assert.match(reviewService, /organisations_owned: Object\.freeze/u);

  assert.match(html, /id="orgOwnerOrganisationsOwned"/u);
  assert.match(js, /account\.organisations_owned/u);
  assert.match(js, /el\("orgOwnerOrganisationsOwned"\)/u);
});

test("every field returned by the new org-owner review functions is actually rendered somewhere in admin.js/index.html - no phantom fields", () => {
  for (const field of ["user_id", "email", "display_name", "account_state"]) {
    assert.match(js, new RegExp(`account\\.${field}`, "u"), `expected admin.js to read account.${field}`);
  }
  for (const field of ["org_id", "org_name", "org_state", "seat_limit", "visibility_mode"]) {
    assert.match(js, new RegExp(`org\\.${field}`, "u"), `expected admin.js to read org.${field}`);
  }
  for (const field of ["export_request_id", "status", "requested_at_iso8601", "ready_at_iso8601", "expires_at_iso8601", "downloaded_at_iso8601"]) {
    assert.match(js, new RegExp(`request\\.${field}`, "u"), `expected admin.js to read export request.${field}`);
  }
  for (const field of ["deletion_request_id", "reason_code", "queue_status"]) {
    assert.match(js, new RegExp(`request\\.${field}`, "u"), `expected admin.js to read deletion request.${field}`);
  }
});

test("the two new data-rights tables have real search controls, filtering the already-fetched lists client-side rather than issuing a new request per keystroke", () => {
  assert.match(html, /id="orgOwnerExportRequestsSearch"/u);
  assert.match(html, /id="orgOwnerDeletionRequestsSearch"/u);

  assert.match(js, /function filteredOrgOwnerExportRequests/u);
  assert.match(js, /function filteredOrgOwnerDeletionRequests/u);
  assert.match(js, /state\.orgOwnerDataRightsExports = exportsResult\.requests/u);
  assert.match(js, /state\.orgOwnerDataRightsDeletions = deletionsResult\.requests/u);
  assert.match(js, /el\("orgOwnerExportRequestsSearch"\)\.addEventListener\("input", renderOrgOwnerDataRightsReview\)/u);
  assert.match(js, /el\("orgOwnerDeletionRequestsSearch"\)\.addEventListener\("input", renderOrgOwnerDataRightsReview\)/u);
});

test("org-owner search results and detail fields are escaped before being inserted into innerHTML", () => {
  const searchRenderFn = js.match(/function renderOrgOwnerAccountSearchResults[\s\S]*?\n\}\n/u)?.[0] ?? "";
  assert.ok(searchRenderFn, "expected to isolate renderOrgOwnerAccountSearchResults");
  assert.match(searchRenderFn, /escapeHtml\(account\.user_id\)/u);
  assert.match(searchRenderFn, /escapeHtml\(account\.email\)/u);
  assert.match(searchRenderFn, /escapeHtml\(account\.display_name\)/u);
});

test("the org owner account-state toggle uses the same explicit two-click confirm pattern as the athlete/coach one", () => {
  assert.match(html, /id="orgOwnerAccountToggleStateButton"/u);
  assert.match(html, /id="orgOwnerAccountToggleStateConfirmButton"/u);
  assert.match(js, /function requestOrgOwnerAccountStateToggle/u);
  assert.match(js, /async function confirmOrgOwnerAccountStateToggle/u);
  assert.match(js, /el\("orgOwnerAccountToggleStateButton"\)\.addEventListener\("click", requestOrgOwnerAccountStateToggle\)/u);
  assert.match(js, /el\("orgOwnerAccountToggleStateConfirmButton"\)\.addEventListener\("click", \(\) => confirmOrgOwnerAccountStateToggle\(\)/u);
  assert.match(js, /generateCorrelationId\(\)/u);
});

test("the FULL-UI-80 manifest functions are declared as implemented with real tests inside the existing founder_admin area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "founder_admin");
  assert.ok(area, "expected the existing founder_admin product area");

  for (const functionId of [
    "admin_org_owner_account_search",
    "admin_org_owner_account_state",
    "admin_org_owner_data_requests"
  ]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.deepEqual(fn.actors, ["founder_admin"]);
    assert.equal(fn.direct_test, "test/full_ui_80_admin_org_owner_visibility_surface.test.mjs");
    assert.equal(fn.integration_test, "test/full_ui_80_admin_org_owner_visibility_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-80" && slice.state === "implemented"));
});
