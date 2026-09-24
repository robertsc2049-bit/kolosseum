import test from "node:test";
import assert from "node:assert/strict";
import { auditRegFull03Documents, loadRegFull03Documents, EXPECTED_EXERCISE_COUNT, EXPECTED_TOKEN_COUNT, EXPECTED_APPLICABILITY_COUNT } from "../ci/registry/reg_full_03_exercise_registry_production.mjs";

const live = loadRegFull03Documents(process.cwd());
const copy = () => JSON.parse(JSON.stringify(live));
const codes = result => new Set(result.errors.map(e => e.code));

test("REG-FULL-03 closes the production exercise universe", () => {
  const result = auditRegFull03Documents(copy());
  assert.equal(result.ok, true, JSON.stringify(result.errors.slice(0, 10)));
  assert.equal(result.counts.exercises, EXPECTED_EXERCISE_COUNT);
  assert.equal(result.counts.tokens, EXPECTED_TOKEN_COUNT);
  assert.equal(result.counts.applicability, EXPECTED_APPLICABILITY_COUNT);
  assert.equal(result.counts.movement_patterns, 54);
});

test("REG-FULL-03 rejects removal of a competition lift", () => {
  const docs = copy();
  delete docs.exercise.entries.bench_press;
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("REQUIRED_EXERCISE_MISSING"), true);
});

test("REG-FULL-03 rejects a missing canonical exercise field", () => {
  const docs = copy();
  delete docs.exercise.entries.paused_back_squat.substitution_eligibility;
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("CANONICAL_FIELD"), true);
});

test("REG-FULL-03 rejects a movement-scoped equipment FK violation", () => {
  const docs = copy();
  docs.exercise.entries.ten_metre_acceleration.equipment_requirements = ["barbell"];
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("EQUIPMENT_SCOPED_FK"), true);
});

test("REG-FULL-03 rejects thin instruction content", () => {
  const docs = copy();
  docs.exercise.entries.farmers_carry.coaching_cues = ["Walk"];
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("INSTRUCTION_QUALITY"), true);
});

test("REG-FULL-03 rejects a missing exercise token", () => {
  const docs = copy();
  delete docs.token.entries.front_plank_token;
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("TOKEN_CLOSURE"), true);
});

test("REG-FULL-03 rejects incomplete explicit applicability closure", () => {
  const docs = copy();
  delete docs.applicability.entries.sled_push__rugby_union__training;
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("APPLICABILITY_CLOSURE"), true);
});

test("REG-FULL-03 rejects unlawful competition applicability", () => {
  const docs = copy();
  docs.applicability.entries.paused_bench_press__powerlifting__competition.applicability_state = "allowed";
  const result = auditRegFull03Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("APPLICABILITY_STATE"), true);
});
