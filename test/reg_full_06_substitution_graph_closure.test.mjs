import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REG_FULL_06_DIFFICULTY_RANK,
  REG_FULL_06_EQUIPMENT_LEVEL,
  auditRegFull06Documents,
  loadRegFull06Documents,
  runRegFull06Closure
} from "../ci/registry/reg_full_06_substitution_graph_closure.mjs";
import { loadRegistryExpectedCounts } from "../ci/registry/registry_expected_counts.mjs";
import { buildRegistry } from "../scripts/reg_full_06_materialize_substitution_registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_EXPECTED_COUNTS = loadRegistryExpectedCounts(ROOT).counts;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function load() { return loadRegFull06Documents(ROOT); }
function expectCode(docs, code) {
  const result = auditRegFull06Documents(docs);
  assert.equal(result.ok, false, `expected ${code} failure`);
  assert.ok(result.errors.some((row) => row.code === code), `missing ${code}: ${JSON.stringify(result.errors.slice(0, 20), null, 2)}`);
}
function firstEdge(docs) {
  const pair = Object.entries(docs.substitution.entries)[0];
  assert.ok(pair, "materialized substitution registry must contain at least one edge");
  return pair;
}
function requiredEquipmentMap(docs) {
  const out = new Map();
  for (const row of Object.values(docs.equipmentCompatibility.entries)) {
    if (row.compatibility_type !== "required") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, []);
    out.get(row.exercise_id).push(row.equipment_id);
  }
  return out;
}
function maxEquipmentLevel(ids) {
  return Math.max(...ids.map((id) => REG_FULL_06_EQUIPMENT_LEVEL[id]));
}

test("REG-FULL-06 materialized registry is exactly reproducible and full closure passes", () => {
  const docs = load();
  const rebuilt = buildRegistry({
    exercise: docs.exercise,
    movement: docs.movement,
    equipment: docs.equipment,
    equipmentCompatibility: docs.equipmentCompatibility,
    applicability: docs.applicability
  });
  assert.deepEqual(docs.substitution, rebuilt);
  const result = runRegFull06Closure(ROOT);
  assert.equal(result.ok, true);
  assert.equal(result.counts.exercises, REGISTRY_EXPECTED_COUNTS.exercise_count);
  assert.equal(result.counts.movements, REGISTRY_EXPECTED_COUNTS.movement_count);
  assert.equal(result.counts.edges, REGISTRY_EXPECTED_COUNTS.substitution_edge_count);
});

test("REG-FULL-06 rejects missing source FK", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.source_exercise_id = "missing_source_exercise";
  expectCode(docs, "SOURCE_FK");
});

test("REG-FULL-06 rejects missing target FK", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.target_exercise_id = "missing_target_exercise";
  expectCode(docs, "TARGET_FK");
});

test("REG-FULL-06 rejects self edges", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.target_exercise_id = edge.source_exercise_id;
  expectCode(docs, "SELF_EDGE");
});

test("REG-FULL-06 rejects movement-pattern drift", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  const target = docs.exercise.entries[edge.target_exercise_id];
  const otherMovement = Object.keys(docs.movement.entries).find((id) => id !== docs.exercise.entries[edge.source_exercise_id].movement_pattern_id);
  assert.ok(otherMovement);
  target.movement_pattern_id = otherMovement;
  expectCode(docs, "MOVEMENT_CLOSURE");
});

test("REG-FULL-06 rejects activity applicability drift", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.activity_applicability = [];
  expectCode(docs, "ACTIVITY_CLOSURE");
});

test("REG-FULL-06 rejects a target that is not substitution eligible", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  docs.exercise.entries[edge.target_exercise_id].substitution_eligibility = "restricted";
  expectCode(docs, "TARGET_SUBSTITUTION_ELIGIBILITY");
});

test("REG-FULL-06 rejects an equipment upgrade", () => {
  const docs = clone(load());
  const required = requiredEquipmentMap(docs);
  const candidate = Object.values(docs.substitution.entries).find((edge) => maxEquipmentLevel(required.get(edge.source_exercise_id)) < 2);
  assert.ok(candidate, "expected at least one edge from a level-0/1 equipment source");
  const compatibilityId = `${candidate.target_exercise_id}__reg_full_06_test_barbell`;
  docs.equipmentCompatibility.entries[compatibilityId] = {
    compatibility_id: compatibilityId,
    exercise_id: candidate.target_exercise_id,
    equipment_id: "barbell",
    compatibility_type: "required",
    copy_legal_boundary_notes: "test-only mutation"
  };
  expectCode(docs, "EQUIPMENT_UPGRADE");
});

test("REG-FULL-06 rejects declared equipment-direction drift", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.equipment_change_type = edge.equipment_change_type === "lateral" ? "downgrade" : "lateral";
  expectCode(docs, "EQUIPMENT_DIRECTION");
});

test("REG-FULL-06 rejects a harder target", () => {
  const docs = clone(load());
  const candidate = Object.values(docs.substitution.entries).find((edge) => REG_FULL_06_DIFFICULTY_RANK[docs.exercise.entries[edge.source_exercise_id].difficulty_tier] < REG_FULL_06_DIFFICULTY_RANK.advanced);
  assert.ok(candidate, "expected at least one non-advanced source edge");
  docs.exercise.entries[candidate.target_exercise_id].difficulty_tier = "advanced";
  expectCode(docs, "DIFFICULTY_CLOSURE");
});

test("REG-FULL-06 rejects additional target joint-stress burden", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  docs.exercise.entries[edge.target_exercise_id].joint_stress_tags.push("reg_full_06_extra_joint");
  expectCode(docs, "JOINT_STRESS_CLOSURE");
});

test("REG-FULL-06 rejects nondeterministic ordering keys", () => {
  const docs = clone(load());
  const [, edge] = firstEdge(docs);
  edge.deterministic_ordering_key = `${edge.source_exercise_id}|99|99|${edge.target_exercise_id}`;
  expectCode(docs, "ORDERING_KEY");
});

test("REG-FULL-06 rejects removal of any independently lawful edge", () => {
  const docs = clone(load());
  const [key] = firstEdge(docs);
  delete docs.substitution.entries[key];
  expectCode(docs, "CANDIDATE_SET_CLOSURE");
});

test("REG-FULL-06 rejects fallback/closest edge identifiers", () => {
  const docs = clone(load());
  const [key, edge] = firstEdge(docs);
  delete docs.substitution.entries[key];
  const mutated = `${edge.source_exercise_id}__to__${edge.target_exercise_id}_fallback`;
  edge.substitution_edge_id = mutated;
  docs.substitution.entries[mutated] = edge;
  expectCode(docs, "FALLBACK_EDGE_ID");
});

test("REG-FULL-06 preserves the sealed legacy three-edge graph", () => {
  const docs = clone(load());
  docs.legacyGraph.edges.back_squat.push("front_squat");
  expectCode(docs, "LEGACY_GRAPH_MUTATED");
});

test("REG-FULL-06 rejects legacy graph reactivation", () => {
  const docs = clone(load());
  const legacy = docs.surfaceManifest.entities.find((row) => row.entity_id === "exercise_substitution_graph");
  legacy.final_state.authoritative = true;
  legacy.final_state.final_runtime_load = true;
  expectCode(docs, "LEGACY_ARCHITECTURE");
});
