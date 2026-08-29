import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  REG_FULL_05_FAILURE_TOKEN,
  REG_FULL_05_PATHS,
  REG_FULL_05_REQUIRED_RUGBY_ROLES,
  auditRegFull05Documents,
  auditRegFull05Authority,
  loadRegFull05Documents
} from "../ci/registry/reg_full_05_sport_context_completion.mjs";

function clone(value) { return structuredClone(value); }
function expectClosureFailure(fn, reason) {
  assert.throws(fn, (error) => error?.code === REG_FULL_05_FAILURE_TOKEN && error?.reason === reason);
}

function firstLink(documents, predicate = () => true) {
  return Object.values(documents.link.entries).find(predicate);
}

test("REG-FULL-05 completes all three sport-context surfaces", () => {
  const result = auditRegFull05Documents(loadRegFull05Documents());
  assert.equal(result.activity_count, 3);
  assert.ok(result.subdivision_count >= 24);
  assert.ok(result.role_count >= 18);
  assert.ok(result.metric_count >= 32);
  assert.ok(result.metric_link_count > 12);
  assert.ok(result.threshold_count >= result.metric_count);
  assert.ok(result.by_activity.rugby_union.roles >= 16);
  assert.ok(result.by_activity.rugby_union.metric_links > 0);
  assert.ok(result.by_activity.rugby_union.thresholds > 0);
});

test("REG-FULL-05 requires the completed rugby role model", () => {
  const docs = loadRegFull05Documents();
  const mutated = clone(docs);
  delete mutated.role.entries[REG_FULL_05_REQUIRED_RUGBY_ROLES.at(-1)];
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_required_role_missing");
});

test("REG-FULL-05 rejects role subdivision/activity drift", () => {
  const mutated = clone(loadRegFull05Documents());
  mutated.role.entries.rugby_union__hooker.sport_subdivision_id = "general_strength__training";
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_role_subdivision_activity_mismatch");
});

test("REG-FULL-05 rejects metric subdivision/activity drift", () => {
  const mutated = clone(loadRegFull05Documents());
  mutated.metric.entries.rugby_union__load_kg.sport_subdivision_id = "general_strength__training";
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_metric_subdivision_activity_mismatch");
});

test("REG-FULL-05 rejects dangling metric-exercise metric FKs", () => {
  const mutated = clone(loadRegFull05Documents());
  const row = firstLink(mutated, (item) => item.activity_id === "rugby_union");
  row.sport_metric_id = "rugby_union__not_in_metric_registry";
  row.metric_exercise_link_id = `${row.sport_metric_id}__${row.exercise_id}`;
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_metric_link_metric_fk_missing");
});

test("REG-FULL-05 rejects dangling metric-exercise exercise FKs", () => {
  const mutated = clone(loadRegFull05Documents());
  const row = firstLink(mutated, (item) => item.activity_id === "rugby_union");
  row.exercise_id = "not_in_exercise_registry";
  row.metric_exercise_link_id = `${row.sport_metric_id}__${row.exercise_id}`;
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_metric_link_exercise_fk_missing");
});

test("REG-FULL-05 requires explicit exercise/activity applicability for every link", () => {
  const mutated = clone(loadRegFull05Documents());
  const row = firstLink(mutated, (item) => item.activity_id === "rugby_union");
  for (const [id, applicability] of Object.entries(mutated.applicability.entries)) {
    if (applicability.exercise_id === row.exercise_id && applicability.activity_id === row.activity_id) delete mutated.applicability.entries[id];
  }
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_metric_link_explicit_applicability_missing");
});

test("REG-FULL-05 requires every linkable metric to have explicit exercise edges", () => {
  const mutated = clone(loadRegFull05Documents());
  for (const [id, row] of Object.entries(mutated.link.entries)) {
    if (row.sport_metric_id === "rugby_union__contact_repetition_count") delete mutated.link.entries[id];
  }
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_linkable_metric_without_explicit_exercise");
});

test("REG-FULL-05 keeps body-mass metrics exercise-link free", () => {
  const mutated = clone(loadRegFull05Documents());
  const source = firstLink(mutated, (item) => item.activity_id === "rugby_union");
  const id = `rugby_union__body_mass_kg__${source.exercise_id}`;
  mutated.link.entries[id] = {
    ...source,
    metric_exercise_link_id: id,
    sport_metric_id: "rugby_union__body_mass_kg"
  };
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_body_mass_metric_must_be_linkless");
});

test("REG-FULL-05 requires a threshold marker for every sport metric", () => {
  const mutated = clone(loadRegFull05Documents());
  for (const [id, row] of Object.entries(mutated.threshold.entries)) {
    if (row.sport_metric_id === "rugby_union__jump_height_cm") delete mutated.threshold.entries[id];
  }
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_metric_without_threshold_marker");
});

test("REG-FULL-05 rejects threshold unit drift", () => {
  const mutated = clone(loadRegFull05Documents());
  const row = Object.values(mutated.threshold.entries).find((item) => item.sport_metric_id === "rugby_union__jump_height_cm");
  row.threshold_unit = "kg";
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_threshold_unit_mismatch");
});

test("REG-FULL-05 rejects threshold status-contract drift", () => {
  const mutated = clone(loadRegFull05Documents());
  const row = Object.values(mutated.threshold.entries).find((item) => !item.threshold_marker_id.includes("attempt_count__lte_3"));
  row.marker_status_allowed_values = ["recorded_met"];
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_threshold_status_contract_invalid");
});

test("REG-FULL-05 forbids generic fallback identifiers", () => {
  const mutated = clone(loadRegFull05Documents());
  mutated.subdivision.entries.rugby_union__fallback_context = {
    sport_subdivision_id: "rugby_union__fallback_context",
    activity_id: "rugby_union",
    display_label: "Fallback",
    context_type: "declared_context",
    copy_boundary_notes: "factual sport context classification only"
  };
  expectClosureFailure(() => auditRegFull05Documents(mutated), "reg_full_05_generic_fallback_forbidden");
});

test("REG-FULL-05 threshold supersession cannot activate runtime authority", () => {
  const finalSurface = JSON.parse(fs.readFileSync(REG_FULL_05_PATHS.finalSurface, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(REG_FULL_05_PATHS.evidence, "utf8"));
  const liveHashes = { ...evidence.hashes_sha256 };
  const mutated = clone(finalSurface);
  const thresholdEntity = mutated.entities.find((row) => row.canonical_registry_id === "threshold_marker_registry");
  thresholdEntity.final_state.final_runtime_load = true;
  expectClosureFailure(
    () => auditRegFull05Authority({ finalSurface: mutated, evidence, liveHashes }),
    "reg_full_05_threshold_must_remain_dormant_non_runtime"
  );
});
