import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const V0_ALLOWED_ACTIVITIES = Object.freeze(["powerlifting", "rugby_union", "general_strength"]);
const V0_ALLOWED_EXECUTION_SCOPES = Object.freeze(["individual", "coach_managed"]);
const V0_ALLOWED_ACTOR_TYPES = Object.freeze(["individual_user", "coach"]);

// The activity and program registries (and the compact bundle projecting them)
// are shared with v1's registry governance system, which legitimately grows
// them past v0's own closed declaration surface. v0's own engine only ever
// declares/processes V0_ALLOWED_ACTIVITIES above; this wider set exists only
// to describe what those two shared registry files may now legally contain.
const V0_SHARED_REGISTRY_ACTIVITY_IDS = Object.freeze([...V0_ALLOWED_ACTIVITIES, "strongman"]);

const S_V0_07_REJECTED_ACTIVITY_FIXTURES = Object.freeze([
  {
    fixture_label: "S-V0-07 rejected value: strongman remains outside the v0 declaration surface even though it is now a v1-only registry activity",
    activity_id: "strongman"
  },
  {
    fixture_label: "S-V0-07 rejected value: bodybuilding remains post-v0 and must not enter active v0",
    activity_id: "bodybuilding"
  },
  {
    fixture_label: "S-V0-07 rejected value: combat_sports remains post-v0 and must not enter active v0",
    activity_id: "combat_sports"
  },
  {
    fixture_label: "S-V0-07 rejected value: tactical remains post-v0 and must not enter active v0",
    activity_id: "tactical"
  },
  {
    fixture_label: "S-V0-07 rejected value: weightlifting remains unsupported in active v0",
    activity_id: "weightlifting"
  },
  {
    fixture_label: "S-V0-07 rejected value: football_soccer remains unsupported in active v0",
    activity_id: "football_soccer"
  }
]);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function sorted(value) {
  return [...value].sort();
}

function assertExactSet(actual, expected, message) {
  assert.deepEqual(sorted(actual), sorted(expected), message);
}

function objectValuesWithId(obj, idKeys) {
  return Object.values(obj)
    .filter((entry) => entry && typeof entry === "object")
    .filter((entry) => idKeys.some((key) => typeof entry[key] === "string"));
}

function collectActivityIds(registry) {
  if (Array.isArray(registry.entries)) {
    return registry.entries.map((entry) => entry.activity_id ?? entry.id).filter(Boolean);
  }

  if (registry.entries && typeof registry.entries === "object") {
    return Object.entries(registry.entries).map(([key, entry]) => entry.activity_id ?? entry.id ?? key);
  }

  if (Array.isArray(registry.activities)) {
    return registry.activities.map((entry) => entry.activity_id ?? entry.id).filter(Boolean);
  }

  if (registry.activities && typeof registry.activities === "object") {
    return Object.entries(registry.activities).map(([key, entry]) => entry.activity_id ?? entry.id ?? key);
  }

  return objectValuesWithId(registry, ["activity_id", "id"]).map((entry) => entry.activity_id ?? entry.id);
}

function collectProgramIds(registry) {
  if (Array.isArray(registry.programs)) {
    return registry.programs.map((entry) => entry.id ?? entry.activity_id).filter(Boolean);
  }

  if (Array.isArray(registry.entries)) {
    return registry.entries.map((entry) => entry.id ?? entry.activity_id).filter(Boolean);
  }

  if (registry.entries && typeof registry.entries === "object") {
    return Object.entries(registry.entries).map(([key, entry]) => entry.id ?? entry.activity_id ?? key);
  }

  if (registry.programs && typeof registry.programs === "object") {
    return Object.entries(registry.programs).map(([key, entry]) => entry.id ?? entry.activity_id ?? key);
  }

  return objectValuesWithId(registry, ["id", "activity_id"]).map((entry) => entry.id ?? entry.activity_id);
}

function findBundleDomain(bundle, domainName) {
  return bundle[domainName] ?? bundle.registries?.[domainName] ?? bundle.domains?.[domainName] ?? null;
}

function tokenForActivity(activityId) {
  return V0_ALLOWED_ACTIVITIES.includes(activityId)
    ? "V0_ACTIVITY_ALLOWED"
    : "V0_UNKNOWN_SCOPE_VALUE";
}

// DEV NOTE: S-V0-07 enumeration/activity boundary.
// Purpose: this test locks the active v0 activity set across the manifest,
// Phase 1 schema, registry domain files, and registry bundle. Failure means
// an unsupported activity reached an active v0 authority surface and must be
// removed or explicitly handled as a rejected value.
// Amendment: strongman was activated as v1's fourth locked activity (see
// docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md) inside the same
// activity/program registries v0 also reads for its own boundary proof. v0's
// own declaration surface (manifest allowed_activities, Phase 1 schema enum,
// rejected-value fixtures) stays locked at exactly the original three - v0's
// closed engine never processes strongman - so only the registry/bundle
// content checks widen to V0_SHARED_REGISTRY_ACTIVITY_IDS.
test("S-V0-07 locks active v0 actor, execution-scope, and activity enumerations", () => {
  const manifest = readJson("docs/v0/V0_ACTIVE_SCOPE_MANIFEST.json");
  const phase1Schema = readJson("docs/v0/phase1_declaration_surface.schema.json");

  assertExactSet(
    manifest.allowed_actor_types,
    V0_ALLOWED_ACTOR_TYPES,
    "active v0 actor types must remain individual_user and coach only"
  );

  assertExactSet(
    manifest.allowed_execution_scopes,
    V0_ALLOWED_EXECUTION_SCOPES,
    "active v0 execution scopes must remain individual and coach_managed only"
  );

  assertExactSet(
    manifest.allowed_activities,
    V0_ALLOWED_ACTIVITIES,
    "active v0 activities must remain powerlifting, rugby_union, and general_strength only"
  );

  assertExactSet(
    phase1Schema.properties.actor_type.enum,
    V0_ALLOWED_ACTOR_TYPES,
    "Phase 1 schema actor_type enum must match active v0 manifest"
  );

  assertExactSet(
    phase1Schema.properties.execution_scope.enum,
    V0_ALLOWED_EXECUTION_SCOPES,
    "Phase 1 schema execution_scope enum must match active v0 manifest"
  );

  assertExactSet(
    phase1Schema.properties.activity_id.enum,
    V0_ALLOWED_ACTIVITIES,
    "Phase 1 schema activity_id enum must match active v0 manifest"
  );
});

test("S-V0-07 rejects non-v0 activities predictably without widening the allowed set", () => {
  for (const fixture of S_V0_07_REJECTED_ACTIVITY_FIXTURES) {
    assert.equal(
      tokenForActivity(fixture.activity_id),
      "V0_UNKNOWN_SCOPE_VALUE",
      fixture.fixture_label
    );
  }

  for (const activityId of V0_ALLOWED_ACTIVITIES) {
    assert.equal(
      tokenForActivity(activityId),
      "V0_ACTIVITY_ALLOWED",
      `S-V0-07 allowed value remains stable: ${activityId}`
    );
  }
});

test("S-V0-07 keeps activity registry and program registry inside the shared v0/v1 registry activity boundary", () => {
  const activityRegistry = readJson("registries/activity/activity.registry.json");
  const programRegistry = readJson("registries/program/program.registry.json");

  assertExactSet(
    collectActivityIds(activityRegistry),
    V0_SHARED_REGISTRY_ACTIVITY_IDS,
    "activity registry activity ids must not exceed the shared v0/v1 registry activity boundary"
  );

  assertExactSet(
    collectProgramIds(programRegistry),
    V0_SHARED_REGISTRY_ACTIVITY_IDS,
    "program registry activity ids must not exceed the shared v0/v1 registry activity boundary"
  );
});

test("S-V0-07 keeps registry bundle activity and program domains inside the shared v0/v1 registry boundary", () => {
  const bundle = readJson("registries/registry_bundle.json");

  const activityDomain = findBundleDomain(bundle, "activity");
  assert.ok(activityDomain, "registry bundle must include activity domain");

  assertExactSet(
    collectActivityIds(activityDomain),
    V0_SHARED_REGISTRY_ACTIVITY_IDS,
    "registry bundle activity domain must not exceed the shared v0/v1 registry activity boundary"
  );

  const programDomain = findBundleDomain(bundle, "program");
  assert.ok(programDomain, "registry bundle must include program domain");

  assertExactSet(
    collectProgramIds(programDomain),
    V0_SHARED_REGISTRY_ACTIVITY_IDS,
    "registry bundle program domain must not exceed the shared v0/v1 registry activity boundary"
  );
});
