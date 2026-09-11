// DEV NOTE: FULL-UI-83 athlete activity-change static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/athlete_activity_change_service.ts");
const onboardingService = read("src/api/athlete_onboarding_service.ts");
const onboardingRoutes = read("src/api/athlete_onboarding.routes.ts");
const coachHandlers = read("src/api/coach_workspace.handlers.ts");
const coachRoutes = read("src/api/coach_workspace.routes.ts");
const recordStore = read("src/api/beta_product_record_store.ts");
const notificationService = read("src/api/product_notification_service.ts");
const writeService = read("src/api/session_state_write_service.ts");
const schema = read("schema.sql");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("athlete_activity_change_request is registered in both schema.sql CHECK-constraint migrations", () => {
  assert.match(schema, /beta_product_records_type_check[\s\S]*?'athlete_activity_change_request'/u);
});

test("activity_change_proposed and activity_change_applied are registered in the notifications CHECK-constraint migration", () => {
  assert.match(schema, /product_notifications_notification_type_check[\s\S]*?'activity_change_proposed'[\s\S]*?'activity_change_applied'/u);
});

test("athlete_activity_change_request is a supported record type in beta_product_record_store.ts", () => {
  assert.match(recordStore, /"athlete_activity_change_request"/u);
  assert.match(recordStore, /case "athlete_activity_change_request": \{/u);
});

test("the athlete self-service routes exist, session/mutation-gated the same way as the existing preferences route", () => {
  assert.match(onboardingRoutes, /athleteOnboardingRouter\.get\(\s*\n?\s*"\/activity-change"/u);
  assert.match(onboardingRoutes, /athleteOnboardingRouter\.patch\(\s*\n?\s*"\/activity"/u);
  assert.match(onboardingRoutes, /athleteOnboardingRouter\.post\(\s*\n?\s*"\/activity-proposal-response"/u);
  assert.match(onboardingRoutes, /athleteOnboardingRouter\.post\(\s*\n?\s*"\/activity-proposal-cancel"/u);
  assert.match(onboardingRoutes, /AthleteActivityChangeError/u);
});

test("the coach-proposal routes exist, gated by the same authenticatedCoach pattern as the strength-profile route", () => {
  assert.match(coachRoutes, /coachWorkspaceRouter\.get\(\s*\n?\s*"\/athlete-activity-change"/u);
  assert.match(coachRoutes, /coachWorkspaceRouter\.post\(\s*\n?\s*"\/athlete-activity-change-proposal"/u);
  assert.match(coachHandlers, /export async function proposeAthleteActivityChangeHandler/u);
  assert.match(coachHandlers, /const coachUserId = await authenticatedCoach\(req, true\);/u);
});

test("the coach proposal path calls requireCoachAthleteAccess before writing anything", () => {
  assert.match(service, /await requireCoachAthleteAccess\(coachUserId, athleteUserId\);/u);
});

test("the coach's own write is only ever a proposal - amendAthleteDeclaration is never called from the propose function", () => {
  const start = service.indexOf("export async function proposeAthleteActivityChangeForCoach");
  const end = service.indexOf("export async function respondToActivityChangeProposal");
  assert.ok(start >= 0 && end > start, "expected to find the propose function's own body");
  const proposeBody = service.slice(start, end);
  assert.doesNotMatch(proposeBody, /amendAthleteDeclaration/u, "a coach-authored write must never mutate the athlete's declaration directly");
  assert.match(proposeBody, /requestState: "proposed"/u);
});

test("only athlete-attributed code paths call amendAthleteDeclaration - self-service, confirm, and the deferred-apply hook", () => {
  const callSites = [...service.matchAll(/await amendAthleteDeclaration\(client,/gu)];
  assert.equal(callSites.length, 2, "expected exactly two call sites: applyOrQueue (self-service + confirm) and the deferred-apply hook");
});

test("amendAthleteDeclaration reuses the same declaration-amend mechanics as the existing preferences editor", () => {
  assert.match(onboardingService, /export async function amendAthleteDeclaration/u);
  assert.match(onboardingService, /await effectiveBetaDeclaration\(client, userId, declared, at\);/u);
  assert.match(onboardingService, /await append\(client, userId, DECLARATION_EVENT, \{ \.\.\.core, record_sha256: hash\(core\) \}, at\);/u);
});

test("a fresh top-level request supersedes any still-pending proposed or queued request for that athlete", () => {
  assert.match(service, /async function supersedeAnyPendingRequest/u);
  assert.match(service, /if \(state !== "queued" && state !== "proposed"\) return;/u);
});

test("the deferred-apply hook is wired inside session_state_write_service.ts's own terminal-status transaction", () => {
  const terminalBlock = writeService.indexOf('terminalStatus === "completed" || terminalStatus === "partial"');
  const hookCall = writeService.indexOf("applyQueuedActivityChangeIfDue(client, s.beta_subject_user_id, session_id)");
  const commitCall = writeService.indexOf('await client.query("COMMIT");', terminalBlock);
  assert.ok(terminalBlock >= 0 && hookCall > terminalBlock && hookCall < commitCall,
    "expected the deferred-apply hook between the terminal-status write and COMMIT");
  assert.match(writeService, /import \{ applyQueuedActivityChangeIfDue \} from "\.\/athlete_activity_change_service\.js";/u);
});

test("the deferred-apply hook is safe to call unconditionally - no-ops when nothing is queued for that session", () => {
  const start = service.indexOf("export async function applyQueuedActivityChangeIfDue");
  const body = service.slice(start, start + 1200);
  assert.match(body, /if \(!record\(queued\)\) return;/u);
});

test("notifications: activity_change_proposed and activity_change_applied are derived lazily, matching the existing relationship-notification pattern", () => {
  assert.match(notificationService, /"activity_change_proposed"/u);
  assert.match(notificationService, /"activity_change_applied"/u);
  assert.match(notificationService, /async function deriveActivityChangeNotifications/u);
  assert.match(notificationService, /await deriveActivityChangeNotifications\(client, recipientUserId\);/u);
  // Only a genuinely deferred change (queued_for_session_id set) gets an
  // "applied" courtesy notice - an immediate self-service change is
  // synchronous and already obvious to the athlete who just requested it.
  assert.match(notificationService, /queued_for_session_id' IS NOT NULL/u);
});

test("the FULL-UI-83 manifest functions are declared as implemented with real tests in the existing athlete_onboarding and relationships areas", () => {
  const athleteOnboardingArea = manifest.product_areas.find((entry) => entry.area_id === "athlete_onboarding");
  const relationshipsArea = manifest.product_areas.find((entry) => entry.area_id === "relationships");
  assert.ok(athleteOnboardingArea, "expected the existing athlete_onboarding product area");
  assert.ok(relationshipsArea, "expected the existing relationships product area");

  const athleteFn = athleteOnboardingArea.functions.find((entry) => entry.function_id === "athlete_activity_change");
  assert.ok(athleteFn, "expected an athlete_activity_change function");
  assert.equal(athleteFn.state, "implemented");
  assert.equal(athleteFn.direct_test, "test/full_ui_83_athlete_activity_change_surface.test.mjs");
  assert.equal(athleteFn.integration_test, "test/full_ui_83_athlete_activity_change_persistent.integration.test.mjs");
  assert.notEqual(athleteFn.persistence, "localStorage_only");
  assert.deepEqual(athleteFn.actors, ["athlete"]);

  const coachFn = relationshipsArea.functions.find((entry) => entry.function_id === "coach_activity_change_proposal");
  assert.ok(coachFn, "expected a coach_activity_change_proposal function");
  assert.equal(coachFn.state, "implemented");
  assert.equal(coachFn.direct_test, "test/full_ui_83_athlete_activity_change_surface.test.mjs");
  assert.equal(coachFn.integration_test, "test/full_ui_83_athlete_activity_change_persistent.integration.test.mjs");
  assert.notEqual(coachFn.persistence, "localStorage_only");
  assert.deepEqual(coachFn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-83" && slice.state === "implemented"));

  for (const route of [...athleteFn.api_routes, ...coachFn.api_routes]) {
    if (!route.startsWith("/coach-workspace")) continue;
    assert.ok(
      manifest.api_route_catalog.some((entry) => entry.path === route),
      `expected ${route} to be present in the manifest's api_route_catalog`
    );
  }
});

test("the athlete and coach frontend UIs are wired to the new endpoints", () => {
  const athleteHook = read("public/app-src/screens/athlete/useAthleteOnboarding.ts");
  const athletePanel = read("public/app-src/screens/athlete/AthleteOnboardingPanel.tsx");
  const coachHook = read("public/app-src/screens/coach/useAthleteRelationshipDetail.ts");
  const coachPanel = read("public/app-src/screens/coach/AthleteRelationshipDetailPanel.tsx");
  const athleteClient = read("public/app-src/api/athleteOnboardingClient.ts");
  const coachClient = read("public/app-src/api/coachWorkspaceClient.ts");

  assert.match(athleteClient, /\/account\/onboarding\/activity-change/u);
  assert.match(athleteClient, /\/account\/onboarding\/activity-proposal-response/u);
  assert.match(athleteHook, /changeActivity/u);
  assert.match(athleteHook, /respondToProposal/u);
  assert.match(athletePanel, /function ActivityChangeCard/u);

  assert.match(coachClient, /athlete-activity-change-proposal/u);
  assert.match(coachHook, /proposeActivityChange/u);
  assert.match(coachPanel, /function ActivityChangeSection/u);
});
