import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../engine/dist/src/phases/betaCanonical.js";
import {
  enumerateBeta11Phase4
} from "../engine/dist/src/phases/beta11Phase4Enumeration.js";
import {
  phase4AssembleProgram
} from "../engine/dist/src/phases/phase4.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, "fixtures", "beta_11_phase4");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function success(result) {
  assert.equal(result.ok, true);
  assert.ok(result.phase4);
  return result.phase4;
}

for (const fixtureName of [
  "powerlifting.json",
  "rugby_union.json",
  "general_strength.json"
]) {
  test(`BETA-11 byte-stable enumeration: ${fixtureName}`, () => {
    const phase3 = fixture(fixtureName);
    const first = enumerateBeta11Phase4(phase3);
    const second = enumerateBeta11Phase4(phase3);

    assert.deepEqual(first, second);
    assert.equal(betaCanonicalJson(first), betaCanonicalJson(second));

    const output = success(first);
    assert.deepEqual(Object.keys(output), [
      "canonical_input_hash",
      "constraint_hash",
      "enumeration_hash",
      "enumerated_solution_space"
    ]);
    assert.equal(output.canonical_input_hash, phase3.canonical_input_hash);
    assert.equal(output.constraint_hash, phase3.constraint_hash);

    for (const candidate of output.enumerated_solution_space) {
      assert.deepEqual(Object.keys(candidate), ["activity_id", "exercise_ids"]);
      assert.equal(candidate.activity_id, phase3.allowed_solution_space_descriptor.activity_id);
      assert.equal(candidate.exercise_ids.length, 1);
    }
  });
}

test("BETA-11 empty enumeration fails deterministically", () => {
  const phase3 = fixture("powerlifting.json");
  phase3.allowed_solution_space_descriptor.exercise_ids = [];
  phase3.constraint_hash = betaCanonicalHash(phase3.allowed_solution_space_descriptor);

  const first = enumerateBeta11Phase4(phase3);
  const second = enumerateBeta11Phase4(phase3);

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    ok: false,
    failure_token: "empty_solution_space"
  });
});

test("BETA-11 unsupported enum fails deterministically", () => {
  const phase3 = fixture("rugby_union.json");
  phase3.allowed_solution_space_descriptor.activity_id = "unsupported_activity";
  phase3.constraint_hash = betaCanonicalHash(phase3.allowed_solution_space_descriptor);

  assert.deepEqual(enumerateBeta11Phase4(phase3), {
    ok: false,
    failure_token: "unknown_enum_value"
  });
});

test("BETA-11 canonical ordering is input-order independent", () => {
  const firstInput = fixture("general_strength.json");
  const secondInput = clone(firstInput);

  secondInput.allowed_solution_space_descriptor.exercise_ids.reverse();
  secondInput.constraint_hash = betaCanonicalHash(secondInput.allowed_solution_space_descriptor);

  const first = success(enumerateBeta11Phase4(firstInput));
  const second = success(enumerateBeta11Phase4(secondInput));

  assert.deepEqual(first.enumerated_solution_space, second.enumerated_solution_space);
  assert.equal(first.enumeration_hash, second.enumeration_hash);
});

test("BETA-11 enumeration hash covers the complete ordered list", () => {
  const output = success(enumerateBeta11Phase4(fixture("powerlifting.json")));

  assert.equal(
    output.enumeration_hash,
    betaCanonicalHash(output.enumerated_solution_space)
  );

  const changed = clone(output.enumerated_solution_space);
  changed[0].exercise_ids[0] = "changed_exercise";

  assert.notEqual(
    output.enumeration_hash,
    betaCanonicalHash(changed)
  );
});

test("BETA-11 binding mismatch fails closed", () => {
  const phase3 = fixture("rugby_union.json");
  phase3.constraint_hash = "0".repeat(64);

  assert.deepEqual(enumerateBeta11Phase4(phase3), {
    ok: false,
    failure_token: "phase4_binding_mismatch"
  });
});

test("BETA-11 duplicate structural candidates fail deterministically", () => {
  const phase3 = fixture("powerlifting.json");
  phase3.allowed_solution_space_descriptor.exercise_ids.push(
    phase3.allowed_solution_space_descriptor.exercise_ids[0]
  );
  phase3.constraint_hash = betaCanonicalHash(phase3.allowed_solution_space_descriptor);

  assert.deepEqual(enumerateBeta11Phase4(phase3), {
    ok: false,
    failure_token: "nondeterminism_detected"
  });
});

test("existing Phase 4 path accepts direct Phase 3 beta output", () => {
  const phase3 = fixture("powerlifting.json");
  const result = phase4AssembleProgram(phase3);

  assert.equal(result.ok, true);
  assert.ok(result.phase4);
  assert.deepEqual(result.program.enumerated_solution_space, result.phase4.enumerated_solution_space);
  assert.equal(result.program.enumeration_hash, result.phase4.enumeration_hash);
});
