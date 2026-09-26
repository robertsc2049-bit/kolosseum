// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { templateForCycle, validateProgramRegistry } from "../dist/engine/src/phases/phase4/templates.js";
import { MACRO_PHASES_BY_MODEL, cycleModelFor, sessionsPerWeek } from "../dist/engine/src/phases/phase4/periodisation.js";

const ACTIVITIES = Object.keys(JSON.parse(fs.readFileSync("registries/activity/activity.registry.json", "utf8")).entries);
const LEVELS = ["beginner", "amateur", "pro"];

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
const cycle = (macro_phase, meso_week = 2, days_per_week = 3, session_slot = 0) => ({ macro_phase, meso_week, days_per_week, session_slot });

const run = (activity, level, training_cycle, extra = {}) => {
  const input = { activity_id: activity, experience_level: level, ...extra };
  if (training_cycle) input.training_cycle = training_cycle;
  const r = phase4AssembleProgram(input, { constraints: { constraints_version: "1.0.0" } });
  assert.equal(r.ok, true, `${activity}/${level}/${JSON.stringify(training_cycle)} must assemble`);
  return r.program;
};
const primaries = (program) => program.planned_items.filter((x) => x.role === "primary" && !x.group_id);
const pct = (program) => primaries(program).filter((x) => x.intensity.type === "percent_1rm").map((x) => x.intensity.value);
const sets = (items) => items.reduce((n, x) => n + x.sets, 0);

test("periodisation: every activity has a cycle model, and phase 1 accepts exactly that model's phases", () => {
  for (const activity of ACTIVITIES) {
    const model = cycleModelFor(activity);
    assert.ok(model, `${activity} has a cycle model`);
    for (const phases of Object.values(MACRO_PHASES_BY_MODEL)) {
      for (const phase of phases) {
        const r = phase1Validate(phase1Input({ activity_id: activity, training_cycle: cycle(phase) }));
        const expected = MACRO_PHASES_BY_MODEL[model].includes(phase);
        assert.equal(r.ok, expected, `${activity} (${model}) ${phase}: ${expected ? "accepted" : "refused"}`);
        if (expected) assert.deepEqual(r.canonical_input.training_cycle, cycle(phase));
        else assert.equal(r.failure_token, "type_mismatch");
      }
    }
  }
});

test("periodisation: malformed cycles are refused, and an undeclared cycle stays absent", () => {
  for (const bad of [
    cycle("accumulation", 0), cycle("accumulation", 5), cycle("accumulation", 2, 0), cycle("accumulation", 2, 7),
    cycle("accumulation", 2, 3, 3), cycle("accumulation", 2, 3, -1), { ...cycle("accumulation"), extra: 1 }, { macro_phase: "accumulation" }
  ]) {
    const r = phase1Validate(phase1Input({ training_cycle: bad }));
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.failure_token, "type_mismatch");
  }
  const none = phase1Validate(phase1Input());
  assert.equal(Object.prototype.hasOwnProperty.call(none.canonical_input, "training_cycle"), false);
});

test("periodisation: no declared cycle keeps the exact single-session programme", () => {
  for (const activity of ACTIVITIES) {
    const program = run(activity, "amateur");
    assert.equal(program.training_cycle, undefined, activity);
  }
});

test("mesocycle: three loading weeks build intensity, then week 4 deloads volume and load", () => {
  for (const activity of ["powerlifting", "rugby_union", "olympic_weightlifting"]) {
    const phase = MACRO_PHASES_BY_MODEL[cycleModelFor(activity)][1];
    const w = [1, 2, 3, 4].map((week) => run(activity, "amateur", cycle(phase, week)));
    const [p1, p2, p3, p4] = w.map(pct);
    assert.ok(p1.length > 0, `${activity} has % 1RM primaries`);
    for (let i = 0; i < p1.length; i++) {
      assert.ok(p1[i] < p2[i] && p2[i] < p3[i], `${activity}: week 1 < 2 < 3 (${p1[i]}, ${p2[i]}, ${p3[i]})`);
      assert.ok(p4[i] < p1[i], `${activity}: deload is the lightest week`);
    }
    assert.ok(sets(w[3].planned_items) < sets(w[1].planned_items) * 0.75, `${activity}: deload cuts volume`);
    assert.equal(w[3].training_cycle.deload, true);
    assert.equal(w[1].training_cycle.deload, false);
  }
});

test("macrocycle: general preparation builds volume, specific phases sharpen, in-season maintains, taper and transition unload", () => {
  // Strength sport: accumulation > intensification in volume; peak heavier with fewer reps.
  const acc = run("powerlifting", "amateur", cycle("accumulation"));
  const int = run("powerlifting", "amateur", cycle("intensification"));
  const peak = run("powerlifting", "amateur", cycle("peak"));
  assert.ok(sets(acc.planned_items) > sets(int.planned_items), "accumulation has more volume");
  assert.ok(Math.max(...pct(acc)) < Math.max(...pct(int)), "accumulation is lighter");
  assert.ok(Math.min(...pct(peak)) > Math.min(...pct(int)), "peak is heavier");
  assert.ok(primaries(peak).every((x, i) => x.reps <= primaries(int)[i].reps), "peak never adds reps");

  // Team sport: in-season keeps intensity, drops volume.
  const pre = run("rugby_union", "amateur", cycle("pre_season"));
  const inSeason = run("rugby_union", "amateur", cycle("in_season"));
  assert.ok(sets(inSeason.planned_items) < sets(pre.planned_items), "in-season is lower volume");
  assert.deepEqual(pct(inSeason), pct(pre), "in-season holds intensity");

  // Event sport: taper roughly halves the build volume.
  const build = run("boxing", "amateur", cycle("build"));
  const taper = run("boxing", "amateur", cycle("taper"));
  assert.ok(sets(taper.planned_items) <= Math.ceil(sets(build.planned_items) * 0.6), "taper halves volume");

  // Transition: two easy sets by effort, no % 1RM, anywhere.
  for (const activity of ACTIVITIES) {
    const t = run(activity, "pro", cycle("transition"));
    for (const it of t.planned_items.filter((x) => !x.group_id)) {
      assert.equal(it.sets, 2, `${activity} ${it.exercise_id}: 2 sets`);
      assert.notEqual(it.intensity.type, "percent_1rm", `${activity} ${it.exercise_id}: no % 1RM in transition`);
      if (it.intensity.type === "rpe") assert.ok(it.intensity.value <= 6);
    }
  }
});

test("microcycle: strength sessions a week follow the phase, whatever days the athlete has", () => {
  assert.equal(sessionsPerWeek("off_season", 5), 5);
  assert.equal(sessionsPerWeek("in_season", 5), 2);
  assert.equal(sessionsPerWeek("taper", 4), 2);
  assert.equal(sessionsPerWeek("transition", 6), 2);
  assert.equal(sessionsPerWeek("peak", 6), 3);
  assert.equal(sessionsPerWeek("in_season", 1), 1);
});

const RX = (sets, reps) => ({ sets, reps, intensity: { type: "rpe", value: 7 }, rest_seconds: 90 });
const TEMPLATE = {
  program_id: "PROGRAM_TEST_V1",
  intent: ["back_squat", "bench_press"],
  prescriptions: [RX(4, 5), RX(4, 5)],
  microcycle: [
    { day_id: "a", focus: "lower_power", exercise_eligibility: ["box_jump", "back_squat"], item_prescriptions: [RX(4, 3), RX(4, 5)] },
    { day_id: "b", focus: "upper_strength", exercise_eligibility: ["bench_press", "pull_up"], item_prescriptions: [RX(4, 5), RX(4, 6)] },
    { day_id: "c", focus: "full_body_strength", exercise_eligibility: ["deadlift", "overhead_press"], item_prescriptions: [RX(3, 5), RX(3, 6)] }
  ]
};

test("microcycle: sessions rotate through the week; one session a week is the full-body base; in-season uses the first two", () => {
  const focus = (c) => templateForCycle(TEMPLATE, "rugby_union", c, "amateur").training_cycle.day_focus;
  assert.deepEqual([0, 1, 2].map((slot) => focus(cycle("pre_season", 2, 3, slot))), ["lower_power", "upper_strength", "full_body_strength"]);
  assert.deepEqual([0, 1, 2, 3, 4].map((slot) => focus(cycle("pre_season", 2, 5, slot))),
    ["lower_power", "upper_strength", "full_body_strength", "lower_power", "upper_strength"], "5 days rotate A B C A B");
  assert.equal(focus(cycle("pre_season", 2, 1, 0)), "full_body", "1 day a week trains the full-body base session");
  assert.deepEqual([0, 1, 2, 3].map((slot) => focus(cycle("in_season", 2, 4, slot))), ["lower_power", "upper_strength", "lower_power", "upper_strength"]);
  const oneDay = templateForCycle(TEMPLATE, "rugby_union", cycle("pre_season", 2, 1, 0), "amateur");
  assert.deepEqual(oneDay.intent, TEMPLATE.intent);
  assert.deepEqual(templateForCycle(TEMPLATE, "rugby_union", cycle("pre_season", 2, 3, 1), "amateur").intent, ["bench_press", "pull_up"]);
});

test("microcycle: registry validation bounds the week and its sessions", () => {
  const doc = (microcycle) => ({ registry_id: "program", version: "1.0.0", entries: [{ activity_id: "rugby_union", template_id: "T", exercise_eligibility: ["back_squat"], microcycle }] });
  assert.equal(validateProgramRegistry(doc(TEMPLATE.microcycle)).entries[0].microcycle.length, 3);
  assert.throws(() => validateProgramRegistry(doc(TEMPLATE.microcycle.slice(0, 1))), /2-4 sessions/);
  assert.throws(() => validateProgramRegistry(doc([...TEMPLATE.microcycle, ...TEMPLATE.microcycle.slice(0, 2)])), /2-4 sessions|duplicated/);
  assert.throws(() => validateProgramRegistry(doc([TEMPLATE.microcycle[0], { ...TEMPLATE.microcycle[1], day_id: "a" }])), /duplicated/);
  assert.throws(() => validateProgramRegistry(doc([TEMPLATE.microcycle[0], { ...TEMPLATE.microcycle[1], focus: "Upper Body" }])), /focus invalid/);
  assert.throws(() => validateProgramRegistry(doc([TEMPLATE.microcycle[0], { ...TEMPLATE.microcycle[1], item_prescriptions: [RX(3, 5)] }])), /align 1:1/);
});

test("periodisation: level ceilings, timed groups and distance/time doses hold in every phase and week", () => {
  let checked = 0;
  for (const activity of ACTIVITIES) {
    const phases = MACRO_PHASES_BY_MODEL[cycleModelFor(activity)];
    const base = Object.fromEntries(LEVELS.map((level) => [level, run(activity, level).planned_items]));
    for (const level of LEVELS) {
      for (const phase of phases) {
        for (const week of [1, 2, 3, 4]) {
          const program = run(activity, level, cycle(phase, week));
          for (const it of program.planned_items) {
            if (it.intensity.type === "percent_1rm") {
              assert.notEqual(level, "beginner", `${activity}/${phase}/w${week}: beginners never get % 1RM`);
              assert.ok(it.intensity.value >= 40 && it.intensity.value <= 95, `${activity} ${it.exercise_id} % in range`);
            }
            if (it.intensity.type === "rpe") assert.ok(it.intensity.value <= (level === "beginner" ? 7 : 9), `${activity}/${level} ${it.exercise_id} RPE ceiling`);
            if (it.distance_value !== undefined || it.duration_seconds !== undefined) assert.equal(it.reps, 1, `${activity} ${it.exercise_id} keeps 1 rep per length/hold`);
            assert.ok(it.sets >= 1);
          }
          const groups = (items) => items.filter((x) => x.group_id).map((x) => [x.exercise_id, x.sets, x.reps, x.group_time_cap_seconds]);
          assert.deepEqual(groups(program.planned_items), groups(base[level]), `${activity}/${level}/${phase}/w${week}: timed groups untouched`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1400, `checked ${checked} activity x level x phase x week sessions`);
});

test("periodisation: the session output records where it sits in the plan", () => {
  const program = run("rugby_union", "pro", cycle("in_season", 4, 5, 3));
  assert.deepEqual(program.training_cycle, {
    macro_phase: "in_season", meso_week: 4, days_per_week: 5, session_slot: 3,
    cycle_model: "season", sessions_per_week: 2, day_index: 0, day_focus: "full_body", deload: true
  });
});

// Power work is low-volume, full-recovery quality work; doubling eccentric
// (Nordic) volume invites the hamstring injury it is there to prevent.
test("general preparation never adds sets or reps to jumps, sprints, throws, Olympic lifts, conditioning or Nordics", () => {
  const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
  const protectedWork = (id) => REGISTRY[id]?.fast_execution === true || id === "nordic_curl" || id === "glute_ham_raise";
  const GENERAL = { season: "off_season", meet: "accumulation", event: "base" };
  const BUILD = { season: "pre_season", meet: "intensification", event: "build" };
  let checked = 0;
  for (const activity of ACTIVITIES) {
    const model = cycleModelFor(activity);
    for (const level of LEVELS) {
      for (const slot of [0, 1, 2]) {
        const general = run(activity, level, cycle(GENERAL[model], 2, 3, slot)).planned_items;
        const build = run(activity, level, cycle(BUILD[model], 2, 3, slot)).planned_items;
        for (const [i, it] of general.entries()) {
          if (it.group_id || !protectedWork(it.exercise_id)) continue;
          assert.equal(it.exercise_id, build[i].exercise_id);
          assert.deepEqual([it.sets, it.reps], [build[i].sets, build[i].reps], `${activity}/${level} ${it.exercise_id}: ${it.sets}x${it.reps} in general prep vs ${build[i].sets}x${build[i].reps}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 100, `checked ${checked} power/eccentric items`);
  // Strength lifts still build volume in general preparation.
  const acc = run("rugby_union", "amateur", cycle("off_season")).planned_items.find((x) => x.exercise_id === "trap_bar_deadlift");
  const pre = run("rugby_union", "amateur", cycle("pre_season")).planned_items.find((x) => x.exercise_id === "trap_bar_deadlift");
  assert.ok(acc.sets > pre.sets && acc.reps > pre.reps, "trap-bar deadlift still gains sets and reps off-season");
});
