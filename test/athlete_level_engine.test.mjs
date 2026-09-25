
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { templateForLevel } from "../dist/engine/src/phases/phase4/templates.js";

function phase1Input(extra = {}) {
  return {
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
    bias_mode: "none",
    ...extra
  };
}

test("athlete level: phase 1 accepts each declared level and carries it into the canonical input", () => {
  for (const level of ["beginner", "amateur", "pro"]) {
    const r = phase1Validate(phase1Input({ experience_level: level }));
    assert.equal(r.ok, true, `${level} must validate`);
    assert.equal(r.canonical_input.experience_level, level);
  }
});

test("athlete level: an undeclared level stays absent so pre-level inputs keep their canonical shape", () => {
  const r = phase1Validate(phase1Input());
  assert.equal(r.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(r.canonical_input, "experience_level"), false);
});

test("athlete level: an unknown level is refused, never silently mapped", () => {
  for (const bad of ["expert", "intermediate", "", "PRO"]) {
    const r = phase1Validate(phase1Input({ experience_level: bad }));
    assert.equal(r.ok, false, `${JSON.stringify(bad)} must be refused`);
    assert.equal(r.failure_token, "type_mismatch");
  }
});

const ENTRY = {
  activity_id: "powerlifting",
  template_id: "PROGRAM_TEST_V1",
  exercise_eligibility: ["back_squat", "deadlift"],
  item_prescriptions: [
    { sets: 5, reps: 3, intensity: { type: "percent_1rm", value: 80 }, rest_seconds: 180 },
    { sets: 3, reps: 3, intensity: { type: "percent_1rm", value: 82 }, rest_seconds: 240 }
  ],
  level_variants: {
    beginner: {
      exercise_eligibility: ["goblet_squat"],
      item_prescriptions: [{ sets: 3, reps: 8, intensity: { type: "rpe", value: 6 }, rest_seconds: 90 }]
    }
  }
};

test("athlete level: a declared variant wins; amateur, unknown and variant-less levels use the base entry", () => {
  assert.deepEqual(templateForLevel(ENTRY, "beginner").intent, ["goblet_squat"]);
  assert.deepEqual(templateForLevel(ENTRY, "amateur").intent, ["back_squat", "deadlift"]);
  assert.deepEqual(templateForLevel(ENTRY, "pro").intent, ["back_squat", "deadlift"], "no pro variant falls back to base");
  assert.deepEqual(templateForLevel(ENTRY, undefined).intent, ["back_squat", "deadlift"]);
  assert.equal(templateForLevel(ENTRY, "beginner").program_id, "PROGRAM_TEST_V1");
});

test("athlete level: phase 4 reads the canonical level and serves that level's prescriptions", () => {
  const constraints = { constraints: { constraints_version: "1.0.0" } };
  const base = phase4AssembleProgram({ activity_id: "powerlifting" }, constraints);
  const pro = phase4AssembleProgram({ activity_id: "powerlifting", experience_level: "pro" }, constraints);
  assert.equal(base.ok, true);
  assert.equal(pro.ok, true);
  // Same competition lifts, but the pro variant's heavier top sets.
  assert.deepEqual(pro.program.planned_items.slice(0, 3).map((x) => [x.exercise_id, x.sets, x.reps, x.intensity.value]),
    [["back_squat", 5, 2, 85], ["paused_bench_press", 5, 3, 80], ["deadlift", 4, 2, 87]]);
  assert.deepEqual(base.program.planned_items.slice(0, 3).map((x) => [x.exercise_id, x.sets, x.reps, x.intensity.value]),
    [["back_squat", 5, 3, 80], ["paused_bench_press", 5, 3, 77], ["deadlift", 3, 3, 82]]);
});

// --- Level content (every activity declares beginner and pro variants) ---

import fs from "node:fs";
const ACTIVITIES = Object.keys(JSON.parse(fs.readFileSync("registries/activity/activity.registry.json", "utf8")).entries);
const APPLICABILITY = JSON.parse(fs.readFileSync("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json", "utf8")).entries;
const plan = (activity, level) => {
  const input = level ? { activity_id: activity, experience_level: level } : { activity_id: activity };
  const r = phase4AssembleProgram(input, { constraints: { constraints_version: "1.0.0" } });
  assert.equal(r.ok, true, `${activity}/${level ?? "amateur"} must assemble`);
  return r.program.planned_items;
};
const totalSets = (items) => items.reduce((n, it) => n + it.sets, 0);
const REACTIVE = /pogo_jump|depth_jump|repeated_broad_jump|lateral_bound|box_jump/;

test("athlete level: every activity has a distinct beginner, amateur and pro session of training-allowed exercises", () => {
  for (const activity of ACTIVITIES) {
    const sessions = ["beginner", "amateur", "pro"].map((level) => plan(activity, level));
    for (const [i, items] of sessions.entries()) {
      for (const it of items) {
        assert.equal(APPLICABILITY[`${it.exercise_id}__${activity}__training`]?.applicability_state, "allowed",
          `${activity}/${["beginner", "amateur", "pro"][i]}: ${it.exercise_id} must be training-allowed`);
      }
    }
    const [b, a, p] = sessions.map((items) => JSON.stringify(items.map((x) => [x.exercise_id, x.sets, x.reps, x.intensity])));
    assert.notEqual(b, a, `${activity}: beginner must differ from amateur`);
    assert.notEqual(p, a, `${activity}: pro must differ from amateur`);
    assert.deepEqual(plan(activity, "amateur"), plan(activity), `${activity}: amateur is the base programme`);
  }
});

test("athlete level: beginners get no % 1RM work (no tested max yet), no reactive plyometrics and no more volume than amateurs", () => {
  for (const activity of ACTIVITIES) {
    const beginner = plan(activity, "beginner");
    for (const it of beginner) {
      assert.notEqual(it.intensity.type, "percent_1rm", `${activity}: beginner ${it.exercise_id} must not be % 1RM`);
      if (it.intensity.type === "rpe") assert.ok(it.intensity.value <= 7, `${activity}: beginner ${it.exercise_id} RPE <= 7`);
      assert.doesNotMatch(it.exercise_id, REACTIVE, `${activity}: beginner must not plan reactive plyometrics`);
    }
    assert.ok(totalSets(beginner) <= totalSets(plan(activity, "amateur")), `${activity}: beginner volume <= amateur`);
  }
});

test("athlete level: pros get at least amateur volume, and endurance pros keep amateur volume (minimum effective dose)", () => {
  const ENDURANCE = ["athletics", "swimming", "cycling", "rowing", "kayaking", "triathlon"];
  for (const activity of ACTIVITIES) {
    const pro = totalSets(plan(activity, "pro"));
    const amateur = totalSets(plan(activity, "amateur"));
    if (ENDURANCE.includes(activity)) assert.equal(pro, amateur, `${activity}: pro keeps amateur volume`);
    else assert.ok(pro >= amateur, `${activity}: pro volume >= amateur`);
  }
});

test("athlete level: strength-sport beginners still learn their competition lifts, just lighter", () => {
  const ids = (a) => plan(a, "beginner").map((x) => x.exercise_id);
  for (const lift of ["back_squat", "bench_press", "deadlift"]) assert.ok(ids("powerlifting").includes(lift), `powerlifting beginner: ${lift}`);
  for (const lift of ["snatch", "power_clean", "push_jerk"]) assert.ok(ids("olympic_weightlifting").includes(lift), `weightlifting beginner: ${lift}`);
  assert.ok(ids("street_lifting").includes("band_assisted_pull_up"), "street lifting beginner: assisted pull-up");
  assert.ok(!ids("street_lifting").includes("muscle_up"), "street lifting beginner: no muscle-ups");
});

test("athlete level: the CrossFit AMRAP group survives at every level", () => {
  for (const level of ["beginner", "amateur", "pro"]) {
    const amrap = plan("crossfit", level).filter((x) => x.group_type === "amrap");
    assert.equal(amrap.length, 3, `crossfit/${level}: 3-movement AMRAP`);
    assert.ok(amrap.every((x) => x.group_time_cap_seconds === 720));
  }
});

// Carries, sleds, sprints, runs and static holds are dosed by distance or time;
// "4 x 1 rep" of a yoke walk is not a prescription an athlete can execute.
const DISTANCE_OR_TIME = /carry|sled|sprint|acceleration|_run$|yoke_walk|static_hold/;

test("athlete level: every carry, sled, sprint, run and hold is prescribed by distance or time at every level", () => {
  let checked = 0;
  for (const activity of ACTIVITIES) {
    for (const level of ["beginner", "amateur", "pro"]) {
      for (const it of plan(activity, level).filter((x) => DISTANCE_OR_TIME.test(x.exercise_id))) {
        const hasDistance = typeof it.distance_value === "number" && it.distance_value > 0 && it.distance_unit === "meters";
        const hasDuration = Number.isInteger(it.duration_seconds) && it.duration_seconds > 0;
        assert.ok(hasDistance !== hasDuration, `${activity}/${level} ${it.exercise_id}: exactly one of distance or duration`);
        assert.equal(it.reps, 1, `${activity}/${level} ${it.exercise_id}: one rep is one length or one hold`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 50, `expected the distance/time items across all levels, saw ${checked}`);
});

test("athlete level: distance and time doses match the coaching intent", () => {
  const dose = (activity, level, id) => {
    const it = plan(activity, level).find((x) => x.exercise_id === id);
    assert.ok(it, `${activity}/${level}: ${id} planned`);
    return it.distance_value ?? `${it.duration_seconds}s`;
  };
  assert.equal(dose("hyrox", "amateur", "tempo_run"), 1000, "HYROX runs 1 km repeats (race run segment)");
  assert.equal(dose("hyrox", "pro", "sled_push"), 25, "HYROX sled push in 25 m lengths");
  assert.equal(dose("strongman", "beginner", "yoke_walk"), 20);
  assert.equal(dose("strongman", "pro", "farmers_carry"), 30);
  assert.equal(dose("rugby_sevens", "amateur", "ten_metre_acceleration"), 10);
  assert.equal(dose("rugby_sevens", "amateur", "flying_twenty_sprint"), 20);
  assert.equal(dose("judo", "beginner", "trap_bar_static_hold"), "20s");
});
