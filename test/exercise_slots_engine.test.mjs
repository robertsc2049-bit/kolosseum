// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { describeProgrammeSlots, phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";

const ACTIVITIES = Object.keys(JSON.parse(fs.readFileSync("registries/activity/activity.registry.json", "utf8")).entries);
const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const LEVELS = ["beginner", "amateur", "pro"];
const EVENTS = ["bench_only", "deadlift_only", "push_pull", "squat_only"];
const cycle = (slot, days = 3) => ({ macro_phase: "pre_season", meso_week: 2, days_per_week: days, session_slot: slot });
const phaseFor = { season: "pre_season", meet: "intensification", event: "build" };
const modelOf = (activity) => (["powerlifting", "olympic_weightlifting", "strongman", "street_lifting", "general_strength"].includes(activity) ? "meet"
  : ["rugby_union", "rugby_league", "rugby_sevens", "american_football", "ice_hockey", "football_soccer", "basketball", "netball", "volleyball", "field_hockey", "cricket", "tennis"].includes(activity) ? "season" : "event");

const run = (activity, level, slot, selections, extra = {}, constraints = { constraints_version: "1.0.0" }) => {
  const input = { activity_id: activity, experience_level: level, training_cycle: { ...cycle(slot), macro_phase: phaseFor[modelOf(activity)] }, ...extra };
  if (selections !== undefined) input.exercise_selections = selections;
  return phase4AssembleProgram(input, { constraints });
};
const slotsOf = (activity, level, extra = {}) => describeProgrammeSlots({ activity_id: activity, experience_level: level, days_per_week: 3, ...extra });
// One choice per open slot, distinct within each day (the same exercise twice in a session is refused).
const chooseAll = (days, pick = (ids) => ids[0]) => Object.fromEntries(days.flatMap((d) => {
  const used = new Set(d.items.filter((i) => i.kind === "fixed").map((i) => i.exercise_id));
  return d.items.filter((i) => i.kind === "slot").map((i) => {
    const options = i.recommended_exercise_ids.filter((id) => !used.has(id));
    const choice = pick(options.length ? options : i.recommended_exercise_ids);
    used.add(choice);
    return [i.slot_id, choice];
  });
}));

test("exercise slots: without declared choices the engine keeps today's programme exactly", () => {
  for (const activity of ACTIVITIES) {
    const r = run(activity, "amateur", 0);
    assert.equal(r.ok, true, activity);
  }
});

test("exercise slots: declaring choices but leaving slots empty refuses the session and names every empty slot of that day", () => {
  for (const activity of ACTIVITIES) {
    const days = slotsOf(activity, "amateur");
    const r = run(activity, "amateur", 0, {});
    const open = days[0].items.filter((i) => i.kind === "slot").map((i) => i.slot_id);
    if (open.length === 0) {
      assert.equal(r.ok, true, `${activity}: a day with nothing open needs no choices`);
      continue;
    }
    assert.equal(r.ok, false, activity);
    assert.equal(r.failure_token, "exercise_selection_required");
    assert.deepEqual(r.details.missing_slot_ids, open, `${activity}: the day's open slots, in order`);
  }
});

test("exercise slots: every sport, level and event gets the athlete's own exercises in every slot, and named lifts stay named", () => {
  let sessions = 0;
  for (const activity of ACTIVITIES) {
    for (const level of LEVELS) {
      const events = activity === "powerlifting" ? [undefined, ...EVENTS] : [undefined];
      for (const competition_event of events) {
        const extra = competition_event ? { competition_event } : {};
        const days = slotsOf(activity, level, extra);
        for (const pick of [(ids) => ids[0], (ids) => ids[ids.length - 1]]) {
          const selections = chooseAll(days, pick);
          for (const [slot, day] of days.entries()) {
            const r = run(activity, level, slot, selections, extra);
            assert.equal(r.ok, true, `${activity}/${level}/${competition_event ?? "-"}/${day.day_id}: ${r.failure_token} ${JSON.stringify(r.details)}`);
            const planned = r.program.planned_items;
            const expected = day.items.map((i) => (i.kind === "fixed" ? i.exercise_id : selections[i.slot_id]));
            assert.deepEqual(planned.map((x) => x.exercise_id), expected.slice(0, planned.length), `${activity}/${level}/${day.day_id}`);
            sessions++;
          }
        }
      }
    }
  }
  assert.ok(sessions > 150, `checked ${sessions} sessions`);
});

test("exercise slots: competition lifts, race stations, event implements and timed-group movements are never open", () => {
  const fixedIn = (activity, extra = {}) => new Set(slotsOf(activity, "amateur", extra).flatMap((d) => d.items.filter((i) => i.kind === "fixed").map((i) => i.exercise_id)));
  const slotsIn = (activity, extra = {}) => slotsOf(activity, "amateur", extra).flatMap((d) => d.items.filter((i) => i.kind === "slot"));
  for (const lift of ["back_squat", "paused_bench_press", "deadlift"]) assert.ok(fixedIn("powerlifting").has(lift), `powerlifting ${lift}`);
  assert.ok(fixedIn("powerlifting", { competition_event: "bench_only" }).has("paused_bench_press"));
  for (const lift of ["snatch", "power_clean", "push_jerk"]) assert.ok(fixedIn("olympic_weightlifting").has(lift), lift);
  for (const station of ["sled_push", "sled_drag", "wall_ball", "burpee_broad_jump", "sandbag_lunge", "tempo_run"]) assert.ok(fixedIn("hyrox").has(station), station);
  for (const implement of ["yoke_walk", "strongman_log_press", "axle_bar_press"]) assert.ok(fixedIn("strongman").has(implement), implement);
  for (const lift of ["pull_up", "dip"]) assert.ok(fixedIn("street_lifting").has(lift), lift);
  for (const move of ["burpee", "air_squat", "thruster"]) assert.ok(fixedIn("crossfit").has(move), `crossfit metcon ${move}`);
  // Everything else is open: a rugby or boxing programme names nothing.
  assert.equal(fixedIn("rugby_union").size, 0);
  assert.equal(fixedIn("boxing").size, 0);
  assert.ok(slotsIn("rugby_union").length >= 15);
});

test("exercise slots: what is recommended for a slot - same pattern and kind of work, allowed for the sport, suitable for the level - and nothing is locked out", () => {
  const days = slotsOf("rugby_union", "amateur");
  const base = chooseAll(days, (ids) => ids[ids.length - 1]);
  const dayA = days.find((d) => d.day_id === "a");
  const hinge = dayA.items.find((i) => i.kind === "slot" && i.movement_pattern_id === "hinge");
  const jump = dayA.items.find((i) => i.kind === "slot" && i.explosive);
  // A choice outside the recommendations is still the athlete's to make: the
  // session is built with it, and the listing says why it is not recommended.
  const accept = (slotId, exerciseId, issue) => {
    const selections = { ...base, [slotId]: exerciseId };
    const r = run("rugby_union", "amateur", 0, selections);
    assert.equal(r.ok, true, `${slotId} <- ${exerciseId}`);
    assert.ok(r.program.planned_items.some((e) => e.exercise_id === exerciseId), `${exerciseId} is in the session`);
    const listed = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3, selections })
      .flatMap((d) => d.items).find((i) => i.slot_id === slotId);
    assert.equal(listed.selected_exercise_id, exerciseId);
    assert.equal(listed.selected_fit_issue, issue, `${slotId} <- ${exerciseId}`);
  };
  accept(hinge.slot_id, "bench_press", "movement_pattern_mismatch");
  accept(hinge.slot_id, "kettlebell_swing", "work_type_mismatch");
  accept(hinge.slot_id, "power_clean", "work_type_mismatch");
  accept(jump.slot_id, "back_squat", "movement_pattern_mismatch");
  accept(hinge.slot_id, "romanian_deadlift", null);
  // Only an exercise that does not exist is refused.
  const unknown = run("rugby_union", "amateur", 0, { ...base, [hinge.slot_id]: "made_up_lift" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.details.reason, "unknown_exercise");
  assert.ok(hinge.recommended_exercise_ids.includes("romanian_deadlift"));
  assert.ok(!hinge.recommended_exercise_ids.includes("kettlebell_swing"), "a heavy hinge slot never offers a ballistic swing");
  // Beginners are never recommended advanced lifts or reactive plyometrics.
  const beginnerDays = slotsOf("rugby_union", "beginner");
  const beginnerSlots = beginnerDays.flatMap((d) => d.items.filter((i) => i.kind === "slot"));
  for (const slot of beginnerSlots) {
    for (const id of slot.recommended_exercise_ids) {
      assert.notEqual(REGISTRY[id].difficulty_tier, "advanced", `beginner offered ${id}`);
      assert.ok(!["pogo_jump", "depth_jump", "repeated_broad_jump", "lateral_bound", "box_jump"].includes(id), `beginner offered ${id}`);
    }
  }
  // The same exercise twice in one session is refused.
  const dayB = days.find((d) => d.day_id === "b").items.filter((i) => i.kind === "slot" && i.movement_pattern_id === "horizontal_push");
  const pushSlots = slotsOf("powerlifting", "amateur", { competition_event: "bench_only" }).find((d) => d.day_id === "volume").items.filter((i) => i.kind === "slot" && i.movement_pattern_id === "horizontal_push");
  assert.equal(pushSlots.length, 2);
  const benchWeek = chooseAll(slotsOf("powerlifting", "amateur", { competition_event: "bench_only" }), (ids) => ids[ids.length - 1]);
  const dup = phase4AssembleProgram({ activity_id: "powerlifting", experience_level: "amateur", competition_event: "bench_only",
    training_cycle: { macro_phase: "intensification", meso_week: 2, days_per_week: 3, session_slot: 1 },
    exercise_selections: { ...benchWeek, [pushSlots[0].slot_id]: "close_grip_bench_press", [pushSlots[1].slot_id]: "close_grip_bench_press" } }, { constraints: { constraints_version: "1.0.0" } });
  assert.equal(dup.ok, false);
  assert.equal(dup.details.reason, "duplicate_in_session");
  assert.ok(dayB.length >= 1);
});

test("exercise slots: a declared joint to protect is left out of the recommendations, but choosing such an exercise is allowed and flagged", () => {
  const knee = { constraints_version: "1.0.0", avoid_joint_stress_tags: ["knee"] };
  const days = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3, constraints: { avoid_joint_stress_tags: ["knee"] } });
  for (const slot of days.flatMap((d) => d.items.filter((i) => i.kind === "slot"))) {
    for (const id of slot.recommended_exercise_ids) assert.ok(!(REGISTRY[id].joint_stress_tags ?? []).includes("knee"), `knee-sparing slot offered ${id}`);
  }
  const all = chooseAll(slotsOf("rugby_union", "amateur"), (ids) => ids[ids.length - 1]);
  const squatSlot = slotsOf("rugby_union", "amateur").find((d) => d.day_id === "c").items.find((i) => i.kind === "slot" && i.movement_pattern_id === "squat");
  const r = phase4AssembleProgram({ activity_id: "rugby_union", experience_level: "amateur", training_cycle: cycle(2), exercise_selections: { ...all, [squatSlot.slot_id]: "back_squat" } }, { constraints: knee });
  assert.equal(r.ok, true, "the athlete's own choice is never locked out");
  const listed = describeProgrammeSlots({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3,
    constraints: { avoid_joint_stress_tags: ["knee"] }, selections: { ...all, [squatSlot.slot_id]: "back_squat" } })
    .flatMap((d) => d.items).find((i) => i.slot_id === squatSlot.slot_id);
  assert.equal(listed.selected_fit_issue, "joint_stress_avoided");
});

test("exercise slots: every open slot, in every sport, level and event, recommends at least one exercise", () => {
  for (const activity of ACTIVITIES) {
    for (const level of LEVELS) {
      const events = activity === "powerlifting" ? [undefined, ...EVENTS] : [undefined];
      for (const competition_event of events) {
        for (const days of [3, 1]) {
          for (const day of describeProgrammeSlots({ activity_id: activity, experience_level: level, competition_event, days_per_week: days })) {
            for (const slot of day.items.filter((i) => i.kind === "slot")) {
              assert.ok(slot.recommended_exercise_ids.length > 0, `${activity}/${level}/${competition_event ?? "-"}/${day.day_id} ${slot.slot_id} has no options`);
            }
          }
        }
      }
    }
  }
});

test("exercise slots: phase 1 accepts well-formed choices and refuses malformed ones", () => {
  const base = { consent_granted: true, engine_version: "EB2-1.0.0", enum_bundle_version: "EB2-1.0.0", phase1_schema_version: "1.0.0", actor_type: "athlete", execution_scope: "individual",
    activity_id: "rugby_union", nd_mode: false, instruction_density: "standard", exposure_prompt_density: "standard", bias_mode: "none" };
  const ok = phase1Validate({ ...base, exercise_selections: { "b.horizontal_pull_1": "seated_cable_row", "a.hinge_1": "romanian_deadlift" } });
  assert.equal(ok.ok, true);
  assert.deepEqual(Object.keys(ok.canonical_input.exercise_selections), ["a.hinge_1", "b.horizontal_pull_1"], "canonical order");
  assert.equal(Object.prototype.hasOwnProperty.call(phase1Validate(base).canonical_input, "exercise_selections"), false);
  for (const bad of [{ "no_dot": "x" }, { "a.hinge_1": 5 }, { "a.Hinge_1": "x" }, { "a.hinge_1": "Romanian Deadlift" }, Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`a.s_${i}`, "x"]))]) {
    const r = phase1Validate({ ...base, exercise_selections: bad });
    assert.equal(r.ok, false, JSON.stringify(bad).slice(0, 60));
    assert.equal(r.failure_token, "type_mismatch");
  }
});
