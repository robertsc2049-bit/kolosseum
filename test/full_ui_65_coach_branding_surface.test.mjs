// DEV NOTE: FULL-UI-65 coach branding preference static surface contract.
// The coach's own settings panel (save/load own preference) moved to React
// (AccountBrandingPanel.tsx + useAccountBranding.ts, mounted at
// #account-branding-root; coach_branding_ui.js is retired) - see
// public/app-src/__tests__/AccountBrandingPanel.test.tsx for its behavioral
// proof. The athlete-facing "My coach" card (coach_branding_athlete_view)
// is a separate, still-legacy feature fed via the relationship endpoint -
// its app.js rendering is still asserted directly below.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/coach_branding_service.ts");
const routes = read("src/api/coach_branding.routes.ts");
const serverTs = read("src/server.ts");
const lifecycle = read("shared/coach-branding/coachBrandingLifecycle.mjs");
const recordStore = read("src/api/beta_product_record_store.ts");
const schemaSql = read("schema.sql");
const relationshipService = read("src/api/relationship_invitation_service.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
const client = read("public/app-src/api/coachBrandingClient.ts");
const hook = read("public/app-src/screens/account/useAccountBranding.ts");
const panel = read("public/app-src/screens/account/AccountBrandingPanel.tsx");
// DEV NOTE: the athlete-facing "My coach" card also moved to React as part
// of the FULL-UI-25 relationship-panels slice (AccountCoachRelationshipPanel.
// tsx) - it's the same renderAthleteRelationships() this file's own DEV NOTE
// above once described as "a separate, still-legacy feature".
const relationshipPanel = read("public/app-src/screens/account/AccountCoachRelationshipPanel.tsx");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("coach branding is mounted at /coach-branding with a coach-only read/write route", () => {
  assert.match(serverTs, /app\.use\("\/coach-branding", coachBrandingRouter\)/u);
  assert.match(routes, /coachBrandingRouter\.post\(\s*\n?\s*"\/"/u);
  assert.match(routes, /coachBrandingRouter\.get\(\s*\n?\s*"\/"/u);
  assert.match(routes, /authenticatedCoach\(request, true\)/u);
  assert.match(routes, /authenticatedCoach\(request, false\)/u);
});

test("there is no athlete or other-coach write path - a brand preference is the coach's own declared choice", () => {
  assert.doesNotMatch(routes, /coachBrandingRouter\.(post|put|delete)\(\s*\n?\s*"\/coach|"\/athlete/u);
  assert.doesNotMatch(service, /export async function .*Athlete.*(save|update)/iu);
});

test("this record is additive to, and never mutates, beta17_coach_profile's own fixed field shape", () => {
  // beta17_coach_profile is created via a strict exact-key contract
  // (createBeta17CoachProfileRecord) used directly by dozens of test
  // fixtures across the suite - a brand preference is a separate,
  // superseded-on-save record type instead of a new field on that
  // record, so none of those fixtures had to change.
  assert.doesNotMatch(service, /beta17_coach_profile/u);
  assert.match(service, /"coach_brand_preference"/u);
});

test("a brand colour is a strict 6-digit hex value and a tagline is capped at 120 characters", () => {
  assert.match(lifecycle, /\^#\[0-9a-f\]\{6\}\$/u);
  assert.match(lifecycle, /MAX_TAGLINE_LENGTH = 120/u);
  assert.match(lifecycle, /exactKeys\(/u);
});

test("the lifecycle module makes no claim about qualifications, results or service quality", () => {
  assert.doesNotMatch(lifecycle, /qualif|result|guarantee|best|expert|certified/iu);
});

test("the coach_brand_preference record type is registered in the record store and schema check constraint", () => {
  assert.match(recordStore, /"coach_brand_preference"/u);
  assert.match(recordStore, /case "coach_brand_preference":/u);
  assert.match(schemaSql, /'coach_brand_preference'/u);
});

test("every stored brand-preference record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
  for (const field of [
    "factual_user_supplied_state: true",
    "immutable_reference_history: true",
    "inference_applied: false",
    "readiness_semantics: false",
    "safety_semantics: false",
    "suitability_semantics: false",
    "recommendation_semantics: false",
    "engine_visible: false",
    "compile_reference_visible: false"
  ]) {
    assert.ok(service.includes(field), `expected coach brand preference record to declare ${field}`);
  }
});

test("no coach-branding file imports any engine-truth service", () => {
  for (const source of [service, routes, lifecycle]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the coach-branding route file is tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/coach_branding\.routes\.ts", "\/coach-branding"\]/u);
});

test("an athlete reads their coach's brand preference through the existing relationship endpoint, not a new athlete-facing route", () => {
  assert.match(relationshipService, /"coach_brand_preference"/u);
  assert.match(relationshipService, /coach_brand_color:/u);
  assert.match(relationshipService, /coach_brand_tagline:/u);
});

test("the coach settings panel is a real control mounted in the account view, and the athlete-facing card escapes its tagline before rendering", () => {
  assert.match(indexHtml, /id="account-branding-root"/u);
  assert.doesNotMatch(indexHtml, /coach_branding_ui\.js/u);

  assert.match(client, /export function loadCoachBrandPreference/u);
  assert.match(client, /export function saveCoachBrandPreference/u);
  assert.match(hook, /const refreshBranding = useCallback/u);
  assert.match(hook, /const saveBranding = useCallback/u);
  assert.match(panel, /<input type="color"/u);
  assert.match(panel, /maxLength=\{120\}/u);

  // The athlete-facing "My coach" card is React now too
  // (AccountCoachRelationshipPanel.tsx) - it renders these as plain JSX
  // expressions, which escape by default, rather than calling escapeHtml.
  assert.match(relationshipPanel, /entry\.coach_brand_tagline \? <p className="muted small">\{String\(entry\.coach_brand_tagline\)\}<\/p> : null/u);
  assert.match(relationshipPanel, /entry\.coach_brand_color/u);
});

test("the coach settings panel is gated to coach accounts only, never shown unconditionally", () => {
  assert.match(panel, /if \(!isCoach\) return null;/u);
  // readRole()/useRole() were extracted to a shared utility once a fourth
  // #view-account panel needed the same role gate - see
  // public/app-src/utils/role.ts. useRole() also re-reads on a same-tab
  // sign-in/register (kolosseum:account-role-known, dispatched by
  // enterApplication() in app.js) in addition to the cross-tab "storage"
  // event, since a same-tab localStorage write never fires "storage" for
  // the tab that made it.
  const roleUtil = read("public/app-src/utils/role.ts");
  const appJsSource = read("public/app/app.js");
  assert.match(roleUtil, /export function readRole\(\)/u);
  assert.match(roleUtil, /export function useRole\(\)/u);
  assert.match(roleUtil, /window\.localStorage\.getItem\(STORAGE_KEY\)/u);
  assert.match(roleUtil, /"kolosseum:account-role-known"/u);
  assert.match(appJsSource, /document\.dispatchEvent\(new CustomEvent\("kolosseum:account-role-known"\)\);/u);
  assert.match(panel, /import \{ useRole \} from "\.\.\/\.\.\/utils\/role"/u);
});

test("the FULL-UI-65 manifest area declares all three functions as implemented with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "coach_branding");
  assert.ok(area, "expected a coach_branding product area");
  assert.equal(area.slice_id, "FULL-UI-65");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    ["coach_branding_athlete_view", "coach_branding_load_own", "coach_branding_save"]
  );

  const expectedDirectTest = {
    coach_branding_save: "public/app-src/__tests__/AccountBrandingPanel.test.tsx",
    coach_branding_load_own: "public/app-src/__tests__/AccountBrandingPanel.test.tsx",
    coach_branding_athlete_view: "test/full_ui_65_coach_branding_surface.test.mjs"
  };

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_65c_coach_branding_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, expectedDirectTest[fn.function_id]);
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-65" && slice.state === "implemented"));
});
