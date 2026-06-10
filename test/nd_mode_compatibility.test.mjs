import test from "node:test";
import assert from "node:assert/strict";

import {
  createTruthSignature,
  normalizeNdExecutionSurface,
  computePresentationComplexity
} from "../shared/presentation/nd_mode_execution_surface.mjs";

function buildFixtureSession() {
  return {
    session_id: "sess_p77_fixture",
    work_items: [
      {
        work_item_id: "wi_001",
        exercise_id: "single_arm_dumbbell_overhead_press",
        display_name: "Single-Arm Dumbbell Overhead Press",
        presentation: {
          nd_label: "1-Arm DB Press"
        },
        instruction: {
          short: "Press dumbbell overhead to lockout, then lower under control",
          detailed: [
            "Brace before each rep",
            "Keep wrist stacked over elbow",
            "Finish with the arm straight overhead"
          ]
        },
        choices: [
          {
            choice_id: "keep_current",
            label: "Keep current exercise",
            preferred: true
          },
          {
            choice_id: "swap_db_press",
            label: "Swap to Dumbbell Overhead Press"
          },
          {
            choice_id: "swap_machine_press",
            label: "Swap to Machine Shoulder Press"
          }
        ]
      },
      {
        work_item_id: "wi_002",
        exercise_id: "bench_press",
        display_name: "Barbell Bench Press",
        presentation: {
          nd_label: "Bench Press"
        },
        instruction: {
          short: "Lower bar to chest, then press to full extension",
          detailed: [
            "Set shoulders before the first rep",
            "Keep forearms stacked under the bar"
          ]
        },
        choices: [
          {
            choice_id: "keep_bench",
            label: "Keep current exercise",
            preferred: true
          }
        ]
      }
    ]
  };
}

test("P77: ND mode preserves truth signature", () => {
  const fixture = buildFixtureSession();

  const standardSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: false,
    instruction_density: "detailed"
  });

  const ndSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: true,
    instruction_density: "detailed"
  });

  const expectedTruth = createTruthSignature(fixture);

  assert.deepEqual(standardSurface.truth_signature, expectedTruth);
  assert.deepEqual(ndSurface.truth_signature, expectedTruth);
  assert.deepEqual(ndSurface.truth_signature, standardSurface.truth_signature);
});

test("P77: ND mode reduces visible complexity", () => {
  const fixture = buildFixtureSession();

  const standardSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: false,
    instruction_density: "detailed"
  });

  const ndSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: true,
    instruction_density: "detailed"
  });

  const standardComplexity = computePresentationComplexity(standardSurface);
  const ndComplexity = computePresentationComplexity(ndSurface);

  assert.ok(
    ndComplexity.total_instruction_lines <= standardComplexity.total_instruction_lines,
    "ND mode must not increase visible instruction lines"
  );

  assert.ok(
    ndComplexity.total_visible_choices <= standardComplexity.total_visible_choices,
    "ND mode must not increase visible choice count"
  );

  assert.ok(
    ndComplexity.max_choices_per_step <= standardComplexity.max_choices_per_step,
    "ND mode must not increase max choices per step"
  );

  assert.ok(
    ndComplexity.total_name_tokens <= standardComplexity.total_name_tokens,
    "ND mode must not increase visible naming complexity"
  );

  const strictReduction =
    ndComplexity.total_instruction_lines < standardComplexity.total_instruction_lines ||
    ndComplexity.total_visible_choices < standardComplexity.total_visible_choices ||
    ndComplexity.total_name_tokens < standardComplexity.total_name_tokens;

  assert.equal(
    strictReduction,
    true,
    "ND mode must strictly reduce at least one visible complexity metric"
  );
});

test("P77: ND mode uses simplified naming when ND labels exist", () => {
  const fixture = buildFixtureSession();

  const ndSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: true,
    instruction_density: "detailed"
  });

  assert.equal(ndSurface.work_items[0].visible_name, "1-Arm DB Press");
  assert.equal(ndSurface.work_items[1].visible_name, "Bench Press");
});

test("P77: ND mode collapses visible instructions to short form only", () => {
  const fixture = buildFixtureSession();

  const standardSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: false,
    instruction_density: "detailed"
  });

  const ndSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: true,
    instruction_density: "detailed"
  });

  assert.ok(standardSurface.work_items[0].visible_instruction_lines.length > 1);
  assert.deepEqual(ndSurface.work_items[0].visible_instruction_lines, [
    "Press dumbbell overhead to lockout, then lower under control"
  ]);
});

test("P77: ND mode reduces visible choices but preserves hidden lawful options", () => {
  const fixture = buildFixtureSession();

  const standardSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: false,
    instruction_density: "standard"
  });

  const ndSurface = normalizeNdExecutionSurface(fixture, {
    nd_mode: true,
    instruction_density: "standard"
  });

  assert.equal(standardSurface.work_items[0].visible_choices.length, 3);
  assert.equal(ndSurface.work_items[0].visible_choices.length, 1);
  assert.equal(ndSurface.work_items[0].visible_choices[0].choice_id, "keep_current");
  assert.equal(ndSurface.work_items[0].hidden_choice_count, 2);
  assert.equal(ndSurface.work_items[0].expansion_available, true);
});