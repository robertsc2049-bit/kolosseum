// What a recorded session is called in history and the coach's review
// (src/api/session_title.ts). A self-coached athlete's own week used to come
// out as a list of identical "Training session"s (walkthrough 11).
import assert from "node:assert/strict";
import test from "node:test";

import { plannedSessionTitle } from "../dist/src/api/session_title.js";

test("a session from the athlete's own week is named by its day", () => {
  assert.equal(plannedSessionTitle({ own_training: { week_id: "w", day_number: 3, days_total: 3, week_number: 1, lighter: false } }), "My training · Day 3 of 3 · week 1");
  assert.equal(plannedSessionTitle({ own_training: { week_id: "w", day_number: 1, days_total: 4, week_number: 4, lighter: true } }), "My training · Day 1 of 4 · week 4 (lighter)");
  assert.equal(plannedSessionTitle({ own_training: { week_id: "w", day_number: 1, days_total: 1, week_number: 1, lighter: false, today: true } }), "Today's session");
});

test("a programme's own title still wins, and an unknown session is still 'Training session'", () => {
  assert.equal(plannedSessionTitle({ title: "Squat day", own_training: { day_number: 1, days_total: 3, week_number: 1 } }), "Squat day");
  assert.equal(plannedSessionTitle({ template_position: { template_session_index: 4 } }, "Off-season"), "Off-season · session 5");
  assert.equal(plannedSessionTitle({}), "Training session");
});
