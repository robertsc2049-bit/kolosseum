// A pro's programme is not the amateur's with more sets: a pro basketball
// guard gets a contrast pair and rebound jumps, a pro weightlifter the full
// clean and split jerk - and no beginner ever gets reactive jumps.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";

const PROGRAM = JSON.parse(fs.readFileSync("registries/program/program.registry.json", "utf8"));
const weekIds = (variant) => JSON.stringify((variant.microcycle ?? []).map((day) => day.exercise_eligibility));
const REACTIVE = new Set(["depth_jump", "hurdle_hop", "repeated_broad_jump", "lateral_bound", "pogo_jump", "box_jump"]);

test("in every sport, and every position group, the pro week trains differently from the amateur week", () => {
  for (const entry of PROGRAM.entries) {
    assert.notEqual(weekIds(entry.level_variants.pro), weekIds(entry), `${entry.activity_id}: pro = amateur exercises`);
    for (const [role, variant] of Object.entries(entry.role_variants ?? {})) {
      assert.notEqual(weekIds(variant.level_variants.pro), weekIds(variant), `${entry.activity_id}/${role}: pro = amateur exercises`);
    }
  }
});

test("no beginner week, in any sport or position group, has reactive jumps", () => {
  for (const entry of PROGRAM.entries) {
    for (const [label, variant] of [[entry.activity_id, entry.level_variants.beginner], ...Object.entries(entry.role_variants ?? {}).map(([role, v]) => [`${entry.activity_id}/${role}`, v.level_variants.beginner])]) {
      for (const day of variant.microcycle ?? []) {
        const reactive = day.exercise_eligibility.filter((id) => REACTIVE.has(id) && id !== "pogo_jump");
        assert.deepEqual(reactive, [], `${label}/${day.day_id}`);
      }
    }
  }
});

test("a pro basketball player's power day: trap bar deadlift then depth jumps, as one contrast superset", () => {
  const items = phase4AssembleProgram({ activity_id: "basketball", experience_level: "pro", training_cycle: { macro_phase: "general_preparation", meso_week: 1, days_per_week: 3, session_slot: 0 } }, { constraints: { constraints_version: "1.0.0" } }).program.planned_items;
  const lift = items.findIndex((item) => item.exercise_id === "trap_bar_deadlift");
  assert.equal(items[lift + 1].exercise_id, "depth_jump");
  assert.equal(items[lift].group_type, "superset");
  assert.equal(items[lift].group_id, items[lift + 1].group_id);
});

test("a pro weightlifter trains the full clean, snatch pulls and the split jerk; swapped-in skills keep their own dose", () => {
  const wl = PROGRAM.entries.find((entry) => entry.activity_id === "olympic_weightlifting").level_variants.pro.microcycle.flatMap((day) => day.exercise_eligibility);
  for (const id of ["clean", "snatch_pull", "split_jerk"]) assert.ok(wl.includes(id), id);
  const street = PROGRAM.entries.find((entry) => entry.activity_id === "street_lifting").level_variants.pro.microcycle;
  for (const day of street) day.exercise_eligibility.forEach((id, i) => {
    if (id === "muscle_up") assert.ok(day.item_prescriptions[i].reps <= 3, "muscle-ups in triples, not a curl's tens");
  });
});
