// DEV NOTE: FULL-UI-95 org-owner support/error-reporting parity static
// surface contract. Mirrors full_ui_79_org_owner_data_rights_surface's
// shape exactly, for the same reason FULL-UI-79 exists: an actor-parity
// gap where org_owner lacked a capability athlete/coach already had.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/org_owner_support_service.ts");
const productService = read("src/api/product_support_service.ts");
const routes = read("src/api/org_owner_support.routes.ts");
const serverSource = read("src/server.ts");
const reviewService = read("src/api/product_admin_review_service.ts");
const actionService = read("src/api/product_admin_action_service.ts");
const adminRoutes = read("src/api/product_admin.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const schema = read("schema.sql");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("the org-owner support service is a structural mirror of the athlete/coach one - same allowlist keys, same validation rules", () => {
  for (const key of [
    "correlation_id",
    "route_hash",
    "occurred_at_iso8601",
    "description",
    "browser_context",
    "failure_context"
  ]) {
    assert.match(service, new RegExp(`"${key}"`, "u"), `expected input key ${key}`);
    assert.match(productService, new RegExp(`"${key}"`, "u"), `expected athlete/coach input key ${key}`);
  }
  assert.match(service, /char_length\(description\)|description\.length > 4000/u);
});

test("the org-owner support routes resolve identity from authenticatedOrgOwner only, never a client-supplied user id", () => {
  assert.match(routes, /import \{ authenticatedOrgOwner \} from "\.\/org_owner_auth\.js";/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*try \{\s*\n\s*const report = await createOrgOwnerSupportReport\(user_id, request\.body\)/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, false\);\s*\n\s*const reports = await listOrgOwnerSupportReportsForUser\(user_id\)/u);
  assert.doesNotMatch(routes, /request\.body\.user_id|request\.query\.user_id/u);
});

test("the org-owner support router is mounted at /org, alongside orgOwnerRouter", () => {
  assert.match(serverSource, /import \{ orgOwnerSupportRouter \} from "\.\/api\/org_owner_support\.routes\.js";/u);
  assert.match(serverSource, /app\.use\("\/org", orgOwnerSupportRouter\);/u);
});

test("founder_admin can list and act on org-owner support requests through their own dedicated, rate-limited admin routes - never the athlete/coach ones", () => {
  assert.match(adminRoutes, /"\/org-owner-support-requests",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(adminRoutes, /"\/org-owner-support-requests\/:correlation_id\/status",\s*\n\s*orgOwnerAdminRateLimit/u);
  assert.match(reviewService, /export async function listAdminOrgOwnerSupportRequests/u);
  assert.match(reviewService, /FROM org_owner_support_requests/u);
  assert.match(actionService, /export async function changeOrgOwnerSupportRequestStatus/u);
  assert.match(actionService, /UPDATE org_owner_support_requests SET status = \$2/u);
});

test("the org-owner support table is FK'd to product_org_owner_accounts, never product_accounts", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_owner_support_requests \(/u);
  const tableBlock = schema.slice(
    schema.indexOf("CREATE TABLE IF NOT EXISTS org_owner_support_requests"),
    schema.indexOf("CREATE TABLE IF NOT EXISTS org_owner_support_requests") + 1500
  );
  assert.match(tableBlock, /REFERENCES product_org_owner_accounts\(user_id\)/u);
  assert.doesNotMatch(tableBlock, /REFERENCES product_accounts\(/u);
});

test("the new admin audit action_type is a real, allowed value on product_admin_audit_records, not a silently-rejected string", () => {
  assert.match(schema, /'org_owner_support_request_status_change'/u);
});

test("no org-owner support file imports any engine-truth service", () => {
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the org owner workspace has a real support section (report form with correlation ID/timestamp context, plus history)", () => {
  assert.match(indexHtml, /id="orgSupportReportButton"/u);
  assert.match(indexHtml, /id="orgSupportReportPanel" hidden/u);
  assert.match(indexHtml, /id="orgSupportReportForm"/u);
  assert.match(indexHtml, /id="orgSupportDescription"/u);
  assert.match(indexHtml, /id="orgSupportHistoryList"/u);

  assert.match(orgJs, /function openOrgSupportReportForm\(\)/u);
  assert.match(orgJs, /async function submitOrgSupportReport\(event\)/u);
  assert.match(orgJs, /async function refreshOrgSupportHistory\(\)/u);
  assert.match(orgJs, /newOrgSupportCorrelationId/u);
});

test("every new support control is wired up in boot()", () => {
  assert.match(orgJs, /el\("orgSupportReportButton"\)\.addEventListener\("click", \(\) => openOrgSupportReportForm\(\)/u);
  assert.match(orgJs, /el\("orgSupportCancelButton"\)\.addEventListener\("click", \(\) => closeOrgSupportReportForm\(\)/u);
  assert.match(orgJs, /el\("orgSupportReportForm"\)\.addEventListener\("submit", \(event\) => submitOrgSupportReport\(event\)/u);
});

test("the org support history is refreshed as part of showWorkspace()'s init, and the section is hidden/shown alongside the other workspace sections", () => {
  assert.match(orgJs, /el\("orgSupportSection"\)\.hidden = true;/u);
  assert.match(orgJs, /el\("orgSupportSection"\)\.hidden = false;/u);
  assert.match(orgJs, /refreshOrgSupportHistory\(\)\.catch\(console\.error\)/u);
});

test("the FULL-UI-95 manifest functions are declared as implemented with real tests inside the existing organisation_billing area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  for (const functionId of [
    "org_owner_support_report_problem",
    "org_owner_support_context",
    "org_owner_support_history"
  ]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.deepEqual(fn.actors, ["org_owner"]);
    assert.equal(fn.direct_test, "test/full_ui_95_org_owner_support_surface.test.mjs");
    assert.equal(fn.integration_test, "test/org_owner_support_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-95" && slice.state === "implemented"));
});
