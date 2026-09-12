// DEV NOTE: FULL-UI-85 team sport + athlete position static surface
// contract - the final slice of the sport-declaration redesign.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const schema = read("schema.sql");
const orgRosterService = read("src/api/org_roster_service.ts");
const onboardingService = read("src/api/athlete_onboarding_service.ts");
const activityChangeService = read("src/api/athlete_activity_change_service.ts");
const coachTeamOverrideService = read("src/api/coach_team_position_override_service.ts");
const orgOwnerOverrideService = read("src/api/org_owner_position_override_service.ts");
const orgVisibilityService = read("src/api/org_visibility_service.ts");
const beta19Service = read("src/api/beta19_coach_workspace_service.ts");
const coachWorkspaceRoutes = read("src/api/coach_workspace.routes.ts");
const coachWorkspaceHandlers = read("src/api/coach_workspace.handlers.ts");
const coachOrgMembershipRoutes = read("src/api/coach_org_membership.routes.ts");
const orgOwnerRoutes = read("src/api/org_owner.routes.ts");
const athleteOnboardingRoutes = read("src/api/athlete_onboarding.routes.ts");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("product_organisations.activity_id is a nullable, CHECK-constrained column, both inline and in the idempotent migration block", () => {
  const lockedActivityListOccurrences = [
    ...schema.matchAll(/'powerlifting', 'general_strength', 'rugby_union',\s*\n\s*'strongman', 'hyrox', 'crossfit'/gu)
  ];
  assert.ok(
    lockedActivityListOccurrences.length >= 2,
    "expected the inline column definition and the migration block to both carry the same locked-activity CHECK list"
  );
  assert.match(schema, /activity_id\s+TEXT\s*\n\s*CHECK \(\s*\n\s*activity_id IS NULL OR activity_id IN/u);
  assert.match(schema, /ALTER TABLE product_organisations ADD COLUMN activity_id TEXT;/u);
  assert.match(schema, /ADD CONSTRAINT product_organisations_activity_id_check/u);
});

test("athlete_position_overridden is registered in the product_org_audit_records action_type CHECK, both inline and in the migration block", () => {
  const matches = [...schema.matchAll(/action_type[\s\S]{0,260}'athlete_position_overridden'/gu)];
  assert.ok(matches.length >= 2, "expected the inline table definition and the migration block to both carry the new action_type");
});

test("org creation requires activity_id, validated the same way org_name is (required, then a supported-set check)", () => {
  assert.match(orgRosterService, /function cleanRequiredActivityId/u);
  assert.match(orgRosterService, /org_roster_activity_required/u);
  assert.match(orgRosterService, /org_roster_activity_invalid/u);
  assert.match(orgRosterService, /V1_ACTIVITY_IDS\.includes\(activityId\)/u);
  assert.match(
    orgRosterService,
    /export async function createOrganisation\(\s*\n\s*ownerUserId: string,\s*\n\s*orgName: unknown,\s*\n\s*activityIdInput: unknown,\s*\n\s*visibilityModeInput\?: unknown/u
  );
});

test("writeAuditRecord is exported for reuse by the two new position-override services", () => {
  assert.match(orgRosterService, /export async function writeAuditRecord/u);
  assert.match(coachTeamOverrideService, /import \{[\s\S]*?writeAuditRecord[\s\S]*?\} from "\.\/org_roster_service\.js";/u);
  assert.match(orgOwnerOverrideService, /import \{[\s\S]*?writeAuditRecord[\s\S]*?\} from "\.\/org_roster_service\.js";/u);
});

test("every one of the 6 locked activities has a position list - rugby_union real positions, the other 5 a single generic Athlete option", () => {
  assert.match(onboardingService, /export const ATHLETE_POSITIONS_BY_ACTIVITY/u);
  for (const activityId of ["powerlifting", "general_strength", "rugby_union", "strongman", "hyrox", "crossfit"]) {
    assert.match(onboardingService, new RegExp(`${activityId}:\\s*Object\\.freeze\\(\\[`, "u"), activityId);
  }
  assert.match(onboardingService, /rugby_union: Object\.freeze\(\[\s*\n\s*"prop", "hooker"/u);
  assert.match(onboardingService, /powerlifting: Object\.freeze\(\["athlete"\]\)/u);
});

test("position is validated structurally by validateAthletePosition and semantically cross-checked by assertPositionMatchesActivity", () => {
  assert.match(onboardingService, /export function validateAthletePosition/u);
  assert.match(onboardingService, /export function assertPositionMatchesActivity/u);
  assert.match(onboardingService, /addOptional\("position", validateAthletePosition\);/u);
  assert.match(onboardingService, /"position"[\s\S]{0,40}\]\);/u);
});

test("confirmAthleteOnboarding cross-checks position against activity before writing the declaration", () => {
  const start = onboardingService.indexOf("export async function confirmAthleteOnboarding");
  const end = onboardingService.indexOf("export async function updateAthleteOnboardingPreferences");
  const body = onboardingService.slice(start, end);
  assert.match(body, /assertPositionMatchesActivity\(declared\.position, declared\.activity_id\);/u);
});

test("updateAthleteOnboardingPreferences treats position the same optional-on-this-endpoint way as training_focus", () => {
  const start = onboardingService.indexOf("export async function updateAthleteOnboardingPreferences");
  const end = onboardingService.indexOf("export async function amendAthleteDeclaration");
  const body = onboardingService.slice(start, end);
  assert.match(body, /positionProvided/u);
  assert.match(body, /assertPositionMatchesActivity\(position, previous\.activity_id\);/u);
  assert.match(body, /key !== "position"/u);
});

test("amendAthleteDeclaration drops an incompatible position on activity change and skips the beta16 write for a pure position change", () => {
  const start = onboardingService.indexOf("export async function amendAthleteDeclaration");
  const end = onboardingService.indexOf("export async function getAthleteDeclaredActivityAndPosition");
  const body = onboardingService.slice(start, end);
  assert.match(body, /"position" \| "activity_id" \| "instruction_density" \| "accessibility_preferences"|activity_id" \| "instruction_density" \| "accessibility_preferences" \| "position"/u);
  assert.match(body, /positionCompatible/u);
  assert.match(body, /position: undefined/u);
  assert.match(body, /if \(changes\.activity_id !== undefined \|\| changes\.instruction_density !== undefined\) \{/u);
});

test("getAthleteDeclaredActivityAndPosition is exported for coach/org-roster views to read a field never projected into the phase1/engine record", () => {
  assert.match(onboardingService, /export async function getAthleteDeclaredActivityAndPosition/u);
  assert.match(beta19Service, /getAthleteDeclaredActivityAndPosition/u);
  assert.match(orgVisibilityService, /getAthleteDeclaredActivityAndPosition/u);
});

test("the activity-change state machine is generalized with a change_kind discriminator, defaulting pre-migration rows to 'activity'", () => {
  assert.match(activityChangeService, /change_kind: "activity" \| "position"/u);
  assert.match(activityChangeService, /COALESCE\(record_payload->>'change_kind', 'activity'\)/u);
  assert.match(activityChangeService, /export async function proposeAthletePositionChangeForCoach/u);
  assert.match(activityChangeService, /export async function getAthletePositionChangeState/u);
});

test("a coach-proposed position change validates against the athlete's current activity before writing a proposal", () => {
  const start = activityChangeService.indexOf("export async function proposeAthletePositionChangeForCoach");
  const end = activityChangeService.length;
  const body = activityChangeService.slice(start, end);
  assert.match(body, /await requireCoachAthleteAccess\(coachUserId, athleteUserId\);/u);
  assert.match(body, /assertPositionMatchesActivity\(newPosition, declared\.activity_id \?\? undefined\);/u);
});

test("the coach-team and org-owner override services never let the coach's/owner's own write skip the shared-visibility + roster-membership checks", () => {
  assert.match(coachTeamOverrideService, /requireSharedOrg/u);
  assert.match(coachTeamOverrideService, /activeCoachIdsForOrg\(cleanOrgId\)/u);
  assert.match(coachTeamOverrideService, /resolveOrgActiveCoachAcceptedAthletes\(cleanOrgId\)/u);
  assert.match(coachTeamOverrideService, /coach_team_position_override_athlete_not_on_roster/u);

  assert.match(orgOwnerOverrideService, /requireOwnedSharedOrg/u);
  assert.match(orgOwnerOverrideService, /row\.owner_user_id !== ownerUserId/u);
  assert.match(orgOwnerOverrideService, /resolveOrgActiveCoachAcceptedAthletes\(cleanOrgId\)/u);
  assert.match(orgOwnerOverrideService, /org_owner_position_override_athlete_not_on_roster/u);
});

test("both override tiers write straight through amendAthleteDeclaration - no propose/confirm state machine involved", () => {
  assert.match(coachTeamOverrideService, /await amendAthleteDeclaration\(\s*\n\s*client, athleteUserId, \{ position: newPosition \}, "coach_team_position_override"/u);
  assert.match(orgOwnerOverrideService, /await amendAthleteDeclaration\(\s*\n\s*client, athleteUserId, \{ position: newPosition \}, "org_owner_position_override"/u);
});

test("both override tiers write an athlete_position_overridden audit record with the correct actor_role", () => {
  assert.match(coachTeamOverrideService, /actionType: "athlete_position_overridden"/u);
  assert.match(coachTeamOverrideService, /actorRole: "coach"/u);
  assert.match(orgOwnerOverrideService, /actionType: "athlete_position_overridden"/u);
  assert.match(orgOwnerOverrideService, /actorRole: "org_owner"/u);
});

test("the new coach-workspace routes are mounted and rate-limited the same way as the existing activity-change routes", () => {
  assert.match(coachWorkspaceRoutes, /coachWorkspaceRouter\.get\(\s*\n?\s*"\/athlete-position-change",\s*\n?\s*athleteActivityChangeRateLimit/u);
  assert.match(coachWorkspaceRoutes, /coachWorkspaceRouter\.post\(\s*\n?\s*"\/athlete-position-change-proposal",\s*\n?\s*athleteActivityChangeRateLimit/u);
  assert.match(coachWorkspaceHandlers, /export async function proposeAthletePositionChangeHandler/u);
});

test("the team-roster and team-position-override routes exist on the coach org-membership router, rate-limited", () => {
  assert.match(coachOrgMembershipRoutes, /coachOrgMembershipRouter\.get\(\s*\n?\s*"\/organisations\/:org_id\/athlete-roster",\s*\n?\s*teamPositionOverrideRateLimit/u);
  assert.match(coachOrgMembershipRoutes, /coachOrgMembershipRouter\.post\(\s*\n?\s*"\/organisations\/:org_id\/team-athletes\/:athlete_user_id\/position-override",\s*\n?\s*teamPositionOverrideRateLimit/u);
  assert.match(coachOrgMembershipRoutes, /error instanceof CoachTeamPositionOverrideError/u);
});

test("the org-owner position-override route exists, mutation-gated and rate-limited", () => {
  assert.match(orgOwnerRoutes, /orgOwnerRouter\.post\(\s*\n?\s*"\/organisations\/:org_id\/athletes\/:athlete_user_id\/position-override",\s*\n?\s*orgOwnerPositionOverrideRateLimit/u);
  assert.match(orgOwnerRoutes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);/u);
  assert.match(orgOwnerRoutes, /error instanceof OrgOwnerPositionOverrideError/u);
});

test("the athlete's own GET /activity-change route returns both activity_change and position_change", () => {
  assert.match(athleteOnboardingRoutes, /activity_change: activityChange, position_change: positionChange/u);
});

test("the FULL-UI-85 manifest functions are declared as implemented with real tests", () => {
  const onboardingArea = manifest.product_areas.find((entry) => entry.area_id === "athlete_onboarding");
  const relationshipsArea = manifest.product_areas.find((entry) => entry.area_id === "relationships");
  const orgArea = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");

  const athletePosition = onboardingArea.functions.find((entry) => entry.function_id === "athlete_position_change");
  assert.ok(athletePosition, "expected an athlete_position_change function");
  assert.equal(athletePosition.state, "implemented");
  assert.deepEqual(athletePosition.actors, ["athlete"]);

  const coachProposal = relationshipsArea.functions.find((entry) => entry.function_id === "coach_position_change_proposal");
  assert.ok(coachProposal, "expected a coach_position_change_proposal function");
  assert.equal(coachProposal.state, "implemented");
  assert.deepEqual(coachProposal.actors, ["coach"]);

  const teamOverride = orgArea.functions.find((entry) => entry.function_id === "coach_team_position_override");
  assert.ok(teamOverride, "expected a coach_team_position_override function");
  assert.deepEqual(teamOverride.actors, ["coach"]);

  const ownerOverride = orgArea.functions.find((entry) => entry.function_id === "org_owner_position_override");
  assert.ok(ownerOverride, "expected an org_owner_position_override function");
  assert.deepEqual(ownerOverride.actors, ["org_owner"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-85" && slice.state === "implemented"));

  for (const fn of [athletePosition, coachProposal, teamOverride, ownerOverride]) {
    for (const route of fn.api_routes) {
      if (!route.startsWith("/coach-workspace") || route.includes(":org_id")) continue;
      assert.ok(
        manifest.api_route_catalog.some((entry) => entry.path === route),
        `expected ${route} to be present in the manifest's api_route_catalog`
      );
    }
  }
});

test("the athlete, coach 1:1, coach team-roster and org-owner frontend surfaces are all wired to the new position endpoints", () => {
  const athletePanel = read("public/app-src/screens/athlete/AthleteOnboardingPanel.tsx");
  const athleteHook = read("public/app-src/screens/athlete/useAthleteOnboarding.ts");
  const coachPanel = read("public/app-src/screens/coach/AthleteRelationshipDetailPanel.tsx");
  const coachHook = read("public/app-src/screens/coach/useAthleteRelationshipDetail.ts");
  const coachClient = read("public/app-src/api/coachWorkspaceClient.ts");
  const teamRosterPanel = read("public/app-src/screens/account/TeamRosterPanel.tsx");
  const teamRosterHook = read("public/app-src/screens/account/useTeamRoster.ts");
  const mainTsx = read("public/app-src/main.tsx");
  const orgJs = read("public/org/org.js");
  const positionSelect = read("public/app-src/components/PositionSelect.tsx");

  assert.match(positionSelect, /export const POSITION_OPTIONS_BY_ACTIVITY/u);
  assert.match(athletePanel, /function PositionChangeCard/u);
  assert.match(athletePanel, /PositionSelect/u);
  assert.match(athleteHook, /positionChange/u);

  assert.match(coachPanel, /function PositionChangeSection/u);
  assert.match(coachHook, /proposePositionChange/u);
  assert.match(coachClient, /athlete-position-change-proposal/u);

  assert.match(teamRosterPanel, /overridePosition/u);
  assert.match(teamRosterHook, /loadTeamAthleteRoster|overrideTeamAthletePosition/u);
  assert.match(mainTsx, /<TeamRosterPanel \/>/u);

  assert.match(orgJs, /position-override/u);
  assert.match(orgJs, /POSITION_OPTIONS_BY_ACTIVITY/u);
});
