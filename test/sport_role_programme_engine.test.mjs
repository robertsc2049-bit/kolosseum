// DEV NOTE: Human-maintained repo surface. Position-group programmes: a declared
// position whose group trains differently (rugby forwards/backs, American
// football linemen/skill, football and hockey goalkeepers, an ice hockey
// goaltender, a cricket fast bowler, athletics throws and endurance) selects
// that group's programme through phase1 sport_role_id.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase4AssembleProgram, describeProgrammeSlots } from "../dist/engine/src/phases/phase4.js";
import { entryForRole, validateProgramRegistry } from "../dist/engine/src/phases/phase4/templates.js";

const LEVELS = ["beginner", "amateur", "pro"];
const APPLICABILITY = JSON.parse(fs.readFileSync("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json", "utf8")).entries;
const PROGRAM = JSON.parse(fs.readFileSync("registries/program/program.registry.json", "utf8"));
const ROLES = {
  rugby_union: ["forwards", "backs"],
  rugby_league: ["forwards", "backs"],
  american_football: ["linemen", "skill"],
  football_soccer: ["goalkeeper"],
  field_hockey: ["goalkeeper"],
  ice_hockey: ["goaltender"],
  cricket: ["fast_bowler"],
  athletics: ["throws", "endurance"]
};

const session = (activity, role, level = "amateur", cycle) => {
  const input = { activity_id: activity, experience_level: level };
  if (role) input.sport_role_id = `${activity}__${role}`;
  if (cycle) input.training_cycle = cycle;
  const r = phase4AssembleProgram(input, { constraints: { constraints_version: "1.0.0" } });
  assert.equal(r.ok, true, `${activity}/${role}/${level} must assemble`);
  return r.program.planned_items;
};
const ids = (items) => items.map((i) => i.exercise_id);
const item = (items, id) => items.find((i) => i.exercise_id === id);
const week = (activity, role, level = "amateur") => [0, 1, 2].map((slot) =>
  session(activity, role, level, { macro_phase: "general_preparation", meso_week: 1, days_per_week: 3, session_slot: slot }));

test("phase1 admits a declared sport_role_id and keeps it in the canonical input", () => {
  const r = phase1Validate({
    consent_granted: true, engine_version: "EB2-1.0.0", enum_bundle_version: "EB2-1.0.0", phase1_schema_version: "1.0.0",
    actor_type: "athlete", execution_scope: "individual", activity_id: "rugby_union", sport_role_id: "rugby_union__forwards",
    nd_mode: false, instruction_density: "standard", exposure_prompt_density: "standard", bias_mode: "none"
  });
  assert.equal(r.ok, true);
  assert.equal(r.canonical_input.sport_role_id, "rugby_union__forwards");
});

test("a rugby prop and a wing train differently: the forward lifts heavier and pushes a sled, the back sprints first", () => {
  const prop = session("rugby_union", "forwards");
  const wing = session("rugby_union", "backs");
  assert.notDeepEqual(ids(prop), ids(wing));
  assert.ok(ids(prop).includes("sled_push"), "forwards drive a sled");
  assert.equal(ids(wing)[0], "ten_metre_acceleration", "backs sprint fresh, before lifting");
  assert.ok(!ids(prop).includes("ten_metre_acceleration"));
  assert.ok(item(prop, "trap_bar_deadlift").intensity.value > item(wing, "trap_bar_deadlift").intensity.value, "forwards lift heavier");
  assert.ok(ids(prop).includes("self_resisted_neck_isometric") && ids(wing).includes("self_resisted_neck_isometric"), "every collision player trains the neck");
});

test("every role group trains a different week from its sport's own programme, at every level, with only training-allowed exercises", () => {
  for (const [activity, roles] of Object.entries(ROLES)) {
    for (const level of LEVELS) {
      const base = week(activity, undefined, level).map(ids);
      for (const role of roles) {
        const days = week(activity, role, level);
        assert.notDeepEqual(days.map(ids), base, `${activity}/${role}/${level} differs from the sport's week`);
        for (const day of days) {
          for (const id of ids(day)) {
            assert.equal(APPLICABILITY[`${id}__${activity}__training`]?.applicability_state, "allowed", `${activity}/${role}/${level}: ${id}`);
          }
        }
      }
    }
  }
});

test("a beginner forward keeps the forwards' programme at beginner doses: no % of 1RM, RPE 7 at most", () => {
  const beginner = session("rugby_union", "forwards", "beginner");
  assert.ok(ids(beginner).includes("sled_push"));
  assert.ok(beginner.every((i) => i.intensity.type !== "percent_1rm"), JSON.stringify(beginner.map((i) => i.intensity)));
  assert.ok(beginner.every((i) => i.intensity.type !== "rpe" || i.intensity.value <= 7));
  const pro = session("rugby_union", "forwards", "pro");
  assert.ok(item(pro, "trap_bar_deadlift").intensity.value > item(session("rugby_union", "forwards"), "trap_bar_deadlift").intensity.value, "a pro forward lifts heavier than an amateur");
});

test("a football goalkeeper trains lateral power, not the outfield sprint-and-decelerate week", () => {
  const gk = week("football_soccer", "goalkeeper").map(ids);
  const outfield = week("football_soccer", undefined).map(ids);
  assert.ok(gk[0].includes("lateral_bound"));
  assert.ok(!gk.flat().includes("ten_metre_deceleration"));
  assert.ok(outfield.flat().includes("ten_metre_deceleration"));
});

test("an ice hockey goaltender trains the hips and adductors for the butterfly", () => {
  const days = week("ice_hockey", "goaltender").map(ids).flat();
  assert.ok(days.includes("cable_hip_adduction") && days.includes("machine_hip_adduction"));
  assert.ok(!days.includes("bench_press"), "no heavy barbell bench for a goaltender");
});

test("a fast bowler gets no extra rotational throwing on top of bowling", () => {
  const days = week("cricket", "fast_bowler").map(ids).flat();
  assert.ok(!days.includes("medicine_ball_rotational_throw"));
  assert.ok(week("cricket", undefined).map(ids).flat().includes("medicine_ball_rotational_throw"), "the batters' programme keeps it");
  assert.ok(days.includes("nordic_curl") && days.includes("side_plank"));
});

test("athletics: a thrower squats heavy and throws; a distance runner gets low-volume strength and calf capacity", () => {
  const thrower = session("athletics", "throws");
  assert.ok(ids(thrower).includes("backward_overhead_medicine_ball_throw"));
  assert.ok(item(thrower, "back_squat").intensity.value >= 80);
  const runner = session("athletics", "endurance");
  assert.ok(ids(runner).includes("single_leg_calf_raise"));
  assert.ok(!ids(runner).includes("falling_start_sprint"), "no max-speed sprint work for a distance runner");
  assert.ok(runner.reduce((n, i) => n + i.sets, 0) <= session("athletics", undefined).reduce((n, i) => n + i.sets, 0));
});

test("a role another sport programmes, an unknown role, or no role keeps the sport's own programme", () => {
  const base = ids(session("rugby_union", undefined));
  for (const role of ["rugby_union__goalkeeper", "football_soccer__goalkeeper", "rugby_union__", "rugby_union__field_player"]) {
    const r = phase4AssembleProgram({ activity_id: "rugby_union", sport_role_id: role }, { constraints: { constraints_version: "1.0.0" } });
    assert.equal(r.ok, true);
    assert.deepEqual(ids(r.program.planned_items), base, role);
  }
  const entry = PROGRAM.entries.find((e) => e.activity_id === "powerlifting");
  assert.equal(entryForRole(entry, "powerlifting__forwards"), entry);
  assert.equal(entryForRole(entry, "__proto__"), entry);
});

test("the exercise-choice listing follows the role: a winger's open slots are the backs' slots", () => {
  const base = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3 });
  const backs = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3, sport_role_id: "rugby_union__backs" });
  assert.notDeepEqual(backs, base);
  assert.ok(backs[0].items.length > 0);
});

test("the registry validator refuses a malformed role variant", () => {
  const withRoles = (role_variants) => ({ ...PROGRAM, entries: [{ ...PROGRAM.entries.find((e) => e.activity_id === "rugby_union"), role_variants }] });
  assert.throws(() => validateProgramRegistry(withRoles({})), /role_variants/u);
  assert.throws(() => validateProgramRegistry(withRoles({ "Forwards!": { exercise_eligibility: ["bench_press"], item_prescriptions: [{ sets: 3, reps: 5, rest_seconds: 90, intensity: { type: "bodyweight" } }] } })), /lower_snake_case/u);
  assert.throws(() => validateProgramRegistry(withRoles({ forwards: { exercise_eligibility: [] } })), /exercise_eligibility/u);
});

test("the programme's own exercise comes first in every choice list: a winger's hinge slot offers the trap-bar deadlift first, not block pulls", () => {
  for (const [activity, role] of [["rugby_union", "rugby_union__backs"], ["rugby_union", undefined], ["hyrox", undefined], ["swimming", undefined]]) {
    for (const level of LEVELS) {
      const days = describeProgrammeSlots({ activity_id: activity, experience_level: level, days_per_week: 3, ...(role ? { sport_role_id: role } : {}) });
      for (const day of days) for (const item of day.items.filter((i) => i.kind === "slot")) {
        if (item.programme_pick_exercise_id) assert.equal(item.recommended_exercise_ids[0], item.programme_pick_exercise_id, `${activity}/${level}/${item.slot_id}`);
      }
    }
  }
  const backs = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3, sport_role_id: "rugby_union__backs" });
  const hinge = backs[0].items.find((i) => i.slot_id === "a.hinge_1");
  assert.equal(hinge.programme_pick_exercise_id, "trap_bar_deadlift");
  assert.equal(hinge.recommended_exercise_ids[0], "trap_bar_deadlift");
});

test("combat and court/racket sports each train their own week: a judoka is not a boxer, and tennis is not cricket", () => {
  const ids = (activity) => new Set(week(activity, undefined).flatMap((d) => d.map((i) => i.exercise_id)));
  const overlap = (a, b) => { const A = ids(a), B = ids(b); return [...A].filter((x) => B.has(x)).length / Math.max(A.size, B.size); };
  const families = [["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"], ["netball", "basketball", "volleyball", "tennis", "cricket"]];
  for (const family of families) for (const a of family) for (const b of family) {
    if (a < b) assert.ok(overlap(a, b) <= 0.7, `${a} vs ${b}: ${Math.round(overlap(a, b) * 100)}% the same`);
  }
  const has = (activity, id) => ids(activity).has(id);
  assert.ok(has("wrestling", "neck_lateral_flexion_isometric") && has("wrestling", "barbell_static_hold"), "a wrestler trains neck and grip");
  assert.ok(has("muay_thai", "band_tibialis_raise") && has("muay_thai", "cable_hip_flexion"), "a nak muay trains shins and kicking hips");
  assert.ok(has("boxing", "medicine_ball_chest_pass") && !has("boxing", "barbell_static_hold"), "a boxer trains punching power, not heavy grip");
  assert.ok(has("tennis", "dumbbell_wrist_extension"), "a tennis player trains the forearm extensors");
  assert.ok(has("netball", "drop_to_stick") && has("volleyball", "overhead_medicine_ball_slam"));
});
