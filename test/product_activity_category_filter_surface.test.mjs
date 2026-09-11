// DEV NOTE: activity-category-filter static surface contract. This feature
// is a pure client-side filter over the existing V1_ACTIVITIES picker (no
// new API route, persistence or manifest capability - see the just-shipped
// click-to-open info-tooltips feature, commit 38387590, for the precedent
// of a purely-presentational change shipping with zero manifest footprint),
// so this test is deliberately not slice-numbered.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const component = read("public/app-src/components/ActivityCategoryFilter.tsx");
const entryAuthPanel = read("public/app-src/screens/entry/EntryAuthPanel.tsx");
const onboardingPanel = read("public/app-src/screens/athlete/AthleteOnboardingPanel.tsx");
const relationshipDetailPanel = read("public/app-src/screens/coach/AthleteRelationshipDetailPanel.tsx");
const connectAthletePanel = read("public/app-src/screens/coach/ConnectAthletePanel.tsx");

// eslint-disable-next-line import/no-unresolved
const registrySource = read("shared/v1-boundary/v1ActivityRegistry.mjs");

function extractActivityIds(source) {
  return [...source.matchAll(/activity_id:\s*"([a-z_]+)"/gu)].map((m) => m[1]);
}

const lockedActivityIds = [...new Set(extractActivityIds(registrySource))];

function extractCategoryGrouping(source) {
  const body = source.match(/CATEGORY_ACTIVITY_IDS[^={]*=\s*\{([\s\S]*?)\n\};/u);
  assert.ok(body, "expected to find the CATEGORY_ACTIVITY_IDS object literal");
  const grouping = {};
  for (const entryMatch of body[1].matchAll(/(\w+):\s*\[([^\]]*)\]/gu)) {
    const [, categoryId, itemsRaw] = entryMatch;
    grouping[categoryId] = [...itemsRaw.matchAll(/"([a-z_]+)"/gu)].map((m) => m[1]);
  }
  return grouping;
}

test("locked activity ids were extracted from the registry (sanity check on the extraction regex itself)", () => {
  assert.ok(lockedActivityIds.length >= 6, "expected at least the 6 known locked activities");
  for (const id of ["powerlifting", "general_strength", "rugby_union", "strongman", "hyrox", "crossfit"]) {
    assert.ok(lockedActivityIds.includes(id), `expected ${id} in the extracted locked activity list`);
  }
});

test("ActivityCategoryFilter.tsx exists and exports the shared component, category list and grouping map", () => {
  assert.match(component, /export function ActivityCategoryFilter\(/u);
  assert.match(component, /export const CATEGORIES\s*=/u);
  assert.match(component, /export const CATEGORY_ACTIVITY_IDS/u);
  assert.match(component, /export function sportOptionsForCategory\(/u);
});

test("the component is a pure filter - it never persists or submits the category itself, only the resolved activity_id via onChange", () => {
  assert.doesNotMatch(component, /fetch\(/u);
  assert.doesNotMatch(component, /localStorage/u);
  assert.match(component, /onChange\(/u);
});

test("every category grouping is non-empty and their union covers every locked activity exactly once", () => {
  const grouping = extractCategoryGrouping(component);
  const categoryIds = Object.keys(grouping);
  assert.ok(categoryIds.length >= 6, "expected at least 6 categories");

  const seen = new Set();
  for (const categoryId of categoryIds) {
    const ids = grouping[categoryId];
    assert.ok(ids.length > 0, `${categoryId} must map to at least one activity`);
    for (const id of ids) {
      assert.ok(lockedActivityIds.includes(id), `${categoryId} references unknown activity id ${id}`);
      seen.add(id);
    }
  }

  assert.deepEqual([...seen].sort(), [...lockedActivityIds].sort());
});

test("all 4 confirmed athlete-activity-declaration screens import and use the shared ActivityCategoryFilter component", () => {
  for (const [name, source] of [
    ["EntryAuthPanel.tsx", entryAuthPanel],
    ["AthleteOnboardingPanel.tsx", onboardingPanel],
    ["AthleteRelationshipDetailPanel.tsx", relationshipDetailPanel],
    ["ConnectAthletePanel.tsx", connectAthletePanel]
  ]) {
    assert.match(
      source,
      /import \{ ActivityCategoryFilter \} from "\.\.\/\.\.\/components\/ActivityCategoryFilter";/u,
      `expected ${name} to import the shared ActivityCategoryFilter component`
    );
    assert.doesNotMatch(
      source,
      /import \{ V1_ACTIVITIES \} from/u,
      `expected ${name} to no longer import V1_ACTIVITIES directly - it should go through ActivityCategoryFilter`
    );
    assert.match(
      source,
      /<ActivityCategoryFilter\b/u,
      `expected ${name} to render <ActivityCategoryFilter`
    );
  }
});

test("AthleteOnboardingPanel.tsx renders the filter twice - the onboarding wizard's activity stage, and the self-service change-activity card", () => {
  const usages = [...onboardingPanel.matchAll(/<ActivityCategoryFilter\b/gu)];
  assert.equal(usages.length, 2, "expected exactly 2 ActivityCategoryFilter usages in AthleteOnboardingPanel.tsx");
  assert.match(onboardingPanel, /sportLabel="Activity"/u);
  assert.match(onboardingPanel, /sportLabel="New activity"/u);
  assert.match(onboardingPanel, /allowEmptySport/u);
});

test("out-of-scope activity pickers (event creation/detail, marketplace/library filters, programme-builder identity) still import V1_ACTIVITIES directly - proving they were correctly left untouched", () => {
  for (const file of [
    "public/app-src/screens/coach/CoachEventCreatePanel.tsx",
    "public/app-src/screens/coach/CoachEventDetailPanel.tsx",
    "public/app-src/screens/coach/CoachMarketplacePanel.tsx",
    "public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx",
    "public/app-src/screens/coach/CoachProgrammeIdentityFields.tsx"
  ]) {
    const source = read(file);
    assert.match(source, /import \{ V1_ACTIVITIES \} from/u, `expected ${file} to still import V1_ACTIVITIES directly (out of scope for this feature)`);
    assert.doesNotMatch(source, /ActivityCategoryFilter/u, `expected ${file} to not reference ActivityCategoryFilter (out of scope for this feature)`);
  }
});

test("no schema, API route or manifest change was introduced by this feature", () => {
  const schema = read("schema.sql");
  const manifest = read("product/ui/function_manifest.json");
  assert.doesNotMatch(schema, /activity_category/u);
  assert.doesNotMatch(manifest, /activity_category/u);
});
