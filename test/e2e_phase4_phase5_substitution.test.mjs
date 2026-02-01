import assert from "node:assert/strict";
import test from "node:test";
import { runEngine } from "../dist/engine/src/index.js";

const BASE = {
  consent_granted: true,
  engine_version: "EB2-1.0.0",
  enum_bundle_version: "EB2-1.0.0",
  phase1_schema_version: "1.0.0",
  actor_type: "athlete",
  execution_scope: "individual",
  activity_id: "powerlifting",
  nd_mode: false,
  instruction_density: "standard",
  exposure_prompt_density: "standard",
  bias_mode: "none"
};

test(
  "E2E: Phase6 mirrors UNIQUE final planned exercises after substitution",
  () => {
    const out = runEngine(BASE);
    assert.equal(out.ok, true);

    const planned = out.phase4.planned_exercise_ids;
    assert.ok(Array.isArray(planned));

    let finalIds = [...planned];

    // Replay Phase5 substitution deterministically
    for (const adj of out.phase5.adjustments ?? []) {
      if (adj.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
      if (adj.applied !== true) continue;

      const target = adj.details.target_exercise_id;
      const sub = adj.details.substitute_exercise_id;

      finalIds = finalIds.map(id => (id === target ? sub : id));
    }

    const uniqueFinal = Array.from(new Set(finalIds));

    const session = out.phase6.exercises;
    assert.ok(Array.isArray(session));
    assert.equal(session.length, uniqueFinal.length);

    for (const ex of session) {
      assert.ok(uniqueFinal.includes(ex.exercise_id));
    }
  }
);



