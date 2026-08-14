// DEV NOTE: FULL-UI-21 founder/admin operations static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/admin/index.html");
const js = read("public/admin/admin.js");
const appJs = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const accountService = read("src/api/product_admin_account_service.ts");
const auth = read("src/api/product_admin_auth.ts");
const reviewService = read("src/api/product_admin_review_service.ts");
const actionService = read("src/api/product_admin_action_service.ts");
const routes = read("src/api/product_admin.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const bootstrapScript = read("scripts/bootstrap_admin_account.mjs");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js/u;

test("admin identity is wholly separate from the athlete/coach session system", () => {
  assert.match(accountService, /ADMIN_SESSION_COOKIE = "kolosseum_admin_session"/u);
  assert.doesNotMatch(accountService, /PRODUCT_SESSION_COOKIE/u);
  assert.doesNotMatch(auth, /PRODUCT_SESSION_COOKIE/u);
  assert.doesNotMatch(routes, /PRODUCT_SESSION_COOKIE/u);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_admin_accounts/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_admin_sessions/u);
  // A founder/admin account is never created through the public
  // registration route.
  assert.doesNotMatch(read("src/api/product_account.routes.ts"), /product_admin_accounts/u);
  assert.doesNotMatch(read("src/api/product_account_service.ts"), /founder_admin/u);
});

test("a founder/admin account can only be created out-of-band, never through an HTTP route", () => {
  assert.doesNotMatch(routes, /createAdminAccount/u);
  assert.match(bootstrapScript, /ADMIN_BOOTSTRAP_TOKEN/u);
  assert.match(bootstrapScript, /process\.exit\(1\)/u);
  assert.doesNotMatch(bootstrapScript, /app\.(get|post|listen)\(/u);
});

test("admin routes are mounted at their own /admin prefix, never under /account, /coach-workspace or /sessions", () => {
  assert.match(serverTs, /app\.use\("\/admin", productAdminRouter\)/u);
  assert.doesNotMatch(serverTs, /app\.use\("\/account",\s*productAdminRouter/u);

  for (const path_ of [
    '"/sign-in"', '"/sign-out"', '"/accounts"', '"/accounts/:user_id"',
    '"/accounts/:user_id/state"', '"/accounts/:user_id/test-marking"',
    '"/commercial"', '"/support-requests"', '"/support-requests/:correlation_id/status"',
    '"/data-rights/exports"', '"/data-rights/deletions"', '"/audit-records"'
  ]) {
    assert.ok(routes.includes(path_), `expected route ${path_}`);
  }
});

test("every admin-scoped read route requires authenticatedAdmin, and every mutation additionally requires CSRF", () => {
  const readRoutes = [...routes.matchAll(/productAdminRouter\.get\(\s*"([^"]+)"/gu)].map((m) => m[1]);
  assert.ok(readRoutes.length >= 7, "expected several GET admin routes");

  const authCallCount = [...routes.matchAll(/authenticatedAdmin\(request,\s*(?:false|true)\)/gu)].length;
  // Every route except sign-in/sign-out calls authenticatedAdmin exactly
  // once: 12 routes total, minus the 2 unauthenticated sign-in/sign-out
  // routes.
  assert.equal(authCallCount, 10, "every non-auth admin route must call authenticatedAdmin exactly once");

  assert.match(routes, /authenticatedAdmin\(request, false\)/u);
  assert.match(routes, /authenticatedAdmin\(request, true\)/u);
});

test("explicit prevention of engine override: no admin file imports any engine-truth or relationship/assignment/session service", () => {
  for (const [label, source] of [
    ["product_admin_account_service.ts", accountService],
    ["product_admin_auth.ts", auth],
    ["product_admin_review_service.ts", reviewService],
    ["product_admin_action_service.ts", actionService],
    ["product_admin.routes.ts", routes]
  ]) {
    assert.doesNotMatch(source, forbiddenEngineImports, `${label} must not import an engine-truth service`);
    assert.doesNotMatch(source, /from ["']\.\.\/db\/schema/u, `${label} must not touch the engine-only schema module`);
  }

  // No admin function ever writes to blocks, sessions, or runtime_events.
  assert.doesNotMatch(actionService, /UPDATE\s+blocks\b|UPDATE\s+sessions\b|UPDATE\s+runtime_events\b|INSERT INTO\s+blocks\b|INSERT INTO\s+sessions\b|INSERT INTO\s+runtime_events\b/iu);
  assert.doesNotMatch(reviewService, /FROM\s+blocks\b|FROM\s+sessions\b|FROM\s+runtime_events\b/iu);
});

test("no organisation, gym, team or roster administration exists anywhere in this slice", () => {
  for (const source of [accountService, auth, reviewService, actionService, routes, html, js]) {
    assert.doesNotMatch(source, /organisation|organization|\bgym\b|\bteam\b|\broster\b/iu);
  }
});

test("account search, account-state review and coach entitlement/payment review are read-only cross-user queries", () => {
  assert.match(reviewService, /export async function searchAdminAccounts/u);
  assert.match(reviewService, /export async function getAdminAccountDetail/u);
  assert.match(reviewService, /export async function listAdminCommercialRecords/u);
  assert.match(reviewService, /FROM product_accounts/u);
  assert.match(reviewService, /FROM product_commercial_records/u);
});

test("support/error-record review and data-rights review are read-only, and support status is the one place status is ever mutated", () => {
  assert.match(reviewService, /export async function listAdminSupportRequests/u);
  assert.match(reviewService, /export async function listAdminDataExportRequests/u);
  assert.match(reviewService, /export async function listAdminDataDeletionRequests/u);
  assert.match(actionService, /export async function changeSupportRequestStatus/u);
  assert.match(actionService, /SUPPORT_REQUEST_STATES = new Set\(\["submitted", "acknowledged", "closed"\]\)/u);
});

test("account state changes are closed to active/suspended only - closed/deleted stays inside the sealed GDPR deletion queue", () => {
  assert.match(actionService, /ADMIN_ACCOUNT_STATES = new Set\(\["active", "suspended"\]\)/u);
  assert.doesNotMatch(actionService, /createGdprDeleteQueueRequest|v1GdprDeleteQueue/u);
});

test("test-user management is a dedicated marker table, not a column threaded through product_accounts", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_test_accounts/u);
  assert.match(actionService, /export async function setTestAccountMarking/u);
  assert.doesNotMatch(schema, /product_accounts[\s\S]{0,2000}is_test_account/u);
});

test("every confirmed operational action creates an immutable audit record with actor, action type, target, before/after state, timestamp and correlation id", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_admin_audit_records/u);
  assert.match(schema, /actor_user_id\s+TEXT NOT NULL/u);
  assert.match(schema, /action_type\s+TEXT NOT NULL/u);
  assert.match(schema, /target_record_type\s+TEXT NOT NULL/u);
  assert.match(schema, /target_record_id\s+TEXT NOT NULL/u);
  assert.match(schema, /before_state\s+JSONB NOT NULL/u);
  assert.match(schema, /after_state\s+JSONB NOT NULL/u);
  assert.match(schema, /correlation_id\s+TEXT NOT NULL/u);
  assert.match(schema, /created_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/u);

  // Append-only - no updated_at, no UPDATE statement against this table
  // anywhere.
  assert.doesNotMatch(schema, /product_admin_audit_records[\s\S]{0,400}updated_at/u);
  assert.doesNotMatch(actionService, /UPDATE product_admin_audit_records/u);
});

test("a repeated correlation_id replays the existing audit record instead of repeating the mutation", () => {
  assert.match(actionService, /findExistingAudit/u);
  assert.match(actionService, /idempotent_replay: replayed/u);
  assert.match(schema, /UNIQUE \(actor_user_id, correlation_id\)/u);
  // The idempotency check happens before the mutation runs, inside the
  // same transaction as the mutation and the audit write - returning the
  // existing record as a replay rather than performing the mutation again.
  const replayCallCount = [...actionService.matchAll(/if \(existingAudit\) return toAuditOutcome\(existingAudit, true\);/gu)].length;
  assert.equal(replayCallCount, 3, "each of the 3 mutating actions must check for and replay an existing audit record");
});

test("confirmed operational actions require an explicit second confirmation click before the request is sent", () => {
  assert.match(html, /id="accountToggleStateConfirmButton"/u);
  assert.match(html, /id="accountToggleTestConfirmButton"/u);
  assert.match(js, /function requestAccountStateToggle/u);
  assert.match(js, /function confirmAccountStateToggle|async function confirmAccountStateToggle/u);
  assert.match(js, /pendingStateChange/u);
});

test("the reason an admin gives for marking a test account is authorable, stored, and read back - not silently discarded", () => {
  // getAdminAccountDetail used to SELECT marked_by_admin_user_id and reason
  // from product_test_accounts and then never place them on the returned
  // object - a producer that validates and stores a real value with zero
  // downstream readers, same bug class as PR #865/#866.
  assert.match(reviewService, /SELECT marked_by_admin_user_id, reason, created_at FROM product_test_accounts/u);
  assert.match(reviewService, /test_account_reason:/u);
  assert.match(reviewService, /test_account_marked_by_admin_user_id:/u);

  // The audit trail for this action must reflect the actual reason, not
  // just the boolean flag, on both sides of the change.
  const markingFunction = actionService.slice(
    actionService.indexOf("export async function setTestAccountMarking"),
    actionService.indexOf("const SUPPORT_REQUEST_STATES")
  );
  assert.match(markingFunction, /beforeState = \{[\s\S]{0,80}reason:/u);
  assert.match(markingFunction, /afterState = \{[\s\S]{0,80}reason:/u);

  // The admin UI previously had no input for reason at all - it could only
  // be supplied via a direct API call, never through the product surface.
  assert.match(html, /id="accountTestMarkingReason"/u);
  assert.match(html, /id="accountDetailTestReason"/u);
  assert.match(js, /accountTestMarkingReason.*\.value/u);
  assert.match(js, /test_account_reason/u);
});

test("every route resolves the admin's own identity from the session, never a client-supplied admin id", () => {
  assert.doesNotMatch(routes, /request\.body\.admin_user_id|request\.query\.admin_user_id/u);
  assert.match(routes, /admin\.user_id/u);
});

test("negative access: the admin page and admin routes are invisible to the athlete/coach single-page app", () => {
  assert.doesNotMatch(appJs, /\/admin\//u);
  assert.doesNotMatch(appJs, /kolosseum_admin_session/u);
  assert.doesNotMatch(routeBootstrap, /founder_admin/u);
  assert.doesNotMatch(routeBootstrap, /\/admin\//u);
});

test("every new interactive admin control is a real focusable button/form, not a div handler (keyboard reachability)", () => {
  assert.match(html, /<form id="adminSignInForm">/u);
  assert.match(html, /<form id="accountSearchForm">/u);
  for (const id of [
    "adminSignOutButton", "accountToggleStateButton", "accountToggleStateConfirmButton",
    "accountToggleTestButton", "accountToggleTestConfirmButton"
  ]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }
});
