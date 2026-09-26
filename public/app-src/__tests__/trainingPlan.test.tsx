// The onboarding/session UI's season-vs-competition split must match the
// engine's cycle models, or athletes would be asked for the wrong dates.
import assert from "node:assert/strict";
import test from "node:test";

import { cycleModelFor } from "../../../engine/src/phases/phase4/periodisation";
import { V1_ACTIVITY_IDS } from "../../../shared/v1-boundary/v1ActivityRegistry.mjs";
import { planDateKind, trainingCycleSummary } from "../utils/trainingPlan";

test("the UI plans each sport towards the dates its engine cycle model uses", () => {
  for (const activity of V1_ACTIVITY_IDS as readonly string[]) {
    const model = cycleModelFor(activity);
    assert.ok(model, `${activity} has an engine cycle model`);
    const expected = activity === "general_strength" ? "none" : model === "season" ? "season" : "competition";
    assert.equal(planDateKind(activity), expected, activity);
  }
});

test("the session summary names the phase, block week, session and focus", () => {
  assert.equal(
    trainingCycleSummary({ macro_phase: "pre_season", meso_week: 2, sessions_per_week: 3, session_slot: 4, day_focus: "upper_body_strength" }),
    "Pre-season · Week 2 of 4 · Session 2 of 3: Upper body strength"
  );
  assert.equal(trainingCycleSummary({ macro_phase: "taper", meso_week: 1, sessions_per_week: 2, session_slot: 0, day_focus: "full_body" }), "Taper · Week 1 of 4 · Session 1 of 2: Full body");
  assert.equal(trainingCycleSummary(null), null);
});
