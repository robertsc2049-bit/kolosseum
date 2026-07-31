import assert from "node:assert/strict";
import test from "node:test";

import {
  StrengthReferenceLifecycleError,
  assertImmutableStrengthReferenceAppend,
  compareProgrammeStrengthRequirements,
  convertStrengthValue,
  projectStrengthReferenceLifecycle,
  resolveStrengthReferenceLoad
} from "../shared/strength-reference/strengthReferenceLifecycle.mjs";

function assertFails(
  thunk,
  code
) {
  assert.throws(
    thunk,
    (error) =>
      error instanceof
        StrengthReferenceLifecycleError &&
      error.code === code
  );
}

const squatTested = Object.freeze({
  benchmark_id: "reference_squat_tested",
  exercise_id: "back_squat",
  value: 100,
  unit: "kg",
  basis: "tested_1rm",
  effective_date: "2026-07-01",
  source_note: "Competition result",
  replaces_reference_id: null
});

const squatEstimated = Object.freeze({
  benchmark_id: "reference_squat_estimated",
  exercise_id: "back_squat",
  value: 105,
  unit: "kg",
  basis: "estimated_1rm",
  effective_date: "2026-07-15",
  source_note: "Repetition calculation",
  replaces_reference_id: "reference_squat_tested"
});

test("FULL-UI-08C converts display units without changing source facts", () => {
  assert.equal(
    convertStrengthValue(
      100,
      "kg",
      "lb"
    ),
    220.462
  );

  const lifecycle =
    projectStrengthReferenceLifecycle(
      [squatTested],
      "lb",
      "2026-07-10"
    );

  assert.equal(
    lifecycle.current[0].source_value,
    100
  );

  assert.equal(
    lifecycle.current[0].source_unit,
    "kg"
  );

  assert.equal(
    lifecycle.current[0].display_value,
    220.462
  );

  assert.equal(
    lifecycle.current[0].display_unit,
    "lb"
  );
});

test("FULL-UI-08C applies deterministic rounding boundaries", () => {
  const profile = {
    preferred_weight_unit: "kg",
    load_rounding_increment: 2.5,
    benchmarks: [
      {
        ...squatTested,
        value: 67.5
      }
    ]
  };

  const resolved =
    resolveStrengthReferenceLoad(
      profile,
      "back_squat",
      55,
      {
        target_unit: "kg",
        rounding_increment: 2.5,
        as_of_date: "2026-07-10"
      }
    );

  assert.equal(
    resolved.value,
    37.5
  );

  assert.equal(
    resolved.source.source_type,
    "tested_1rm"
  );
});

test("FULL-UI-08C selects effective records by date and preserves future records", () => {
  const lifecycleBefore =
    projectStrengthReferenceLifecycle(
      [
        squatTested,
        squatEstimated
      ],
      "kg",
      "2026-07-10"
    );

  assert.equal(
    lifecycleBefore.current[0].reference_id,
    "reference_squat_tested"
  );

  assert.equal(
    lifecycleBefore.scheduled[0].reference_id,
    "reference_squat_estimated"
  );

  const lifecycleAfter =
    projectStrengthReferenceLifecycle(
      [
        squatTested,
        squatEstimated
      ],
      "kg",
      "2026-07-20"
    );

  assert.equal(
    lifecycleAfter.current[0].reference_id,
    "reference_squat_estimated"
  );

  assert.equal(
    lifecycleAfter.current[0].source_type,
    "estimated_1rm"
  );

  assert.equal(
    lifecycleAfter.superseded[0].reference_id,
    "reference_squat_tested"
  );
});

test("FULL-UI-08C forbids historical mutation and permits immutable replacement", () => {
  const appended =
    assertImmutableStrengthReferenceAppend(
      [squatTested],
      [
        squatTested,
        {
          ...squatEstimated,
          replaces_reference_id: null
        }
      ]
    );

  assert.equal(
    appended.length,
    2
  );

  assert.equal(
    appended[0].value,
    100
  );

  assert.equal(
    appended[1].replaces_reference_id,
    "reference_squat_tested"
  );

  assert.throws(
    () =>
      assertImmutableStrengthReferenceAppend(
        [squatTested],
        [
          {
            ...squatTested,
            value: 101
          }
        ]
      ),
    (error) =>
      error instanceof
        StrengthReferenceLifecycleError &&
      error.code ===
        "strength_reference_history_mutation_forbidden"
  );

  assert.throws(
    () =>
      assertImmutableStrengthReferenceAppend(
        [squatTested],
        []
      ),
    (error) =>
      error instanceof
        StrengthReferenceLifecycleError &&
      error.code ===
        "strength_reference_history_removal_forbidden"
  );

  assert.throws(
    () =>
      assertImmutableStrengthReferenceAppend(
        [squatTested],
        [
          squatTested,
          {
            ...squatEstimated,
            effective_date:
              "2026-07-01"
          }
        ]
      ),
    (error) =>
      error instanceof
        StrengthReferenceLifecycleError &&
      error.code ===
        "strength_reference_replacement_effective_date_invalid"
  );
});

test("FULL-UI-08C reports selected-programme missing references", () => {
  const template = {
    template_structure: {
      blocks: [
        {
          weeks: [
            {
              days: [
                {
                  sessions: [
                    {
                      work_items: [
                        {
                          exercise_id:
                            "back_squat",
                          loading_reference: {
                            type:
                              "percent_1rm"
                          }
                        },
                        {
                          exercise_id:
                            "bench_press",
                          loading_reference: {
                            type:
                              "percent_1rm"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };

  const preflight =
    compareProgrammeStrengthRequirements(
      template,
      [
        squatTested,
        squatEstimated
      ],
      "2026-07-20",
      "kg"
    );

  assert.deepEqual(
    preflight.available,
    [
      "back_squat"
    ]
  );

  assert.deepEqual(
    preflight.missing,
    [
      "bench_press"
    ]
  );

  assert.equal(
    preflight.complete,
    false
  );

  assert.equal(
    preflight.effective_sources[0]
      .source_type,
    "estimated_1rm"
  );
});

test("FULL-UI-08C exposes the exact source used for a resolved load", () => {
  const resolved =
    resolveStrengthReferenceLoad(
      {
        preferred_weight_unit:
          "lb",
        load_rounding_increment:
          5,
        benchmarks: [
          squatTested,
          squatEstimated
        ]
      },
      "back_squat",
      80,
      {
        target_unit: "lb",
        rounding_increment: 5,
        as_of_date: "2026-07-20"
      }
    );

  assert.equal(
    resolved.source.reference_id,
    "reference_squat_estimated"
  );

  assert.equal(
    resolved.source.source_type,
    "estimated_1rm"
  );

  assert.equal(
    resolved.source.source_value,
    105
  );

  assert.equal(
    resolved.source.source_unit,
    "kg"
  );

  assert.equal(
    resolved.source.effective_date,
    "2026-07-15"
  );

  assert.equal(
    resolved.benchmark_basis,
    "estimated_1rm"
  );
});

test("FULL-UI-08C enforces the strength value range boundary", () => {
  assertFails(
    () =>
      projectStrengthReferenceLifecycle([
        { ...squatTested, value: 0.24 }
      ]),
    "strength_reference_value_invalid"
  );

  assertFails(
    () =>
      projectStrengthReferenceLifecycle([
        { ...squatTested, value: 1500.01 }
      ]),
    "strength_reference_value_invalid"
  );

  const atMin = projectStrengthReferenceLifecycle(
    [{ ...squatTested, value: 0.25 }],
    "kg",
    "2026-07-10"
  );
  assert.equal(atMin.current[0].source_value, 0.25);

  const atMax = projectStrengthReferenceLifecycle(
    [{ ...squatTested, value: 1500 }],
    "kg",
    "2026-07-10"
  );
  assert.equal(atMax.current[0].source_value, 1500);
});

test("FULL-UI-08C rejects strength values with more than three decimal places", () => {
  assertFails(
    () =>
      projectStrengthReferenceLifecycle([
        { ...squatTested, value: 100.1234 }
      ]),
    "strength_reference_value_precision_invalid"
  );

  const exact = projectStrengthReferenceLifecycle(
    [{ ...squatTested, value: 100.125 }],
    "kg",
    "2026-07-10"
  );
  assert.equal(exact.current[0].source_value, 100.125);
});

test("FULL-UI-08C enforces the rounding-increment boundary on load resolution", () => {
  const profile = {
    preferred_weight_unit: "kg",
    benchmarks: [squatTested]
  };

  const atMin = resolveStrengthReferenceLoad(
    profile,
    "back_squat",
    80,
    { target_unit: "kg", rounding_increment: 0.25, as_of_date: "2026-07-10" }
  );
  assert.equal(atMin.rounding_increment, 0.25);

  const atMax = resolveStrengthReferenceLoad(
    profile,
    "back_squat",
    80,
    { target_unit: "kg", rounding_increment: 25, as_of_date: "2026-07-10" }
  );
  assert.equal(atMax.rounding_increment, 25);

  assertFails(
    () =>
      resolveStrengthReferenceLoad(
        profile,
        "back_squat",
        80,
        { target_unit: "kg", rounding_increment: 0.24, as_of_date: "2026-07-10" }
      ),
    "strength_reference_rounding_increment_invalid"
  );

  assertFails(
    () =>
      resolveStrengthReferenceLoad(
        profile,
        "back_squat",
        80,
        { target_unit: "kg", rounding_increment: 25.01, as_of_date: "2026-07-10" }
      ),
    "strength_reference_rounding_increment_invalid"
  );
});

test("FULL-UI-08C rejects a replacement dated the same day as its predecessor", () => {
  assertFails(
    () =>
      assertImmutableStrengthReferenceAppend(
        [squatTested],
        [
          squatTested,
          {
            ...squatEstimated,
            effective_date: squatTested.effective_date
          }
        ]
      ),
    "strength_reference_replacement_effective_date_invalid"
  );
});

test("FULL-UI-08C exercises training_max through selection, resolution and immutable replacement", () => {
  const benchTrainingMax = Object.freeze({
    benchmark_id: "reference_bench_training_max",
    exercise_id: "bench_press",
    value: 120,
    unit: "kg",
    basis: "training_max",
    effective_date: "2026-07-01",
    source_note: "Coach-set training max",
    replaces_reference_id: null
  });

  const benchTrainingMaxRevised = Object.freeze({
    benchmark_id: "reference_bench_training_max_v2",
    exercise_id: "bench_press",
    value: 125,
    unit: "kg",
    basis: "training_max",
    effective_date: "2026-07-20",
    source_note: "Cycle-end recalibration",
    replaces_reference_id: "reference_bench_training_max"
  });

  const lifecycle = projectStrengthReferenceLifecycle(
    [benchTrainingMax],
    "kg",
    "2026-07-10"
  );
  assert.equal(lifecycle.current[0].source_type, "training_max");
  assert.equal(lifecycle.current[0].source_value, 120);

  const resolved = resolveStrengthReferenceLoad(
    { preferred_weight_unit: "kg", benchmarks: [benchTrainingMax] },
    "bench_press",
    80,
    { target_unit: "kg", rounding_increment: 2.5, as_of_date: "2026-07-10" }
  );
  assert.equal(resolved.benchmark_basis, "training_max");
  assert.equal(resolved.value, 95);
  assert.equal(resolved.source.source_type, "training_max");

  const appended = assertImmutableStrengthReferenceAppend(
    [benchTrainingMax],
    [benchTrainingMax, benchTrainingMaxRevised]
  );
  assert.equal(appended.length, 2);
  assert.equal(
    appended[1].replaces_reference_id,
    "reference_bench_training_max"
  );

  const lifecycleAfter = projectStrengthReferenceLifecycle(
    [benchTrainingMax, benchTrainingMaxRevised],
    "kg",
    "2026-07-25"
  );
  assert.equal(lifecycleAfter.current[0].reference_id, "reference_bench_training_max_v2");
  assert.equal(lifecycleAfter.current[0].source_value, 125);
  assert.equal(lifecycleAfter.superseded[0].reference_id, "reference_bench_training_max");
  assert.equal(lifecycleAfter.superseded[0].source_type, "training_max");
});