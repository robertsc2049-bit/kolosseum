import test from "node:test";
import assert from "node:assert/strict";
import { verifyCoachReadyPilotAcceptancePack } from "../ci/scripts/run_coach_ready_pilot_acceptance_pack_guard.mjs";

test("S45 coach-ready pilot acceptance pack passes closed-world guard", () => {
  const result = verifyCoachReadyPilotAcceptancePack();
  assert.equal(result.ok, true);
  assert.equal(result.checklist_id, "coach_ready_pilot_acceptance_checklist");
  assert.equal(result.readiness_count, 18);
  assert.equal(result.negative_boundary_count, 13);
  assert.equal(result.signoff_step_count, 5);
});