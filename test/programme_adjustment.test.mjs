// What the app changed about a session on its own, in words the coach sees on
// the review screen (src/api/programme_adjustment.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { programmeAdjustments } from "../dist/src/api/programme_adjustment.js";

test("a coach sees that her lifter's prep skipped two build weeks to land the taper on meet week", () => {
  const lines = programmeAdjustments({ template_position: { template_session_index: 12, peak_timing: { adjustment: "skipped", weeks: 2, competition_date: "2026-10-24" } } });
  assert.deepEqual(lines, ["Skipped 2 build weeks so the taper lands in competition week (24 Oct)"]);
});

test("a coach sees a fighter repeating his last hard week because camp started early", () => {
  const lines = programmeAdjustments({ template_position: { template_session_index: 40, peak_timing: { adjustment: "held", weeks: 1, competition_date: "2026-11-07" } } });
  assert.deepEqual(lines, ["Repeating the last build week: 1 week to go before the taper for 7 Nov"]);
});

test("a coach sees why a session came back lighter: 15 days away, or a head injury stand-down", () => {
  assert.deepEqual(programmeAdjustments({ template_position: { template_session_index: 4, reentry: { reentry_week: true, gap_days: 15 } } }),
    ["Back after 15 days away: a lighter first week (a set fewer, lighter loads)"]);
  assert.deepEqual(programmeAdjustments({ programme_run: { reentry: { reentry_week: true, gap_days: 21, after_head_injury: true } } }),
    ["First week back after a head injury stand-down: lighter"]);
  assert.deepEqual(programmeAdjustments({ head_injury_return: { returned_on: "2026-10-01", held_back_exercise_ids: ["box_jump", "sled_push"], lighter: true } }),
    ["Back after a head injury: 2 exercises held back, the rest lighter"]);
});

test("an ordinary session shows nothing", () => {
  assert.deepEqual(programmeAdjustments({ template_position: { template_session_index: 3 }, exercises: [] }), []);
  assert.deepEqual(programmeAdjustments(null), []);
});
