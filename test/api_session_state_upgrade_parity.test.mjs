// test/api_session_state_upgrade_parity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { applyRuntimeEvent, makeRuntimeState } from "../engine/src/runtime/session_runtime.js";
import { deriveTrace, normalizeSummary, fromEngineState } from "../engine/src/runtime/session_summary.js";

function planned(ids) {
  return {
    exercises: ids.map((exercise_id) => ({ exercise_id, source: "program" }))
  };
}

test("API summary upgrade: legacy V2(+split) normalizes to V3 and matches reducer replay", () => {
  // Given: planned session with N exercises
  const planIds = ["exA", "exB", "exC", "exD"];
  const planned_session = planned(planIds);

  // When: legacy V2 summary + split snapshot
  // We choose a scenario that is unambiguous and replayable:
  // complete exA, skip exB, then split_start => remaining_at_split [exC, exD]
  const legacyV2 = {
    version: 2,
    started: true,
    remaining_exercises: [{ exercise_id: "exC", source: "program" }, { exercise_id: "exD", source: "program" }],
    completed_exercises: [{ exercise_id: "exA", source: "program" }],
    dropped_exercises: [{ exercise_id: "exB", source: "program" }],
    split: { active: true, remaining_at_split_ids: ["exC", "exD"] },
    last_seq: 7
  };

  // Normalize (this is what GET /state relies on before deriveTrace)
  const { summary, needsUpgrade } = normalizeSummary(planned_session, legacyV2);
  assert.equal(needsUpgrade, true);
  assert.equal(summary.version, 3);
  assert.equal(summary.started, true);

  const apiTrace = deriveTrace(summary);

  // Reducer replay to expected state
  let st = makeRuntimeState(planIds);
  st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: "exA" });
  st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: "exB" });
  st = applyRuntimeEvent(st, { type: "split_start" });

  // Legacy split snapshot is treated as stored runtime data.
  // It should match the reducer-produced split for this scenario.
  const expected = deriveTrace({
    version: 3,
    started: true,
    runtime: fromEngineState(st),
    last_seq: 7
  });

  assert.deepEqual(apiTrace, expected);
});

test("API summary upgrade: legacy V1 normalizes to V3 and matches reducer replay (no split)", () => {
  const planIds = ["exA", "exB", "exC"];
  const planned_session = planned(planIds);

  const legacyV1 = {
    started: true,
    remaining_ids: ["exC"],
    completed_ids: ["exA"],
    dropped_ids: ["exB"],
    last_seq: 3
  };

  const { summary, needsUpgrade } = normalizeSummary(planned_session, legacyV1);
  assert.equal(needsUpgrade, true);

  const apiTrace = deriveTrace(summary);

  let st = makeRuntimeState(planIds);
  st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: "exA" });
  st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: "exB" });

  const expected = deriveTrace({
    version: 3,
    started: true,
    runtime: fromEngineState(st),
    last_seq: 3
  });

  assert.deepEqual(apiTrace, expected);
});