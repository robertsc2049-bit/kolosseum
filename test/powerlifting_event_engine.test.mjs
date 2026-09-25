// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { entryForEvent, templateForLevel, validateProgramRegistry } from "../dist/engine/src/phases/phase4/templates.js";

const EVENTS = ["full_power", "bench_only", "deadlift_only", "push_pull", "squat_only"];
const LEVELS = ["beginner", "amateur", "pro"];
const APPLICABILITY = JSON.parse(fs.readFileSync("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json", "utf8")).entries;

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

const plan = (event, level, timebox) => {
  const input = { activity_id: "powerlifting", experience_level: level };
  if (event) input.competition_event = event;
  const constraints = { constraints_version: "1.0.0" };
  if (timebox) constraints.schedule = { session_timebox_minutes: timebox };
  const r = phase4AssembleProgram(input, { constraints });
  assert.equal(r.ok, true, `powerlifting/${event}/${level} must assemble`);
  return r.program.planned_items;
};
const ids = (items) => items.map((x) => x.exercise_id);

test("powerlifting event: phase 1 accepts each event for powerlifting and carries it into the canonical input", () => {
  for (const event of EVENTS) {
    const r = phase1Validate(phase1Input({ competition_event: event }));
    assert.equal(r.ok, true, `${event} must validate`);
    assert.equal(r.canonical_input.competition_event, event);
  }
  const none = phase1Validate(phase1Input());
  assert.equal(Object.prototype.hasOwnProperty.call(none.canonical_input, "competition_event"), false, "undeclared stays absent");
});

test("powerlifting event: unknown events, and events on any other sport, are refused", () => {
  for (const bad of ["bench", "full_meet", "", "BENCH_ONLY"]) {
    const r = phase1Validate(phase1Input({ competition_event: bad }));
    assert.equal(r.ok, false, `${JSON.stringify(bad)} must be refused`);
    assert.equal(r.failure_token, "type_mismatch");
  }
  for (const activity_id of ["general_strength", "strongman", "rugby_union"]) {
    const r = phase1Validate(phase1Input({ activity_id, competition_event: "bench_only" }));
    assert.equal(r.ok, false, `${activity_id} must not accept a powerlifting event`);
    assert.equal(r.failure_token, "type_mismatch");
  }
});

test("powerlifting event: a declared event variant replaces the base; full power, none or undeclared events keep it", () => {
  const entry = {
    activity_id: "powerlifting",
    template_id: "PROGRAM_TEST_V1",
    exercise_eligibility: ["back_squat"],
    item_prescriptions: [{ sets: 5, reps: 3, intensity: { type: "percent_1rm", value: 80 }, rest_seconds: 180 }],
    level_variants: { pro: { exercise_eligibility: ["pin_squat"], item_prescriptions: [{ sets: 4, reps: 3, intensity: { type: "rpe", value: 8 }, rest_seconds: 180 }] } },
    event_variants: {
      bench_only: {
        exercise_eligibility: ["paused_bench_press"],
        item_prescriptions: [{ sets: 5, reps: 3, intensity: { type: "percent_1rm", value: 80 }, rest_seconds: 180 }],
        level_variants: { beginner: { exercise_eligibility: ["bench_press"], item_prescriptions: [{ sets: 4, reps: 5, intensity: { type: "rpe", value: 6 }, rest_seconds: 150 }] } }
      }
    }
  };
  const resolve = (event, level) => templateForLevel(entryForEvent(entry, event), level).intent;
  assert.deepEqual(resolve("bench_only", "amateur"), ["paused_bench_press"]);
  assert.deepEqual(resolve("bench_only", "beginner"), ["bench_press"]);
  assert.deepEqual(resolve("bench_only", "pro"), ["paused_bench_press"], "an event without a pro variant uses the event base, never full power's pro");
  for (const event of ["full_power", undefined, "deadlift_only"]) {
    assert.deepEqual(resolve(event, "amateur"), ["back_squat"], `${event} keeps the base`);
    assert.deepEqual(resolve(event, "pro"), ["pin_squat"], `${event} keeps the base's level variants`);
  }
});

test("powerlifting event: registry validation refuses a full_power or unknown event variant", () => {
  const doc = (event_variants) => ({
    registry_id: "program",
    version: "1.0.0",
    entries: [{ activity_id: "powerlifting", template_id: "T", exercise_eligibility: ["back_squat"], event_variants }]
  });
  const variant = { exercise_eligibility: ["bench_press"], item_prescriptions: [{ sets: 3, reps: 5, intensity: { type: "rpe", value: 7 }, rest_seconds: 120 }] };
  assert.equal(validateProgramRegistry(doc({ bench_only: variant })).entries[0].event_variants.bench_only.exercise_eligibility[0], "bench_press");
  assert.throws(() => validateProgramRegistry(doc({ full_power: variant })), /full_power is the base entry/);
  assert.throws(() => validateProgramRegistry(doc({ bench: variant })), /may only declare/);
  assert.throws(() => validateProgramRegistry(doc({ bench_only: { exercise_eligibility: [] } })), /non-empty/);
});

test("powerlifting event: every event x level is its own session of training-allowed exercises", () => {
  const seen = new Set();
  for (const event of EVENTS) {
    for (const level of LEVELS) {
      const items = plan(event, level);
      for (const id of ids(items)) {
        assert.equal(APPLICABILITY[`${id}__powerlifting__training`]?.applicability_state, "allowed", `${event}/${level}: ${id} allowed`);
      }
      const key = JSON.stringify(items.map((x) => [x.exercise_id, x.sets, x.reps, x.intensity]));
      assert.ok(!seen.has(key), `${event}/${level} must differ from every other event x level`);
      seen.add(key);
    }
  }
  assert.equal(seen.size, 15);
});

test("powerlifting event: full power is the unchanged base programme", () => {
  for (const level of LEVELS) assert.deepEqual(plan("full_power", level), plan(undefined, level), level);
});

// The competition lift(s) are primaries, so even a 20-minute session (which
// prunes every accessory) still trains the event.
const EVENT_LIFTS = {
  bench_only: { beginner: ["bench_press"], amateur: ["paused_bench_press"], pro: ["paused_bench_press"] },
  deadlift_only: { beginner: ["deadlift"], amateur: ["deadlift"], pro: ["deadlift"] },
  push_pull: { beginner: ["bench_press", "deadlift"], amateur: ["paused_bench_press", "deadlift"], pro: ["paused_bench_press", "deadlift"] },
  squat_only: { beginner: ["back_squat"], amateur: ["back_squat"], pro: ["back_squat"] }
};

test("powerlifting event: each event leads with its competition lift(s), which survive the shortest session", () => {
  for (const [event, byLevel] of Object.entries(EVENT_LIFTS)) {
    for (const level of LEVELS) {
      const full = ids(plan(event, level));
      const lifts = byLevel[level];
      assert.deepEqual(full.slice(0, lifts.length), lifts, `${event}/${level} leads with ${lifts.join(" + ")}`);
      const short = ids(plan(event, level, 20));
      assert.ok(short.length < full.length, `${event}/${level}: a 20-minute session is pruned`);
      for (const lift of lifts) assert.ok(short.includes(lift), `${event}/${level}: ${lift} survives a 20-minute session`);
    }
  }
});

test("powerlifting event: single-lift events do not train the other competition lifts as primaries", () => {
  const primaries = (event, level) => plan(event, level).filter((x) => x.role === "primary").map((x) => x.exercise_id);
  for (const level of ["amateur", "pro"]) {
    assert.ok(!primaries("bench_only", level).some((x) => /squat|deadlift/.test(x)), `bench_only/${level}`);
    assert.ok(!primaries("push_pull", level).some((x) => /squat/.test(x)), `push_pull/${level}: squat is an accessory`);
    assert.ok(!primaries("squat_only", level).some((x) => /bench|^deadlift$/.test(x)), `squat_only/${level}`);
  }
});

test("powerlifting event: beginners train by effort (no % 1RM), keep work on the other lifts, and pros out-work amateurs", () => {
  const sets = (items) => items.reduce((n, x) => n + x.sets, 0);
  for (const event of EVENTS) {
    const beginner = plan(event, "beginner");
    assert.ok(beginner.every((x) => x.intensity.type !== "percent_1rm"), `${event}/beginner: no % 1RM`);
    assert.ok(sets(plan(event, "pro")) >= sets(plan(event, "amateur")), `${event}: pro volume >= amateur`);
    assert.ok(sets(beginner) <= sets(plan(event, "amateur")), `${event}: beginner volume <= amateur`);
  }
  const b = (event) => ids(plan(event, "beginner")).join(" ");
  assert.match(b("bench_only"), /squat/, "bench-only beginners still squat");
  assert.match(b("deadlift_only"), /squat/);
  assert.match(b("deadlift_only"), /bench/);
  assert.match(b("squat_only"), /deadlift/);
  assert.match(b("squat_only"), /bench/);
});
