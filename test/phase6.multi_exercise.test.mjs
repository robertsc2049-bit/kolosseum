import test from "node:test";
import assert from "node:assert/strict";
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
  "Phase6 emits one session exercise per UNIQUE final planned exercise",
  () => {
    const out = runEngine(BASE);
    assert.equal(out.ok, true);

    let finalIds = [...out.phase4.planned_exercise_ids];

    for (const adj of out.phase5.adjustments ?? []) {
      if (adj.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
      if (!adj.applied) continue;

      finalIds = finalIds.map(id =>
        id === adj.details.target_exercise_id
          ? adj.details.substitute_exercise_id
          : id
      );
    }

    const uniqueFinal = Array.from(new Set(finalIds));

    assert.equal(out.phase6.exercises.length, uniqueFinal.length);
  }
);
