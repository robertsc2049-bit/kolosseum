// DEV NOTE: FULL-UI-26 organisation owner billing/roster (v1 shell) static
// surface contract - part B.4, manifest wiring for the org owner identity
// (B.1), roster management (B.2) and seat-entitlement billing (B.3) slices.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const accountService = read("src/api/org_owner_account_service.ts");
const auth = read("src/api/org_owner_auth.ts");
const ownerRoutes = read("src/api/org_owner.routes.ts");
const rosterService = read("src/api/org_roster_service.ts");
const billingService = read("src/api/org_billing_service.ts");
const coachRoutes = read("src/api/coach_org_membership.routes.ts");
const visibilityService = read("src/api/org_visibility_service.ts");
const orgCoachMessagingService = read("src/api/org_coach_messaging_service.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const appJs = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");

const orgFiles = [accountService, auth, ownerRoutes, rosterService, billingService, coachRoutes, orgCoachMessagingService];

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("org owner identity is wholly separate from the athlete/coach/admin session systems", () => {
  assert.match(accountService, /ORG_OWNER_SESSION_COOKIE = "kolosseum_org_owner_session"/u);
  for (const source of orgFiles) {
    assert.doesNotMatch(source, /kolosseum_session\b|kolosseum_admin_session/u);
  }

  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_org_owner_accounts/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_org_owner_sessions/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_organisations/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_org_coach_memberships/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_org_audit_records/u);
});

test("org owner accounts are self-service (unlike admin, which is out-of-band-only)", () => {
  assert.match(accountService, /export async function registerAndSignInOrgOwnerAccount/u);
  assert.doesNotMatch(ownerRoutes, /ADMIN_BOOTSTRAP_TOKEN/u);
});

test("org routes are mounted at their own /org and /coach-workspace prefixes, never under /account, /admin or /sessions", () => {
  assert.match(serverTs, /app\.use\("\/org", orgOwnerRouter\)/u);
  assert.match(serverTs, /app\.use\("\/coach-workspace", coachOrgMembershipRouter\)/u);

  for (const path_ of [
    '"/register"', '"/sign-in"', '"/sign-out"', '"/session"',
    '"/organisations"', '"/organisations/:org_id/roster/invite"',
    '"/organisations/:org_id/roster"', '"/organisations/:org_id/roster/:membership_id/remove"',
    '"/organisations/:org_id/billing"', '"/organisations/:org_id/billing/seat-plan"',
    '"/organisations/:org_id/athlete-visibility"',
    '"/organisations/:org_id/messages/threads"', '"/organisations/:org_id/messages/threads/:thread_id"',
    '"/organisations/:org_id/messages/coaches/:coach_user_id/send"'
  ]) {
    assert.ok(ownerRoutes.includes(path_), `expected org owner route ${path_}`);
  }

  for (const path_ of [
    '"/org-memberships"', '"/org-memberships/:membership_id/accept"', '"/org-memberships/:membership_id/leave"',
    '"/org-messages/threads"', '"/org-messages/threads/:thread_id"', '"/org-messages/organisations/:org_id/send"'
  ]) {
    assert.ok(coachRoutes.includes(path_), `expected coach org membership route ${path_}`);
  }
});

test("every org-owner route resolves identity from authenticatedOrgOwner, and every coach org-membership route resolves identity from authenticatedCoach - never a client-supplied id", () => {
  assert.doesNotMatch(ownerRoutes, /request\.body\.(?:owner_)?user_id|request\.query\.(?:owner_)?user_id/u);
  assert.doesNotMatch(coachRoutes, /request\.body\.coach_user_id|request\.query\.coach_user_id/u);

  const ownerAuthCalls = [...ownerRoutes.matchAll(/authenticatedOrgOwner\(request,\s*(?:false|true)\)/gu)].length;
  assert.ok(ownerAuthCalls >= 10, "every mutating/protected org owner route must resolve identity from authenticatedOrgOwner");

  const coachAuthCalls = [...coachRoutes.matchAll(/authenticatedCoach\(request,\s*(?:false|true)\)/gu)].length;
  assert.equal(coachAuthCalls, 6, "all six coach org-membership/org-messaging routes must resolve identity from authenticatedCoach");

  assert.match(ownerRoutes, /authenticatedOrgOwner\(request, false\)/u);
  assert.match(ownerRoutes, /authenticatedOrgOwner\(request, true\)/u);
});

test("no org file ever reads or writes any athlete-scoped table or record - the MVP boundary is structural, not policy", () => {
  for (const source of orgFiles) {
    assert.doesNotMatch(source, /athlete_user_id/u, "an org file must never reference athlete_user_id");
    // org_roster_service.ts's own DEV NOTE names beta_product_records in
    // prose to document that it never touches it - the real check is that
    // no query ever actually targets that table.
    assert.doesNotMatch(
      source,
      /FROM\s+beta_product_records|INTO\s+beta_product_records|UPDATE\s+beta_product_records/iu,
      "an org file must never query beta_product_records"
    );
  }
});

test("no org file imports any engine-truth service - org billing/roster are product state only", () => {
  for (const source of orgFiles) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("org billing reuses the pure S-V1-P-03 seat entitlement evaluator via the org-scoped scope pair, never a bespoke gate", () => {
  assert.match(billingService, /from "\.\.\/v1SeatEntitlementGuard\.mjs"/u);
  assert.match(billingService, /evaluateSeatEntitlement/u);
  assert.match(billingService, /controlled_launch_org_coach_seat/u);
  assert.match(billingService, /controlled_launch_org_coach_product_access/u);
  assert.doesNotMatch(billingService, /from ["']stripe["']/u);

  // The invite path in org_roster_service.ts genuinely calls into org
  // billing before writing a membership row - the seat check is real
  // enforcement, not documentation.
  assert.match(rosterService, /assertOrgSeatCapacity/u);
  assert.match(rosterService, /from "\.\/org_billing_service\.js"/u);
});

test("every real mutation writes an idempotent, correlation-id-deduped audit record inside the same transaction as the mutation", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_org_audit_records/u);
  assert.match(schema, /UNIQUE \(actor_user_id, correlation_id\)/u);

  assert.match(rosterService, /findExistingAudit/u);
  assert.match(rosterService, /idempotent_replay: replayed/u);
  assert.match(billingService, /findExistingAudit/u);

  for (const source of [rosterService, billingService]) {
    assert.match(source, /await client\.query\("BEGIN"\)/u);
    assert.match(source, /await client\.query\("COMMIT"\)/u);
  }
});

test("an org's seat plan is changed only through an explicit, audited action - an unconfigured plan is unrestricted, never blocking", () => {
  assert.match(billingService, /export async function changeOrgSeatPlan/u);
  assert.match(billingService, /seat_plan_changed/u);
  assert.match(schema, /seat_plan_changed/u);
  // Missing configuration blocks nothing that already worked before
  // billing existed - mirrors product_commercial_service.ts's own rule
  // that missing commercial config blocks checkout, never product usage.
  assert.match(billingService, /org\.seat_limit === null/u);
  assert.doesNotMatch(billingService, /org_billing_seat_plan_not_configured/u);
});

test("negative access: org owner routes and cookie are invisible to the athlete/coach single-page app", () => {
  assert.doesNotMatch(appJs, /\/org\/organisations|kolosseum_org_owner_session/u);
  assert.doesNotMatch(routeBootstrap, /org_owner/u);
});

function extractFunctionSource(source, functionName) {
  const startPattern = new RegExp(`async function ${functionName}\\(`, "u");
  const startMatch = startPattern.exec(source);
  assert.ok(startMatch, `expected to find function ${functionName} in org_visibility_service.ts`);
  const start = startMatch.index;
  const rest = source.slice(start + startMatch[0].length);
  // Top-level declarations in this file start at column 0 with no leading
  // whitespace - any inline helper inside a .map()/.filter() callback is
  // always indented, so this reliably bounds just this one function.
  const nextBoundary = rest.search(/\n(?:async function|function|export )/u);
  return nextBoundary === -1 ? source.slice(start) : source.slice(start, start + startMatch[0].length + nextBoundary);
}

// org_visibility_service.ts (part C) is the deliberate, sole exception to
// the "no org file ever reads or writes athlete-scoped data" rule proved
// by the test above - it is NOT added to orgFiles, and must never be:
// doing so would make that test correctly fail the moment its real
// athlete-scoped queries land. This test instead proves the boundary is
// mode-aware: the file legitimately touches beta_product_records, but its
// "individual"-mode aggregate path never touches athlete identity, while
// its "shared"-mode roster path does.
test("org_visibility_service.ts is the sole, explicitly-gated exception to the athlete-data boundary, and its individual-mode path never touches athlete identity", () => {
  assert.match(visibilityService, /beta_product_records/u);
  assert.match(visibilityService, /beta17_coach_relationship/u);

  for (const source of orgFiles) {
    assert.doesNotMatch(source, /athlete_user_id/u);
  }

  const aggregateFn = extractFunctionSource(visibilityService, "aggregateCountsForOrg");
  assert.doesNotMatch(aggregateFn, /athlete_user_id/u);
  assert.doesNotMatch(aggregateFn, /display_name|email|loadLatestBetaProductRecord/u);

  const rosterFn = extractFunctionSource(visibilityService, "fullRosterForOrg");
  assert.match(rosterFn, /athlete_user_id/u);
  assert.match(rosterFn, /display_name/u);
});

test("visibility_mode is declared once at org creation and immutable afterward - no route or function changes it", () => {
  assert.match(rosterService, /cleanVisibilityMode/u);
  assert.doesNotMatch(ownerRoutes, /visibility-mode|visibilityMode/u);
  assert.doesNotMatch(visibilityService, /UPDATE\s+product_organisations/iu);

  // A coach sees the org's visibility_mode before they accept an invite -
  // the same call that already supplies the membership_id needed to accept.
  assert.match(rosterService, /o\.visibility_mode/u);
});

test("org-owner<->coach messaging (part D.2) requires an EXACT 'active' membership match - not the '!= removed' aggregate check used by billing/visibility - and never touches athlete-scoped data", () => {
  assert.match(orgCoachMessagingService, /membership_status = 'active'/u);
  // Distinguishes this from activeAndInvitedCoachMemberships/orgOccupiedSeatCount,
  // which only ever exclude 'removed' for roster/aggregate purposes.
  assert.doesNotMatch(orgCoachMessagingService, /membership_status\s*!=\s*'removed'/u);

  // The file's own DEV NOTE names beta_product_records in prose to
  // document that it never touches it - the real check is that no query
  // ever actually targets that table (mirrors the same fix already
  // applied to the analogous check on org_roster_service.ts).
  assert.doesNotMatch(
    orgCoachMessagingService,
    /FROM\s+beta_product_records|INTO\s+beta_product_records|UPDATE\s+beta_product_records|beta17_coach_relationship/iu
  );

  // Reuses the D.1 schema (thread_type discriminator) rather than a
  // second migration.
  assert.match(orgCoachMessagingService, /'org_owner_coach'/u);
  assert.match(orgCoachMessagingService, /ON CONFLICT \(org_id, coach_user_id\) WHERE thread_type = 'org_owner_coach'/u);
  assert.match(orgCoachMessagingService, /ON CONFLICT \(thread_id, sender_user_id, client_request_id\) DO NOTHING/u);
});
