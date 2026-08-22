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
const orgAthleteMessagingService = read("src/api/org_athlete_messaging_service.ts");
const messagingRoutes = read("src/api/messaging.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const appJs = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const orgDashboardHtml = read("public/org/index.html");
const orgDashboardJs = read("public/org/org.js");
const coachWorkspaceRoutes = read("src/api/coach_workspace.routes.ts");
const athleteOrgContextService = read("src/api/athlete_org_context_service.ts");

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
    '"/organisations/:org_id/athlete-visibility"', '"/organisations/:org_id/audit-log"',
    '"/organisations/:org_id/messages/threads"', '"/organisations/:org_id/messages/threads/:thread_id"',
    '"/organisations/:org_id/messages/coaches/:coach_user_id/send"',
    '"/organisations/:org_id/athlete-messages/threads"', '"/organisations/:org_id/athlete-messages/threads/:thread_id"',
    '"/organisations/:org_id/athlete-messages/athletes/:athlete_user_id/send"'
  ]) {
    assert.ok(ownerRoutes.includes(path_), `expected org owner route ${path_}`);
  }

  for (const path_ of [
    '"/org-memberships"', '"/org-memberships/:membership_id/accept"', '"/org-memberships/:membership_id/leave"',
    '"/org-messages/threads"', '"/org-messages/threads/:thread_id"', '"/org-messages/organisations/:org_id/send"',
    '"/organisations/:org_id/roster"'
  ]) {
    assert.ok(coachRoutes.includes(path_), `expected coach org membership route ${path_}`);
  }

  // Part D.4's athlete-side routes live in messaging.routes.ts (mounted at
  // /messages, alongside the D.1 coach<->athlete routes) rather than in
  // ownerRoutes/coachRoutes above - proven here rather than duplicated in
  // coach_athlete_messaging_surface.test.mjs, which is explicitly scoped
  // to the D.1 slice only.
  for (const path_ of [
    '"/athlete/org-messages/threads"', '"/athlete/org-messages/threads/:thread_id"',
    '"/athlete/org-messages/organisations/:org_id/send"',
    '"/athlete/org-messages/attachments/:message_id"', '"/athlete/org-messages/attachments/:message_id/thumbnail"'
  ]) {
    assert.ok(messagingRoutes.includes(path_), `expected athlete-side org-messaging route ${path_}`);
  }
});

test("every org-owner route resolves identity from authenticatedOrgOwner, and every coach org-membership route resolves identity from authenticatedCoach - never a client-supplied id", () => {
  assert.doesNotMatch(ownerRoutes, /request\.body\.(?:owner_)?user_id|request\.query\.(?:owner_)?user_id/u);
  assert.doesNotMatch(coachRoutes, /request\.body\.coach_user_id|request\.query\.coach_user_id/u);

  const ownerAuthCalls = [...ownerRoutes.matchAll(/authenticatedOrgOwner\(request,\s*(?:false|true)\)/gu)].length;
  assert.ok(ownerAuthCalls >= 10, "every mutating/protected org owner route must resolve identity from authenticatedOrgOwner");

  const coachAuthCalls = [...coachRoutes.matchAll(/authenticatedCoach\(request,\s*(?:false|true)\)/gu)].length;
  assert.equal(coachAuthCalls, 9, "all nine coach org-membership/org-messaging routes (including the two D.3 attachment routes and O.7's fellow-coach roster route) must resolve identity from authenticatedCoach");

  assert.match(ownerRoutes, /authenticatedOrgOwner\(request, false\)/u);
  assert.match(ownerRoutes, /authenticatedOrgOwner\(request, true\)/u);
});

// ownerRoutes is excluded from the athlete_user_id string check only (part
// D.4): its new /organisations/:org_id/athlete-messages/athletes/
// :athlete_user_id/send route genuinely names an athlete by id, purely as
// a route param it passes straight through to org_athlete_messaging_
// service.ts's own gated functions - it still never queries
// beta_product_records itself (checked below, over the FULL orgFiles
// list, unchanged), and the dedicated test further down proves its only
// athlete_user_id occurrences are exactly that pass-through, never inline
// business logic.
const orgFilesForAthleteIdCheck = orgFiles.filter((source) => source !== ownerRoutes);

test("no org file ever reads or writes any athlete-scoped table or record - the MVP boundary is structural, not policy", () => {
  for (const source of orgFilesForAthleteIdCheck) {
    assert.doesNotMatch(source, /athlete_user_id/u, "an org file must never reference athlete_user_id");
  }
  for (const source of orgFiles) {
    // org_roster_service.ts's own DEV NOTE names beta_product_records in
    // prose to document that it never touches it - the real check is that
    // no query ever actually targets that table. This holds for ownerRoutes
    // too - it delegates to org_athlete_messaging_service.ts rather than
    // querying anything athlete-scoped itself.
    assert.doesNotMatch(
      source,
      /FROM\s+beta_product_records|INTO\s+beta_product_records|UPDATE\s+beta_product_records/iu,
      "an org file must never query beta_product_records"
    );
  }
});

test("ownerRoutes' only athlete_user_id references are the D.4 route param and its pass-through to org_athlete_messaging_service.ts - never inline business logic", () => {
  const occurrences = [...ownerRoutes.matchAll(/athlete_user_id/gu)].length;
  // :athlete_user_id (route param) + request.params.athlete_user_id
  // (passed straight to sendOrgAthleteMessageFromOwner) = exactly 2.
  assert.equal(occurrences, 2, "expected exactly the route param and its single pass-through");
  assert.match(ownerRoutes, /"\/organisations\/:org_id\/athlete-messages\/athletes\/:athlete_user_id\/send"/u);
  assert.match(ownerRoutes, /String\(request\.params\.athlete_user_id\)/u);
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

// org_visibility_service.ts (part C) and org_athlete_messaging_service.ts
// (part D.4) are the two deliberate, explicitly-gated exceptions to the
// "no org file ever reads or writes athlete-scoped data" rule proved by
// the test above - neither is added to orgFiles, and must never be:
// doing so would make that test correctly fail the moment its real
// athlete-scoped queries land. This test instead proves the boundary is
// mode-aware: both files legitimately touch beta_product_records, but
// org_visibility_service.ts's "individual"-mode aggregate path never
// touches athlete identity, while its "shared"-mode roster path does -
// and org_athlete_messaging_service.ts reuses that exact same
// visibility_mode gate for its own messaging boundary (proved in the
// dedicated D.4 test below).
test("org_visibility_service.ts and org_athlete_messaging_service.ts are the only two explicitly-gated exceptions to the athlete-data boundary, and org_visibility_service.ts's individual-mode path never touches athlete identity", () => {
  assert.match(visibilityService, /beta_product_records/u);
  assert.match(visibilityService, /beta17_coach_relationship/u);
  assert.match(orgAthleteMessagingService, /beta_product_records/u);
  assert.match(orgAthleteMessagingService, /beta17_coach_relationship/u);

  for (const source of orgFilesForAthleteIdCheck) {
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

test("org-owner<->athlete messaging (part D.4) is gated to visibility_mode = 'shared' orgs only, on top of an accepted relationship with an active org coach - never the '!= removed' aggregate check", () => {
  assert.match(orgAthleteMessagingService, /visibility_mode !== "shared"/u);
  assert.match(orgAthleteMessagingService, /membership_status = 'active'/u);
  // Distinguishes this from activeAndInvitedCoachMemberships/orgOccupiedSeatCount,
  // which only ever exclude 'removed' for roster/aggregate purposes - and
  // from a hypothetical "invited counts too" gate, which would let a
  // merely-invited coach's athletes be messaged.
  assert.doesNotMatch(orgAthleteMessagingService, /membership_status\s*!=\s*'removed'/u);
  assert.match(orgAthleteMessagingService, /state === "accepted"/u);

  // The relationship-freshness check is duplicated locally from
  // org_visibility_service.ts's own isRelationshipExpired/DISTINCT-ON
  // shape rather than imported - same convention as every sibling org
  // file.
  assert.match(orgAthleteMessagingService, /DISTINCT ON \(actor_user_id\)/u);
  assert.match(orgAthleteMessagingService, /isRelationshipExpired/u);

  // Reuses the D.1/D.3 schema (thread_type discriminator, attachment
  // columns) rather than a second migration.
  assert.match(orgAthleteMessagingService, /'org_owner_athlete'/u);
  assert.match(orgAthleteMessagingService, /ON CONFLICT \(org_id, athlete_user_id\) WHERE thread_type = 'org_owner_athlete'/u);
  assert.match(orgAthleteMessagingService, /ON CONFLICT \(thread_id, sender_user_id, client_request_id\) DO NOTHING/u);
});

// Part O.1 - the org owner's first real UI, mirroring the founder/admin
// surface's exact precedent (test/full_ui_21_founder_admin_surface.test.mjs's
// own coverage of public/admin/index.html + admin.js): a wholly separate,
// minimal static page, never part of the athlete/coach SPA shell, never
// reachable through PRODUCT_ROUTE_MAP. Every route it calls already
// existed and was already covered by real Postgres integration tests
// (parts B.1/B.2) before this UI existed - these checks prove the static
// files exist and wire up correctly, not the routes themselves again.
test("the org-owner dashboard is mounted at its own /org static prefix, served before the API router on the same prefix", () => {
  const staticMountIndex = serverTs.indexOf('app.use("/org", express.static(orgAppDir));');
  const routerMountIndex = serverTs.indexOf('app.use("/org", orgOwnerRouter);');
  assert.ok(staticMountIndex >= 0, "expected the /org static mount");
  assert.ok(routerMountIndex >= 0, "expected the /org API router mount");
  assert.ok(staticMountIndex < routerMountIndex, "the static mount must come before the API router mount, same as /admin");
});

test("org.js is wholly separate from the athlete/coach app and the founder/admin app", () => {
  assert.doesNotMatch(orgDashboardJs, /^import /mu);
  assert.doesNotMatch(orgDashboardJs, /kolosseum_session\b|kolosseum_admin_session/u);
  // Anchored to the start of a fetched path (right after a quote or
  // backtick) so O.5's legitimate /org/organisations/:org_id/messages/...
  // and .../athlete-messages/... routes - which contain "/messages/" as a
  // nested segment, never as the top-level prefix - don't false-positive
  // against the athlete/coach app's own top-level /messages family.
  assert.doesNotMatch(orgDashboardJs, /["`]\/(?:account|coach-workspace|sessions|blocks|messages)\//u);
  assert.doesNotMatch(appJs, /\/org\/register|\/org\/sign-in|org\.js/u);
  assert.doesNotMatch(routeBootstrap, /org_owner|public\/org\//u);
});

test("the org-owner dashboard's sign-in, register and create-organisation forms are real focusable controls posting to the existing org-owner routes", () => {
  assert.match(orgDashboardHtml, /<form id="orgSignInForm">/u);
  assert.match(orgDashboardHtml, /<form id="orgRegisterForm">/u);
  assert.match(orgDashboardHtml, /<form id="orgCreateForm">/u);
  for (const id of ["orgSignOutButton"]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(orgDashboardHtml, re, `${id} must be a real <button type="button">`);
  }

  assert.match(orgDashboardJs, /api\("POST", "\/org\/sign-in"/u);
  assert.match(orgDashboardJs, /api\("POST", "\/org\/register"/u);
  assert.match(orgDashboardJs, /api\("POST", "\/org\/sign-out"/u);
  assert.match(orgDashboardJs, /api\("GET", "\/org\/organisations"\)/u);
  assert.match(orgDashboardJs, /api\("POST", "\/org\/organisations"/u);
});

test("the org-owner dashboard reuses the shared product stylesheet, never the bare inline styling the admin surface uses", () => {
  assert.match(orgDashboardHtml, /<link rel="stylesheet" href="\/app\/styles\.css" \/>/u);
  assert.doesNotMatch(orgDashboardHtml, /<style>/u);
});

test("organisation names rendered into the org-owner dashboard are escaped before being inserted into innerHTML", () => {
  assert.match(orgDashboardJs, /function escapeHtml/u);
  assert.match(orgDashboardJs, /escapeHtml\(organisation\.org_name\)/u);
});

// Part O.2 - the coach roster view (invite by email, list, remove), built
// entirely on top of the already-integration-tested org_owner_roster
// routes (part B.2) plus a display-only join onto product_accounts so the
// owner sees a coach's name/email instead of a bare user_id (part O.2's
// only backend change - covered by org_roster_lifecycle_persistent's
// existing assertions still passing, not by a new integration test).
test("each organisation card exposes a real, keyboard-reachable button to manage its roster", () => {
  assert.match(orgDashboardHtml, /<section id="orgRosterSection"/u);
  assert.match(orgDashboardJs, /data-manage-roster="\$\{escapeHtml\(organisation\.org_id\)\}"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-manage-roster=/u);
  assert.match(orgDashboardJs, /querySelectorAll\("\[data-manage-roster\]"\)/u);
});

test("the roster invite form and back button are real, keyboard-reachable controls calling the existing roster routes", () => {
  assert.match(orgDashboardHtml, /<form id="orgRosterInviteForm">/u);
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgRosterBackButton"[^>]*type="button"/u,
    "orgRosterBackButton must be a real <button type=\"button\">"
  );

  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/roster`\)/u);
  assert.match(orgDashboardJs, /api\("POST", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/roster\/invite`/u);
  assert.match(
    orgDashboardJs,
    /api\("POST", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/roster\/\$\{encodeURIComponent\(membershipId\)\}\/remove`/u
  );
});

test("roster remove buttons only render for non-removed memberships and are real, keyboard-reachable controls", () => {
  assert.match(orgDashboardJs, /membership\.membership_status === "removed"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-remove-membership=/u);
  assert.match(orgDashboardJs, /querySelectorAll\("\[data-remove-membership\]"\)/u);
});

test("coach display names and emails rendered into the roster view are escaped before being inserted into innerHTML", () => {
  assert.match(orgDashboardJs, /escapeHtml\(membership\.coach_display_name \|\| membership\.coach_user_id\)/u);
  assert.match(orgDashboardJs, /escapeHtml\(membership\.coach_email \|\| ""\)/u);
});

test("membership invited/activated/removed dates are actually read and rendered on both the org owner's roster and the coach's own org-context panel, not just derived and stored", () => {
  // org_roster_service.ts's mapMembershipRow has always computed
  // invited_at_iso8601/activated_at_iso8601/removed_at_iso8601 from real
  // DB timestamps and returned them on every roster read, but until now
  // nothing in org.js or app.js ever read those fields - the org owner's
  // roster cards and the coach's own org-context panel showed a status
  // badge with no dates at all. Same phantom-field bug class as PR
  // #877/#878/#879/#880.
  assert.match(rosterService, /invited_at_iso8601: value\.invited_at instanceof Date/u);
  assert.match(rosterService, /activated_at_iso8601: value\.activated_at instanceof Date/u);
  assert.match(rosterService, /removed_at_iso8601: value\.removed_at instanceof Date/u);

  assert.match(orgDashboardJs, /membership\.invited_at_iso8601/u);
  assert.match(orgDashboardJs, /membership\.activated_at_iso8601/u);
  assert.match(orgDashboardJs, /membership\.removed_at_iso8601/u);

  assert.match(appJs, /entry\.membership\.activated_at_iso8601/u);
  assert.match(appJs, /entry\.membership\.invited_at_iso8601/u);
});

test("org_roster_service.ts's coach_display_name/coach_email are display-only additions, populated solely by the roster-list join", () => {
  assert.match(rosterService, /coach_display_name: string \| null/u);
  assert.match(rosterService, /coach_email: string \| null/u);
  assert.match(rosterService, /LEFT JOIN product_accounts a ON a\.user_id = m\.coach_user_id/u);
});

// Part O.3 - the seat-plan billing view (status + update), built entirely
// on top of the already-integration-tested org_owner_billing routes (part
// B.3) - zero backend changes, unlike O.2's display-only join.
test("each organisation card exposes a real, keyboard-reachable button to manage its billing", () => {
  assert.match(orgDashboardHtml, /<section id="orgBillingSection"/u);
  assert.match(orgDashboardJs, /data-manage-billing="\$\{escapeHtml\(organisation\.org_id\)\}"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-manage-billing=/u);
  assert.match(orgDashboardJs, /querySelectorAll\("\[data-manage-billing\]"\)/u);
});

test("the billing seat-plan form and back button are real, keyboard-reachable controls calling the existing billing routes", () => {
  assert.match(orgDashboardHtml, /<form id="orgBillingSeatPlanForm">/u);
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgBillingBackButton"[^>]*type="button"/u,
    "orgBillingBackButton must be a real <button type=\"button\">"
  );

  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/billing`\)/u);
  assert.match(orgDashboardJs, /api\("POST", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/billing\/seat-plan`/u);
});

test("opening the roster view for one organisation hides the billing view and vice versa, so both never show at once", () => {
  assert.match(orgDashboardJs, /function showRosterSection[\s\S]{0,200}orgBillingSection"\)\.hidden = true/u);
  assert.match(orgDashboardJs, /function showBillingSection[\s\S]{0,200}orgRosterSection"\)\.hidden = true/u);
});

// Part O.4 - the athlete-visibility view, built entirely on top of the
// already-integration-tested org_owner_athlete_visibility route (part C) -
// zero new backend calls. Coach names come from the already-fetched
// roster route, joined client-side by coach_user_id.
test("each organisation card exposes a real, keyboard-reachable button to view athlete visibility, and opening it hides every other detail section", () => {
  assert.match(orgDashboardHtml, /<section id="orgVisibilitySection"/u);
  assert.match(orgDashboardJs, /data-view-athletes="\$\{escapeHtml\(organisation\.org_id\)\}"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-view-athletes=/u);
  assert.match(orgDashboardJs, /querySelectorAll\("\[data-view-athletes\]"\)/u);
  assert.match(
    orgDashboardJs,
    /function showVisibilitySection[\s\S]{0,200}orgRosterSection"\)\.hidden = true[\s\S]{0,200}orgBillingSection"\)\.hidden = true/u
  );
});

test("the athlete-visibility view calls the existing athlete-visibility route and the roster route, and its back button is a real, keyboard-reachable control", () => {
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgVisibilityBackButton"[^>]*type="button"/u,
    "orgVisibilityBackButton must be a real <button type=\"button\">"
  );

  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/roster`\)/u);
  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/athlete-visibility`\)/u);
});

test("the athlete-visibility view renders individual-mode aggregate counts and shared-mode per-athlete rosters as two distinct branches, driven only by the server's own visibility_mode", () => {
  assert.match(orgDashboardJs, /visibility\.visibility_mode === "individual"/u);
  assert.match(orgDashboardJs, /coach\.active_athlete_count/u);
  assert.match(orgDashboardJs, /coach\.invited_athlete_count/u);
  assert.match(orgDashboardJs, /coach\.athletes\.map/u);
});

test("athlete names and emails rendered into the visibility view are escaped before being inserted into innerHTML", () => {
  assert.match(orgDashboardJs, /escapeHtml\(athlete\.display_name\)/u);
  assert.match(orgDashboardJs, /escapeHtml\(athlete\.email \|\| "no email"\)/u);
});

// Part O.9 - the activity log view. Every real mutation in
// org_roster_service.ts/org_billing_service.ts already writes a factual
// audit record via writeAuditRecord()/withIdempotentAudit(), but until this
// slice the only SELECT against product_org_audit_records anywhere was the
// write-side's own idempotency lookup (findExistingAudit) - the org owner
// had no route to ever read their own organisation's recorded activity
// back.
test("org_roster_service.ts exposes a listOrgAuditLog read path over product_org_audit_records, distinct from the write-side's idempotency-only lookup", () => {
  assert.match(rosterService, /export async function listOrgAuditLog/u);
  assert.match(rosterService, /FROM product_org_audit_records/u);
  assert.match(rosterService, /requireOrganisationOwnedBy/u);
});

test("the audit-log route resolves identity from authenticatedOrgOwner and delegates to listOrgAuditLog, mirroring the athlete-visibility route's own shape", () => {
  assert.match(
    ownerRoutes,
    /"\/organisations\/:org_id\/audit-log"[\s\S]{0,200}authenticatedOrgOwner\(request, false\)[\s\S]{0,200}listOrgAuditLog/u
  );
});

test("each organisation card exposes a real, keyboard-reachable button to view the activity log, and opening it hides every other detail section", () => {
  assert.match(orgDashboardHtml, /<section id="orgAuditSection"/u);
  assert.match(orgDashboardJs, /data-view-audit="\$\{escapeHtml\(organisation\.org_id\)\}"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-view-audit=/u);
  assert.match(orgDashboardJs, /querySelectorAll\("\[data-view-audit\]"\)/u);
  assert.match(
    orgDashboardJs,
    /function showAuditSection[\s\S]{0,300}orgRosterSection"\)\.hidden = true[\s\S]{0,300}orgBillingSection"\)\.hidden = true[\s\S]{0,300}orgVisibilitySection"\)\.hidden = true/u
  );
});

test("the activity log view calls the new audit-log route, and its back button is a real, keyboard-reachable control", () => {
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgAuditBackButton"[^>]*type="button"/u,
    "orgAuditBackButton must be a real <button type=\"button\">"
  );

  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/audit-log`\)/u);
});

// Part O.6 - athlete-facing team/org context. The athlete panel used to be
// gated entirely on a message thread already existing, but threads are
// created lazily on first send and the panel was the only place the
// frontend ever learned an org's org_id - so an athlete could never send
// the FIRST message to their own team. GET /coach-workspace/org-context/
// mine now supplies every org an athlete's accepted+active coach
// relationship gives team context for, independent of message history.
test("the athlete-facing org-context route exists on the coach-workspace router, and its service composes two already-tested read paths rather than adding a new query of its own", () => {
  assert.ok(coachWorkspaceRoutes.includes('"/org-context/mine"'), "expected the org-context/mine route");
  assert.match(coachWorkspaceRoutes, /getAthleteOrgContextHandler/u);

  assert.match(athleteOrgContextService, /listRelationshipsForAthlete/u);
  assert.match(athleteOrgContextService, /listOrgMembershipsForCoach/u);
  assert.doesNotMatch(
    athleteOrgContextService,
    /SELECT\s|FROM\s+beta_product_records|FROM\s+product_org_coach_memberships/iu,
    "athlete_org_context_service.ts must never run a query of its own - only compose already-tested functions"
  );
  assert.match(athleteOrgContextService, /relationship\.relationship_state !== "accepted"/u);
  assert.match(athleteOrgContextService, /membership\.membership_status !== "active"/u);
});

test("the athlete org-messages panel calls the new org-context route and merges it with existing threads by org_id, so it no longer requires a thread to already exist", () => {
  assert.match(appJs, /api\("GET", "\/coach-workspace\/org-context\/mine"\)/u);
  assert.match(appJs, /function combinedAthleteOrgEntries/u);
  assert.match(appJs, /const entries = combinedAthleteOrgEntries\(\);/u);
  assert.doesNotMatch(
    appJs,
    /const entries = Array\.isArray\(state\.athleteOrgMessageThreads\) \? state\.athleteOrgMessageThreads : \[\];\s*\n\s*if \(entries\.length === 0\)/u,
    "the panel's emptiness check must no longer be gated solely on thread existence"
  );
});

test("the athlete org-messages panel only renders a send form for shared-mode org context, never individual-mode", () => {
  assert.match(appJs, /entry\.visibility_mode === "shared"/u);
  assert.match(appJs, /no team messaging/u);
});

test("org names rendered into the athlete org-messages panel are escaped before being inserted into innerHTML", () => {
  assert.match(appJs, /escapeHtml\(entry\.org_name\)/u);
});

// Part O.7 - coach-facing org/team context, the mirror of O.6's athlete
// side. A coach sees fellow coaches only in shared (team) orgs; individual
// (gym) orgs stay exactly as coach-private as they already were.
test("the coach fellow-roster route is authorized by active membership, never by org ownership", () => {
  assert.ok(coachRoutes.includes('"/organisations/:org_id/roster"'), "expected the coach-facing fellow-roster route");
  assert.match(coachRoutes, /listOrganisationRosterForCoach/u);

  assert.match(rosterService, /export async function listOrganisationRosterForCoach/u);
  const functionBody = rosterService.slice(rosterService.indexOf("export async function listOrganisationRosterForCoach"));
  const functionEnd = functionBody.indexOf("\nexport async function", 1);
  const scopedBody = functionEnd === -1 ? functionBody : functionBody.slice(0, functionEnd);
  assert.doesNotMatch(scopedBody, /requireOrganisationOwnedBy/u, "the coach-facing roster function must never authorize by ownership");
  assert.match(scopedBody, /membership_status = 'active'/u);
  assert.match(scopedBody, /visibility_mode !== "shared"/u);
});

test("the coach org-context panel calls both the org-memberships and fellow-roster routes, and only fetches the roster for shared-mode, currently-active memberships - never for a merely-invited one, which the roster route itself would 403 on", () => {
  assert.match(appJs, /api\("GET", "\/coach-workspace\/org-memberships"\)/u);
  assert.match(appJs, /api\(\s*"GET",\s*`\/coach-workspace\/organisations\/\$\{encodeURIComponent\(membership\.org_id\)\}\/roster`/u);
  assert.match(appJs, /if \(membership\.visibility_mode !== "shared" \|\| membership\.membership_status !== "active"\)/u);
});

test("the coach org-context panel is gated to state.role === \"coach\" and mirrors the athlete panel's insertion pattern", () => {
  assert.match(appJs, /function refreshCoachOrgContext/u);
  assert.match(appJs, /if \(state\.role !== "coach"\) return;/u);
  assert.match(appJs, /panel\.id = "coachOrgContextPanel";/u);
  assert.match(appJs, /\.querySelector\("#view-account \.two-column"\)\s*\n\s*\.insertAdjacentElement\("afterend", panel\);/u);
});

test("org names and fellow-coach names/emails rendered into the coach org-context panel are escaped before being inserted into innerHTML", () => {
  assert.match(appJs, /escapeHtml\(entry\.membership\.org_name\)/u);
  assert.match(appJs, /escapeHtml\(fellow\.coach_display_name \|\| fellow\.coach_user_id\)/u);
  assert.match(appJs, /escapeHtml\(fellow\.coach_email\)/u);
});

// The manifest's coach_org_membership function has claimed "accepts and
// leaves org memberships" as implemented since Part B.2, backed by real,
// already-tested routes - but until now nothing in the coach workspace
// ever called them. A coach invited to an org had no way to ever move
// past "invited", and an active member had no way to ever leave.
test("the coach org-context panel actually renders Accept/Leave controls wired to the coach's own already-implemented accept/leave routes", () => {
  assert.match(appJs, /entry\.membership\.membership_status === "invited"/u);
  assert.match(appJs, /data-org-membership-action="accept"/u);
  assert.match(appJs, /entry\.membership\.membership_status === "active"/u);
  assert.match(appJs, /data-org-membership-action="leave"/u);
  assert.match(appJs, /data-membership-id="\$\{escapeHtml\(entry\.membership\.membership_id\)\}"/u);

  assert.match(appJs, /async function resolveOrgMembershipAction\(membershipId, action\)/u);
  assert.match(
    appJs,
    /api\(\s*"POST",\s*`\/coach-workspace\/org-memberships\/\$\{encodeURIComponent\(membershipId\)\}\/\$\{action\}`/u
  );
  assert.match(appJs, /await refreshCoachOrgContext\(\);/u);

  assert.match(
    appJs,
    /const button = event\.target\.closest\("\[data-org-membership-action\]"\);\s*\n\s*if \(!button\) return;\s*\n\s*resolveOrgMembershipAction\(\s*\n\s*button\.dataset\.membershipId,\s*\n\s*button\.dataset\.orgMembershipAction\s*\n\s*\)/u
  );
});

// Part O.5 - the org<->coach and org<->athlete messaging inboxes, built
// entirely on top of the already-integration-tested D.2/D.4 routes.
// Text-only send (mirrors public/app/app.js's sendMessageRequest text-only
// branch exactly); any attachment already on a received message still
// renders read-only via the same img/video markup app.js uses. Athlete
// counterpart names reuse O.4's shared-mode visibility data (athlete
// messaging is itself gated to shared orgs only); coach counterpart names
// reuse O.2's roster join.
test("each organisation card exposes a real, keyboard-reachable button to open its messages, and opening it hides every other detail section", () => {
  assert.match(orgDashboardHtml, /<section id="orgMessagesSection"/u);
  assert.match(orgDashboardHtml, /<section id="orgThreadDetailSection"/u);
  assert.match(orgDashboardJs, /data-view-messages="\$\{escapeHtml\(organisation\.org_id\)\}"/u);
  assert.match(orgDashboardJs, /<button class="button secondary" type="button" data-view-messages=/u);
  assert.match(
    orgDashboardJs,
    /function showMessagesSection[\s\S]{0,300}orgRosterSection"\)\.hidden = true[\s\S]{0,300}orgBillingSection"\)\.hidden = true[\s\S]{0,300}orgVisibilitySection"\)\.hidden = true/u
  );
});

test("the messaging inbox calls the existing coach-thread, athlete-thread, roster and athlete-visibility routes", () => {
  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/messages\/threads`\)/u);
  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/athlete-messages\/threads`\)/u);
  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/roster`\)/u);
  assert.match(orgDashboardJs, /api\("GET", `\/org\/organisations\/\$\{encodeURIComponent\(state\.selectedOrgId\)\}\/athlete-visibility`\)/u);
});

test("a thread's send route depends only on which kind of thread is open, never a hardcoded route", () => {
  assert.match(
    orgDashboardJs,
    /function threadSendRoute\(\)[\s\S]{0,200}\/messages\/coaches\/\$\{encodeURIComponent\(state\.selectedCounterpartId\)\}\/send[\s\S]{0,200}\/athlete-messages\/athletes\/\$\{encodeURIComponent\(state\.selectedCounterpartId\)\}\/send/u
  );
  assert.match(orgDashboardJs, /api\("POST", threadSendRoute\(\), \{/u);
  assert.match(orgDashboardJs, /body_text: el\("orgThreadReplyText"\)\.value/u);
});

test("the thread reply form and both back buttons are real, keyboard-reachable controls", () => {
  assert.match(orgDashboardHtml, /<form id="orgThreadReplyForm">/u);
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgMessagesBackButton"[^>]*type="button"/u,
    "orgMessagesBackButton must be a real <button type=\"button\">"
  );
  assert.match(
    orgDashboardHtml,
    /<button[^>]*id="orgThreadDetailBackButton"[^>]*type="button"/u,
    "orgThreadDetailBackButton must be a real <button type=\"button\">"
  );
});

test("message body text and attachment URLs rendered into the thread view are escaped before being inserted into innerHTML", () => {
  assert.match(orgDashboardJs, /escapeHtml\(message\.body_text\)/u);
  assert.match(orgDashboardJs, /escapeHtml\(attachment\.url\)/u);
});

test("O.5 sends no attachment upload from the org-owner UI - text-only, matching public/app/app.js's own text-only send branch", () => {
  assert.doesNotMatch(orgDashboardJs, /FormData/u);
  assert.doesNotMatch(orgDashboardJs, /attachmentUpload|\.single\("attachment"\)/u);
});

test("an attachment's byte_size, already returned by org_coach_messaging_service.ts and org_athlete_messaging_service.ts, is shown to the user as a human-readable file size, matching the same fix in public/app/app.js", () => {
  assert.match(orgDashboardJs, /function formatAttachmentSize/u);
  assert.match(orgDashboardJs, /formatAttachmentSize\(attachment\.byte_size\)/u);
});

test("the org owner's own last-read marker is shared across both org_owner_coach and org_owner_athlete threads, reusing coach_last_read_at/athlete_last_read_at for the coach/athlete side of each - the same column-reuse-across-thread-type convention this table already uses", () => {
  assert.match(schema, /ADD COLUMN IF NOT EXISTS owner_last_read_at TIMESTAMPTZ/u);
});

test("org-coach unread count is a live derived COUNT of the peer's messages since the viewer's own last-read marker, never a stored/cached number, for both the owner and coach side", () => {
  assert.match(orgCoachMessagingService, /m\.sender_role = 'coach'/u);
  assert.match(orgCoachMessagingService, /COALESCE\(t\.owner_last_read_at, '-infinity'::timestamptz\)/u);
  assert.match(orgCoachMessagingService, /m\.sender_role = 'org_owner'/u);
  assert.match(orgCoachMessagingService, /COALESCE\(t\.coach_last_read_at, '-infinity'::timestamptz\)/u);
});

test("opening an org-coach thread's messages marks it read for that viewer only, on both the owner and coach side", () => {
  assert.match(orgCoachMessagingService, /UPDATE product_message_threads SET owner_last_read_at = now\(\) WHERE thread_id = \$1/u);
  assert.match(orgCoachMessagingService, /UPDATE product_message_threads SET coach_last_read_at = now\(\) WHERE thread_id = \$1/u);
});

test("org-athlete unread count is a live derived COUNT of the peer's messages since the viewer's own last-read marker, never a stored/cached number, for both the owner and athlete side", () => {
  assert.match(orgAthleteMessagingService, /m\.sender_role = 'athlete'/u);
  assert.match(orgAthleteMessagingService, /COALESCE\(t\.owner_last_read_at, '-infinity'::timestamptz\)/u);
  assert.match(orgAthleteMessagingService, /m\.sender_role = 'org_owner'/u);
  assert.match(orgAthleteMessagingService, /COALESCE\(t\.athlete_last_read_at, '-infinity'::timestamptz\)/u);
});

test("opening an org-athlete thread's messages marks it read for that viewer only, on both the owner and athlete side", () => {
  assert.match(orgAthleteMessagingService, /UPDATE product_message_threads SET owner_last_read_at = now\(\) WHERE thread_id = \$1/u);
  assert.match(orgAthleteMessagingService, /UPDATE product_message_threads SET athlete_last_read_at = now\(\) WHERE thread_id = \$1/u);
});

test("the org owner dashboard shows a live unread badge per thread, and refreshes the list when returning from a thread so the badge clears", () => {
  assert.match(orgDashboardJs, /Number\(entry\.thread\?\.unread_count\) > 0/u);
  assert.match(orgDashboardJs, /function hideThreadDetailSection/u);
  const fn = orgDashboardJs.slice(
    orgDashboardJs.indexOf("function hideThreadDetailSection"),
    orgDashboardJs.indexOf("function hideThreadDetailSection") + 500
  );
  assert.match(fn, /refreshMessages\(\)/u);
});
