import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("session preview prints stable summary, notes, and rendered session lines for a known valid fixture", () => {
  const out = execFileSync(
    process.execPath,
    ["ci/scripts/session_preview.mjs", "test/fixtures/phase1_to_phase6.valid.general_strength.individual.json"],
    { encoding: "utf8" }
  );

  assert.match(out, /== SESSION PREVIEW ==/);
  assert.match(out, /Status: OK/);
  assert.match(out, /== SUMMARY ==/);
  assert.match(out, /Exercise count: 6/);
  assert.match(out, /Total work sets: 22/);
  assert.match(out, /== NOTES ==/);
  assert.match(out, /PHASE_6: emitted session from planned_items \(deduped\)/);
  assert.match(out, /== SESSION ==/);
  assert.match(out, /1\. deadlift — sets=4 \| reps=5 \| intensity=75% 1RM/);
  assert.match(out, /6\. push_up — sets=3 \| reps=10 \| intensity=60% 1RM/);
  assert.match(out, /== RAW RESULT KEYS ==/);
});
