// DEV NOTE: FULL-UI-94 org-owner athlete roster CSV export static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const coachHandlers = read("src/api/coach_workspace.handlers.ts");
const visibilityService = read("src/api/org_visibility_service.ts");
const orgOwnerRoutes = read("src/api/org_owner.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("csvEscapeField is exported from coach_workspace.handlers.ts for reuse, not duplicated", () => {
  assert.match(coachHandlers, /export function csvEscapeField\(/u);
  assert.match(visibilityService, /import \{ csvEscapeField \} from "\.\/coach_workspace\.handlers\.js";/u);
});

test("buildOrgAthleteRosterCsv is its own standalone function that reuses getOrgAthleteVisibility's own output, never a new data read", () => {
  assert.match(visibilityService, /export function buildOrgAthleteRosterCsv\(/u);
  const fn = visibilityService.slice(visibilityService.indexOf("export function buildOrgAthleteRosterCsv"));
  assert.match(fn, /visibility\.visibility_mode === "individual"/u);
});

test("an individual-mode ('gym') org's CSV never carries an athlete-identifying column - only aggregate per-coach counts, matching the gym-mode identity-hiding invariant", () => {
  const individualBranch = visibilityService.slice(
    visibilityService.indexOf("visibility.visibility_mode === \"individual\""),
    visibilityService.lastIndexOf("const header = [\"coach_user_id\", \"coach_display_name\", \"athlete_user_id\"")
  );
  assert.match(individualBranch, /"coach_user_id", "coach_display_name", "membership_status", "active_athlete_count", "invited_athlete_count"/u);
  assert.doesNotMatch(individualBranch, /athlete_user_id|"display_name"|"email"/u);
});

test("a shared-mode ('team') org's CSV lists one row per athlete with real identity, matching fullRosterForOrg's own JSON shape", () => {
  const fn = visibilityService.slice(visibilityService.indexOf("export function buildOrgAthleteRosterCsv"));
  assert.match(fn, /"coach_user_id", "coach_display_name", "athlete_user_id", "display_name", "email", "relationship_state", "activity_id", "position"/u);
  assert.match(fn, /coach\.athletes\.map\(/u);
});

test("the CSV export route is rate-limited (CodeQL's js/missing-rate-limiting flags newly-added authorising routes), resolves identity from authenticatedOrgOwner only, reuses getOrgAthleteVisibility + listOrganisationRoster, and sets the correct download headers", () => {
  const fn = orgOwnerRoutes.slice(
    orgOwnerRoutes.indexOf("const orgOwnerRosterCsvExportRateLimit"),
    orgOwnerRoutes.indexOf("// Progress graphs slices 4 & 5")
  );
  assert.match(fn, /orgOwnerRosterCsvExportRateLimit = rateLimit\(/u);
  assert.match(fn, /orgOwnerRosterCsvExportRateLimit,\s*\n\s*asyncHandler/u);
  assert.match(fn, /authenticatedOrgOwner\(request, false\)/u);
  assert.doesNotMatch(fn, /request\.body\.user_id|request\.query\.user_id/u);
  assert.match(fn, /getOrgAthleteVisibility\(user_id, orgId\)/u);
  assert.match(fn, /listOrganisationRoster\(user_id, orgId\)/u);
  assert.match(fn, /buildOrgAthleteRosterCsv\(/u);
  assert.match(fn, /Content-Type", "text\/csv; charset=utf-8"/u);
  assert.match(fn, /Content-Disposition", 'attachment; filename="kolosseum-org-roster\.csv"'/u);
});

test("the export route is a sibling of the existing athlete-visibility JSON route, not nested under a param that could swallow it", () => {
  assert.match(orgOwnerRoutes, /"\/organisations\/:org_id\/athlete-visibility\/export\.csv"/u);
  assert.match(orgOwnerRoutes, /"\/organisations\/:org_id\/athlete-visibility"/u);
});

test("the export link is a plain <a href> in the visibility-section header, always rendered regardless of visibility_mode - matching the org console's own 'server decides what comes back' precedent", () => {
  assert.match(indexHtml, /<a id="orgVisibilityRosterExportLink" class="button secondary" href="#">Export roster \(\.csv\)<\/a>/u);
  assert.match(orgJs, /el\("orgVisibilityRosterExportLink"\)\.href = `\/org\/organisations\/\$\{encodeURIComponent\(orgId\)\}\/athlete-visibility\/export\.csv`;/u);
});

test("the FULL-UI-94 manifest function is declared as implemented in the organisation_billing area, alongside its JSON sibling, with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  const sibling = area.functions.find((entry) => entry.function_id === "org_owner_athlete_visibility");
  assert.ok(sibling, "expected the existing org_owner_athlete_visibility function to still be present");

  const fn = area.functions.find((entry) => entry.function_id === "org_owner_athlete_roster_csv_export");
  assert.ok(fn, "expected an org_owner_athlete_roster_csv_export function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_94_org_owner_athlete_roster_csv_export_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_94c_org_owner_athlete_roster_csv_export_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["org_owner"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-94" && slice.state === "implemented"));
});
