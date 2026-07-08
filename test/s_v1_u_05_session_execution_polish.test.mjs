import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSessionExecutionTruth,
  getSessionExecutionPolishCopyIds,
  lintSessionExecutionPolishCopySurface,
  renderV1SessionExecutionPolish
} from "../src/v1SessionExecutionPolish.mjs";

function sessionFixture() {
  return {
    session_id: "session_exec_1",
    status: "in_progress",
    work_items: [
      {
        work_item_id: "work_1",
        display_order: 1,
        exercise_token_id: "exercise_token_back_squat",
        planned_quantity: {
          sets: 3,
          reps: 5,
          load_value: 100,
          load_unit: "kg"
        }
      },
      {
        work_item_id: "work_2",
        display_order: 2,
        exercise_token_id: "exercise_token_bench_press",
        planned_quantity: {
          sets: 3,
          reps: 5,
          load_value: 80,
          load_unit: "kg"
        }
      },
      {
        work_item_id: "work_3",
        display_order: 3,
        exercise_token_id: "exercise_token_deadlift",
        planned_quantity: {
          sets: 2,
          reps: 3,
          load_value: 140,
          load_unit: "kg"
        }
      }
    ],
    runtime_events: [
      {
        event_id: "event_1",
        event_type: "WORK_ITEM_COMPLETED",
        work_item_id: "work_1"
      }
    ],
    completed_ids: ["work_1"],
    skipped_ids: [],
    partial_ids: [],
    return_decision_required: false
  };
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

test("S-V1-U-05 renders a mobile session execution polish surface", () => {
  const surface = renderV1SessionExecutionPolish({
    session_state: sessionFixture(),
    presentation: {
      nd_mode: false,
      instruction_density: "standard",
      low_input_mode: false
    }
  });

  assert.equal(surface.slice_id, "S-V1-U-05");
  assert.equal(surface.surface_id, "session_execution_polish");
  assert.equal(surface.presentation_only, true);
  assert.equal(surface.engine_visible, false);
  assert.equal(surface.engine_mutation_permitted, false);

  assert.equal(surface.source_session_id, "session_exec_1");
  assert.equal(surface.session_truth.current_work_item_id, "work_2");
  assert.equal(surface.current_work_item.work_item_id, "work_2");
  assert.equal(surface.progress.work_item_count, 3);
  assert.equal(surface.progress.completed_count, 1);

  assert.ok(surface.minimal_input_actions.length >= 4);
  assert.deepEqual(
    surface.minimal_input_actions.map((action) => action.action_id),
    ["complete_current", "record_partial", "skip_current", "stop_session"]
  );
  assert.equal(surface.minimal_input_actions[0].work_item_id, "work_2");
});

test("S-V1-U-05 accessibility contract is explicit for mobile execution", () => {
  const surface = renderV1SessionExecutionPolish({
    session_state: sessionFixture(),
    presentation: {
      nd_mode: true,
      instruction_density: "minimal"
    }
  });

  assert.equal(surface.accessibility_contract.landmark_role, "main");
  assert.equal(surface.accessibility_contract.status_region_role, "status");
  assert.equal(surface.accessibility_contract.live_region, "polite");
  assert.equal(surface.accessibility_contract.action_group_role, "group");
  assert.equal(surface.accessibility_contract.minimum_touch_target_px, 44);
  assert.equal(surface.accessibility_contract.visible_focus_required, true);
  assert.deepEqual(
    surface.accessibility_contract.keyboard_action_order,
    surface.minimal_input_actions.map((action) => action.action_id)
  );
});

test("S-V1-U-05 ND and low-input presentation do not alter session truth", () => {
  const sessionState = sessionFixture();

  const standard = renderV1SessionExecutionPolish({
    session_state: sessionState,
    presentation: {
      nd_mode: false,
      instruction_density: "standard",
      low_input_mode: false
    }
  });

  const nd = renderV1SessionExecutionPolish({
    session_state: sessionState,
    presentation: {
      nd_mode: true,
      instruction_density: "minimal",
      low_input_mode: true
    }
  });

  assert.deepEqual(extractSessionExecutionTruth(standard), extractSessionExecutionTruth(nd));
  assert.notDeepEqual(standard.nd_presentation, nd.nd_presentation);
  assert.equal(standard.nd_presentation.tap_path, "standard");
  assert.equal(nd.nd_presentation.tap_path, "reduced");
  assert.ok(nd.minimal_input_actions.length < standard.minimal_input_actions.length);
});

test("S-V1-U-05 copy lint keeps copy IDs factual and registry-shaped", () => {
  const surface = renderV1SessionExecutionPolish({
    session_state: sessionFixture(),
    presentation: {
      nd_mode: false,
      instruction_density: "standard"
    }
  });

  const copyIds = getSessionExecutionPolishCopyIds();
  assert.ok(copyIds.length >= 10);
  for (const copyId of copyIds) {
    assert.match(copyId, /^SESSION_POLISH_[A-Z0-9_]+$/u);
    assert.equal(copyId.includes(" "), false);
  }

  assert.deepEqual(lintSessionExecutionPolishCopySurface(surface), {
    ok: true,
    checked_copy_id_count: surface.copy_ids.length + surface.minimal_input_actions.length * 2
  });
});

test("S-V1-U-05 renderer does not mutate source session state", () => {
  const source = sessionFixture();
  const before = stable(source);

  const surface = renderV1SessionExecutionPolish({
    session_state: source,
    presentation: {
      nd_mode: true,
      instruction_density: "minimal"
    }
  });

  assert.equal(stable(source), before);
  assert.equal(surface.session_truth.session_id, "session_exec_1");
});

test("S-V1-U-05 return decision state exposes return actions without reducer changes", () => {
  const source = {
    ...sessionFixture(),
    return_decision_required: true
  };

  const surface = renderV1SessionExecutionPolish({
    session_state: source,
    presentation: {
      nd_mode: false,
      instruction_density: "standard"
    }
  });

  assert.equal(surface.session_truth.return_decision_required, true);
  assert.ok(surface.minimal_input_actions.some((action) => action.action_id === "return_continue"));
  assert.ok(surface.minimal_input_actions.some((action) => action.action_id === "return_skip"));
  assert.equal(surface.minimal_input_actions.find((action) => action.action_id === "return_continue").presentation_only, true);
});