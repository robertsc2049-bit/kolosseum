// DEV NOTE: proof for the rugby_union position-narrowing logic wired into
// buildV1SubstitutionInput (session_substitution_registry.ts). Splits into
// two layers: direct unit tests of the pure matching/exclusion helpers
// against synthetic data (independent of what the live registries happen to
// contain today), and integration-style tests of buildV1SubstitutionInput
// itself against the real registries, proving backward compatibility and
// the "never empty the offered set" safety rule.
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildV1SubstitutionInput,
  isExcludedForPosition,
  positionExclusionEntry
} from "../dist/src/api/session_substitution_registry.js";
import { RUGBY_UNION_POSITION_SUBSTITUTION_PROFILE } from "../dist/src/api/rugby_union_position_substitution_profile.js";

// ============================================================
// Layer 1: pure helper unit tests against synthetic data.
// ============================================================

test("positionExclusionEntry resolves a known activity/position pair and returns null for anything else", () => {
  const entry = positionExclusionEntry("rugby_union", "wing");
  assert.ok(entry, "expected a profile entry for rugby_union wing");
  assert.equal(entry.activity_id, "rugby_union");
  assert.equal(entry.position, "wing");

  assert.equal(positionExclusionEntry("rugby_union", null), null);
  assert.equal(positionExclusionEntry("rugby_union", undefined), null);
  assert.equal(positionExclusionEntry("rugby_union", ""), null);
  // Unknown/legacy position (e.g. the retired bare "prop") - no matching
  // profile key, safe no-op rather than an error.
  assert.equal(positionExclusionEntry("rugby_union", "prop"), null);
  // Every current activity/position combo has a real entry except the ones
  // deliberately left with no exclusions (e.g. centre) - those still
  // resolve to a real (empty-exclusion) entry, not null.
  assert.equal(positionExclusionEntry("powerlifting", "athlete"), null);
});

test("isExcludedForPosition matches by movement pattern and by explicit exercise id, and is a safe no-op with no entry", () => {
  const exercises = {
    farmers_carry: { movement_pattern_id: "carry_bilateral" },
    back_squat: { movement_pattern_id: "squat" }
  };

  assert.equal(isExcludedForPosition("farmers_carry", null, exercises), false);

  const wingEntry = positionExclusionEntry("rugby_union", "wing");
  assert.equal(isExcludedForPosition("farmers_carry", wingEntry, exercises), true);
  assert.equal(isExcludedForPosition("back_squat", wingEntry, exercises), false);
  // Unknown exercise id (no movement_pattern_id resolvable) never throws,
  // never matches.
  assert.equal(isExcludedForPosition("not_a_real_exercise", wingEntry, exercises), false);

  const explicitEntry = {
    activity_id: "rugby_union",
    position: "test_only",
    excluded_exercise_ids: ["back_squat"],
    copy_boundary_notes: "test fixture"
  };
  assert.equal(isExcludedForPosition("back_squat", explicitEntry, exercises), true);
  assert.equal(isExcludedForPosition("farmers_carry", explicitEntry, exercises), false);
});

test("every profile entry key matches its own activity_id/position fields and is scoped to rugby_union", () => {
  for (const [key, entry] of Object.entries(RUGBY_UNION_POSITION_SUBSTITUTION_PROFILE)) {
    assert.equal(key, `${entry.activity_id}__${entry.position}`, `key/field mismatch for ${key}`);
    assert.equal(entry.activity_id, "rugby_union");
    assert.ok(entry.copy_boundary_notes && entry.copy_boundary_notes.length > 0, `${key} missing copy_boundary_notes`);
  }
});

// ============================================================
// Layer 2: buildV1SubstitutionInput against the real registries.
// ============================================================

test("buildV1SubstitutionInput: position undefined/null/unknown/legacy all produce identical output to today's pre-change (no-position) behaviour", () => {
  const baseline = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union");
  assert.ok(baseline, "expected front_rack_carry to be a known rugby_union substitution source");

  for (const position of [undefined, null, "", "not_a_real_position", "prop"]) {
    const result = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union", position);
    assert.deepEqual(result, baseline, `expected identical output for position=${JSON.stringify(position)}`);
  }
});

test("buildV1SubstitutionInput: a position whose every eligible target is excluded falls back to the unnarrowed set rather than returning null", () => {
  // front_rack_carry's only rugby_union substitution edges all target
  // carry_bilateral exercises (trap_bar_carry, farmers_carry,
  // kettlebell_farmers_carry) - wing/scrum_half/fly_half/fullback all
  // exclude carry_bilateral, so narrowing would remove every candidate.
  const unnarrowed = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union");
  assert.ok(unnarrowed);

  for (const position of ["wing", "scrum_half", "fly_half", "fullback"]) {
    const narrowed = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union", position);
    assert.ok(narrowed, `expected a non-null fallback result for position=${position}`);
    assert.deepEqual(
      narrowed.registry_links.exercise_ids,
      unnarrowed.registry_links.exercise_ids,
      `expected the fallback set to match the unnarrowed set for position=${position}`
    );
  }
});

test("buildV1SubstitutionInput: a position with no matching profile entry (e.g. centre, no exclusions) behaves identically to no position", () => {
  const baseline = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union");
  const centre = buildV1SubstitutionInput("front_rack_carry", [], "rugby_union", "centre");
  assert.deepEqual(centre, baseline);
});

test("buildV1SubstitutionInput: position is scoped per activity_id - a rugby_union position string has no effect when passed under a different activity", () => {
  const withoutPosition = buildV1SubstitutionInput("back_squat", [], "powerlifting");
  const withRugbyPosition = buildV1SubstitutionInput("back_squat", [], "powerlifting", "wing");
  assert.deepEqual(withRugbyPosition, withoutPosition, "a rugby_union position string must not narrow a powerlifting lookup");
});
