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
  materialiseBeta12Phase5
} from "../engine/dist/src/phases/beta12Phase5Materialisation.js";
import {
  phase5ApplySubstitutionAndAdjustment
} from "../engine/dist/src/phases/phase5.js";
import {
  phase6ProduceSessionOutput
} from "../engine/dist/src/phases/phase6.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(
  here,
  "fixtures",
  "beta_12_phase5"
);

function fixture(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(fixtureRoot, name),
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function structuralIdentity(candidate) {
  return (
    candidate.activity_id +
    "\u0000" +
    candidate.exercise_ids.join("\u0000")
  );
}

function success(result) {
  assert.equal(result.ok, true);
  assert.ok(result.phase5);
  assert.ok(result.materialised_program);
  return result;
}

function assertDeepFrozen(value) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return;
  }

  assert.equal(
    Object.isFrozen(value),
    true,
    "Expected every returned object and array to be frozen."
  );

  for (const child of Object.values(value)) {
    assertDeepFrozen(child);
  }
}

for (const fixtureName of [
  "general_strength.json",
  "powerlifting.json",
  "rugby_union.json"
]) {
  test(
    `BETA-12 identical input produces byte-stable materialisation: ${fixtureName}`,
    () => {
      const input = fixture(fixtureName);

      const first = success(
        materialiseBeta12Phase5(input)
      );

      const second = success(
        materialiseBeta12Phase5(input)
      );

      assert.deepEqual(first, second);

      assert.equal(
        betaCanonicalJson(first),
        betaCanonicalJson(second)
      );

      assert.deepEqual(
        Object.keys(first.phase5),
        [
          "canonical_input_hash",
          "constraint_hash",
          "enumeration_hash",
          "selection_hash",
          "selected_candidate",
          "executable_session"
        ]
      );

      assert.equal(
        first.phase5.canonical_input_hash,
        input.canonical_input_hash
      );

      assert.equal(
        first.phase5.constraint_hash,
        input.constraint_hash
      );

      assert.equal(
        first.phase5.enumeration_hash,
        input.enumeration_hash
      );

      assert.equal(
        first.phase5.selection_hash,
        betaCanonicalHash({
          canonical_input_hash:
            input.canonical_input_hash,
          constraint_hash:
            input.constraint_hash,
          enumeration_hash:
            input.enumeration_hash,
          selected_candidate:
            first.phase5.selected_candidate
        })
      );

      assert.match(
        first.phase5.executable_session.session_id,
        /^beta12_session_[a-f0-9]{24}$/
      );

      assert.equal(
        first.materialised_program.planned_items.length,
        1
      );

      assert.equal(
        first.materialised_program.planned_items[0]
          .exercise_id,
        first.phase5.selected_candidate.exercise_ids[0]
      );
    }
  );
}

test(
  "BETA-12 tie handling selects canonical structural identity",
  () => {
    const input = fixture("powerlifting.json");

    const result = success(
      materialiseBeta12Phase5(input)
    );

    const expected = [...input.enumerated_solution_space]
      .sort(
        (left, right) =>
          structuralIdentity(left) <
          structuralIdentity(right)
            ? -1
            : structuralIdentity(left) >
                structuralIdentity(right)
              ? 1
              : 0
      )[0];

    assert.deepEqual(
      result.phase5.selected_candidate,
      expected
    );
  }
);

test(
  "BETA-12 exact duplicate tie fails deterministically",
  () => {
    const input = fixture("general_strength.json");

    input.enumerated_solution_space.push(
      clone(input.enumerated_solution_space[0])
    );

    input.enumeration_hash = betaCanonicalHash(
      input.enumerated_solution_space
    );

    assert.deepEqual(
      materialiseBeta12Phase5(input),
      {
        ok: false,
        failure_token: "nondeterminism_detected"
      }
    );
  }
);

test(
  "BETA-12 payment state has no Phase 5 effect",
  () => {
    const input = fixture("rugby_union.json");

    const baseline = materialiseBeta12Phase5(input);

    const changed = materialiseBeta12Phase5({
      ...input,
      payment_state: {
        plan: "enterprise",
        active: true
      }
    });

    assert.deepEqual(changed, baseline);
  }
);

test(
  "BETA-12 coach notes have no Phase 5 effect",
  () => {
    const input = fixture("powerlifting.json");

    const baseline = materialiseBeta12Phase5(input);

    const changed = materialiseBeta12Phase5({
      ...input,
      coach_notes: [
        "Select another exercise.",
        "Increase session volume."
      ]
    });

    assert.deepEqual(changed, baseline);
  }
);

test(
  "BETA-12 ND mode has no Phase 5 engine effect",
  () => {
    const input = fixture("general_strength.json");

    const baseline = materialiseBeta12Phase5(input);

    const changed = materialiseBeta12Phase5({
      ...input,
      nd_mode: true,
      presentation_density: "minimal"
    });

    assert.deepEqual(changed, baseline);
  }
);

test(
  "BETA-12 existing Phase 5 path routes beta enumeration before legacy adjustment",
  () => {
    const input = fixture("powerlifting.json");

    const direct = success(
      materialiseBeta12Phase5(input)
    );

    const routed = success(
      phase5ApplySubstitutionAndAdjustment(
        input,
        {
          ignored_external_state: true
        }
      )
    );

    assert.deepEqual(
      routed.phase5,
      direct.phase5
    );

    assert.deepEqual(
      routed.materialised_program,
      direct.materialised_program
    );
  }
);

test(
  "BETA-12 materialised programme is executable by Phase 6",
  () => {
    const input = fixture("rugby_union.json");

    const phase5 = success(
      materialiseBeta12Phase5(input)
    );

    const phase6 = phase6ProduceSessionOutput(
      phase5.materialised_program,
      {},
      phase5
    );

    assert.equal(phase6.ok, true);
    assert.equal(phase6.session.status, "ready");
    assert.equal(phase6.session.exercises.length, 1);

    assert.equal(
      phase6.session.exercises[0].exercise_id,
      phase5.phase5.selected_candidate.exercise_ids[0]
    );

    assert.equal(
      phase6.session.exercises[0].block_id,
      phase5.materialised_program.planned_items[0]
        .block_id
    );

    assert.equal(
      phase6.session.exercises[0].item_id,
      phase5.materialised_program.planned_items[0]
        .item_id
    );
  }
);

test(
  "BETA-12 Phase 5 output is deeply frozen",
  () => {
    const result = success(
      materialiseBeta12Phase5(
        fixture("powerlifting.json")
      )
    );

    assertDeepFrozen(result);
  }
);

test(
  "BETA-12 enumeration binding mismatch fails closed",
  () => {
    const input = fixture("powerlifting.json");

    input.enumeration_hash = "0".repeat(64);

    assert.deepEqual(
      materialiseBeta12Phase5(input),
      {
        ok: false,
        failure_token: "phase5_binding_mismatch"
      }
    );
  }
);
