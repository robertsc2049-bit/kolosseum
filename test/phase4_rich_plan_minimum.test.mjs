
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Phase4 is compiled under dist/engine/... (node runs .mjs tests, so import JS output).
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { buildPlannedItems } from "../dist/engine/src/phases/phase4/planned_items.js";
import { loadExerciseEntriesFromPath } from "../dist/engine/src/registries/loadExerciseEntries.js";

function mkPhase3(constraints = { constraints_version: "1.0.0" }) {
  return { constraints };
}

function assertNonEmptyString(v, label) {
  assert.equal(typeof v, "string");
  assert.ok(v.trim().length > 0, `${label} must be non-empty`);
}

function assertPositiveInt(v, label) {
  assert.equal(typeof v, "number");
  assert.ok(Number.isInteger(v), `${label} must be an integer`);
  assert.ok(v > 0, `${label} must be > 0`);
}

function assertPlannedItem(it, index) {
  assertNonEmptyString(it.block_id, `planned_items[${index}].block_id`);
  assertNonEmptyString(it.item_id, `planned_items[${index}].item_id`);
  assertNonEmptyString(it.exercise_id, `planned_items[${index}].exercise_id`);

  assertPositiveInt(it.sets, `planned_items[${index}].sets`);
  assertPositiveInt(it.reps, `planned_items[${index}].reps`);
}

function assertStableUnique(list, label) {
  assert.ok(Array.isArray(list), `${label} must be an array`);
  const trimmed = list.map((x) => String(x).trim());

  for (let i = 0; i < trimmed.length; i++) {
    assert.ok(trimmed[i].length > 0, `${label}[${i}] must be non-empty`);
  }

  const set = new Set(trimmed);
  assert.equal(set.size, trimmed.length, `${label} must contain unique ids`);
}

function assertPhase4PlanContract(program, { minItems = 2 } = {}) {
  assertNonEmptyString(program.program_id, "program.program_id");
  assertNonEmptyString(program.version, "program.version");

  assert.ok(Array.isArray(program.planned_items), "program.planned_items must be an array");
  assert.ok(program.planned_items.length >= minItems, `program.planned_items must have >= ${minItems} items`);

  assert.ok(Array.isArray(program.planned_exercise_ids), "program.planned_exercise_ids must be an array");
  assert.equal(
    program.planned_exercise_ids.length,
    program.planned_items.length,
    "program.planned_exercise_ids length must equal planned_items length"
  );

  for (let i = 0; i < program.planned_items.length; i++) {
    assertPlannedItem(program.planned_items[i], i);
  }

  const fromItems = program.planned_items.map((x) => x.exercise_id);
  assert.deepEqual(
    program.planned_exercise_ids,
    fromItems,
    "program.planned_exercise_ids must equal planned_items.exercise_id (same order)"
  );

  assertStableUnique(program.planned_exercise_ids, "program.planned_exercise_ids");

  assertNonEmptyString(program.target_exercise_id, "program.target_exercise_id");
  assert.equal(
    program.target_exercise_id,
    program.planned_exercise_ids[0],
    "program.target_exercise_id must equal planned_exercise_ids[0]"
  );

  assert.ok(Array.isArray(program.exercises), "program.exercises must be an array");

  assert.ok(program.exercise_pool !== null && program.exercise_pool !== undefined, "program.exercise_pool must exist");
  assert.equal(typeof program.exercise_pool, "object");
  assert.ok(!Array.isArray(program.exercise_pool), "program.exercise_pool must be a map/object");

  for (const id of program.planned_exercise_ids) {
    assert.ok(program.exercise_pool[id], `exercise_pool must include planned id: ${id}`);
  }
}

function mkInput(activity_id, tbMinutes) {
  const base = { activity_id };
  if (typeof tbMinutes === "number") {
    base.constraints = {
      constraints_version: "1.0.0",
      schedule: { session_timebox_minutes: tbMinutes }
    };
  }
  return base;
}

function assertTimeboxPlan(program, expectedLen, expectedAccessoryCount) {
  assertPhase4PlanContract(program, { minItems: Math.min(2, expectedLen) });

  assert.equal(program.planned_items.length, expectedLen, `planned_items length must be ${expectedLen}`);

  const primaries = program.planned_items.filter((x) => x.role === "primary");
  const accessories = program.planned_items.filter((x) => x.role === "accessory");

  assert.equal(primaries.length, 4, "must keep all 4 primaries");
  assert.equal(accessories.length, expectedAccessoryCount, `accessory count must be ${expectedAccessoryCount}`);
}

function registryPathFromRepoRoot() {
  return path.join(process.cwd(), "registries", "exercise", "exercise.registry.json");
}

function loadEntriesForTest() {
  const regPath = registryPathFromRepoRoot();
  const entries = loadExerciseEntriesFromPath(regPath);
  return { regPath, entries };
}

test("Phase4: supported activities emit a rich, stable plan contract (powerlifting)", () => {
  const canonicalInput = { activity_id: "powerlifting" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assert.ok(r.program, "result.program must exist");

  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 6, "powerlifting planned_items length must be 6");
});

test("Phase4: supported activities emit a rich, stable plan contract (rugby_union)", () => {
  const canonicalInput = { activity_id: "rugby_union" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 7, "rugby_union planned_items length must be 7 (includes neck work)");
});

test("Phase4: supported activities emit a rich, stable plan contract (general_strength)", () => {
  const canonicalInput = { activity_id: "general_strength" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 6, "general_strength planned_items length must be 6");
});

test("Phase4: timebox pruning (powerlifting) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 6, 2);
  }
});

test("Phase4: timebox pruning (rugby_union) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 7, 3);
  }
});

test("Phase4: timebox pruning (general_strength) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 6, 2);
  }
});

// Every activity athletes can declare must assemble a program: a missing
// program-registry entry fails compile for that sport's athletes outright,
// coach-assigned ones included (this happened to hyrox). Each planned exercise
// must also be training-allowed for the activity it was planned for.
test("Phase4: every registry activity assembles a program of training-allowed exercises", () => {
  const activityDoc = JSON.parse(fs.readFileSync(path.resolve("registries/activity/activity.registry.json"), "utf8"));
  const activityIds = Object.keys(activityDoc.entries ?? activityDoc);
  assert.ok(activityIds.includes("hyrox"), "activity registry must include hyrox");

  const applicabilityDoc = JSON.parse(fs.readFileSync(
    path.resolve("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json"),
    "utf8"
  ));
  const trainingAllowed = new Set(
    Object.values(applicabilityDoc.entries ?? applicabilityDoc)
      .filter((row) => row.activity_context === "training" && row.applicability_state === "allowed")
      .map((row) => `${row.activity_id}::${row.exercise_id}`)
  );

  for (const activityId of activityIds) {
    const r = phase4AssembleProgram(mkInput(activityId), mkPhase3());
    assert.equal(r.ok, true, `${activityId} must assemble a program (got ${r.failure_token ?? "no token"})`);
    assertPhase4PlanContract(r.program, { minItems: 2 });

    for (const exerciseId of r.program.planned_exercise_ids) {
      assert.ok(
        trainingAllowed.has(`${activityId}::${exerciseId}`),
        `${activityId} planned ${exerciseId}, which is not training-allowed for it`
      );
    }
  }
});

// An Olympic weightlifting programme must be built from the sport's own lifts at
// weightlifting rep ranges - not the generic squat/bench/deadlift block, and
// not 4x5 snatches.
test("Phase4: olympic_weightlifting plans the classic lifts with their declared prescriptions", () => {
  const r = phase4AssembleProgram(mkInput("olympic_weightlifting"), mkPhase3());
  assert.equal(r.ok, true);
  assertPhase4PlanContract(r.program, { minItems: 2 });

  const plan = r.program.planned_items.map((it) => [it.exercise_id, it.sets, it.reps, it.intensity.value, it.rest_seconds]);
  assert.deepEqual(plan, [
    ["snatch", 5, 2, 75, 150],
    ["power_clean", 4, 2, 75, 150],
    ["push_jerk", 4, 2, 75, 150],
    ["front_squat", 4, 3, 80, 180],
    ["snatch_grip_deadlift", 3, 3, 75, 150]
  ]);
  for (const generic of ["bench_press", "incline_bench_press", "push_up", "overhead_press"]) {
    assert.ok(!r.program.planned_exercise_ids.includes(generic), `olympic_weightlifting must not plan ${generic}`);
  }
});

// Timebox pruning still drops the accessory pull but keeps every declared
// prescription on the classic lifts.
test("Phase4: olympic_weightlifting timebox keeps the classic lifts' declared prescriptions", () => {
  const r = phase4AssembleProgram(mkInput("olympic_weightlifting", 25), mkPhase3());
  assert.equal(r.ok, true);
  assert.deepEqual(r.program.planned_exercise_ids, ["snatch", "power_clean", "push_jerk", "front_squat"]);
  assert.equal(r.program.planned_items[0].reps, 2);
});

// A strongman programme must train the sport's implements and overhead work,
// and prescribe carries by effort (one run per set), not as % 1RM reps.
test("Phase4: strongman plans log press, yoke and carries with their declared prescriptions", () => {
  const r = phase4AssembleProgram(mkInput("strongman"), mkPhase3());
  assert.equal(r.ok, true);
  assertPhase4PlanContract(r.program, { minItems: 2 });

  const plan = r.program.planned_items.map((it) => [it.exercise_id, it.sets, it.reps, it.intensity.type, it.intensity.value]);
  assert.deepEqual(plan, [
    ["strongman_log_press", 5, 3, "percent_1rm", 75],
    ["deadlift", 4, 3, "percent_1rm", 80],
    ["yoke_walk", 4, 1, "rpe", 8],
    ["zercher_squat", 3, 5, "percent_1rm", 70],
    ["farmers_carry", 3, 1, "rpe", 8],
    ["romanian_deadlift", 3, 8, "percent_1rm", 65]
  ]);
  for (const it of r.program.planned_items.filter((x) => x.exercise_id.includes("carry") || x.exercise_id === "yoke_walk")) {
    assert.notEqual(it.intensity.type, "percent_1rm", `${it.exercise_id} must not be prescribed as % 1RM`);
  }
});

// A CrossFit class is strength + a scored metcon + skill work - not a bodyweight
// movement like toes-to-bar prescribed as % 1RM.
test("Phase4: crossfit plans a strength lift, a 12-minute AMRAP metcon and skill work", () => {
  const r = phase4AssembleProgram(mkInput("crossfit"), mkPhase3());
  assert.equal(r.ok, true);
  assertPhase4PlanContract(r.program, { minItems: 2 });

  const plan = r.program.planned_items.map((it) => [it.exercise_id, it.sets, it.reps, it.intensity.type, it.group_type ?? null]);
  assert.deepEqual(plan, [
    ["power_clean", 5, 3, "percent_1rm", null],
    ["pull_up", 1, 5, "bodyweight", "amrap"],
    ["burpee", 1, 10, "bodyweight", "amrap"],
    ["air_squat", 1, 15, "bodyweight", "amrap"],
    ["toes_to_bar", 3, 10, "bodyweight", null],
    ["double_under", 3, 50, "bodyweight", null]
  ]);
  for (const it of r.program.planned_items.filter((x) => x.group_id)) {
    assert.equal(it.group_id, "metcon");
    assert.equal(it.group_time_cap_seconds, 720);
    assert.equal(it.rest_seconds, 0);
  }
});

// Timebox pruning only drops accessories, so the metcon group survives whole.
test("Phase4: crossfit short timebox keeps the whole AMRAP group", () => {
  const r = phase4AssembleProgram(mkInput("crossfit", 25), mkPhase3());
  assert.equal(r.ok, true);
  assert.deepEqual(r.program.planned_exercise_ids, ["power_clean", "pull_up", "burpee", "air_squat"]);
  assert.equal(r.program.planned_items.filter((x) => x.group_type === "amrap").length, 3);
});

// Team sports get the gym (S&C) work that supports the sport: power first,
// then strength, then that sport's injury-resilience work - and never the
// generic bench/press-up/overhead-press block, nor each other's session.
const TEAM_SPORTS = [
  "rugby_union", "rugby_league", "rugby_sevens", "american_football", "football_soccer", "field_hockey",
  "ice_hockey", "netball", "basketball", "volleyball", "cricket", "tennis"
];
const POWER = /jump|sprint|acceleration|bound|throw|drop_to_stick|deceleration/;
const NECK_SPORTS = ["rugby_union", "rugby_league", "rugby_sevens", "american_football", "ice_hockey", "boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"];

test("Phase4: every team sport gets its own power-first S&C session", () => {
  const plans = new Map();
  for (const activity of TEAM_SPORTS) {
    const r = phase4AssembleProgram(mkInput(activity), mkPhase3());
    assert.equal(r.ok, true, `${activity} must assemble`);
    const ids = r.program.planned_exercise_ids;
    assert.equal(ids.length, NECK_SPORTS.includes(activity) ? 7 : 6, `${activity} plan length`);
    for (const generic of ["bench_press", "incline_bench_press", "push_up", "overhead_press"]) {
      assert.ok(!ids.includes(generic), `${activity} must not plan generic ${generic}`);
    }
    assert.match(ids[0], POWER, `${activity} must open with power/speed work, got ${ids[0]}`);
    plans.set(activity, ids.join(","));
  }
  assert.equal(new Set(plans.values()).size, TEAM_SPORTS.length, "no two team sports may share a session");
});

test("Phase4: team sports include each sport's own injury-resilience work", () => {
  const ids = (activity) => phase4AssembleProgram(mkInput(activity), mkPhase3()).program.planned_exercise_ids;
  for (const a of ["football_soccer", "rugby_union", "rugby_league", "rugby_sevens", "american_football", "field_hockey", "netball"]) {
    assert.ok(ids(a).includes("nordic_curl"), `${a}: hamstring (Nordic) work`);
  }
  for (const a of ["football_soccer", "ice_hockey"]) assert.ok(ids(a).includes("cable_hip_adduction"), `${a}: adductor work`);
  for (const a of ["netball", "basketball", "volleyball"]) assert.ok(ids(a).includes("drop_to_stick"), `${a}: landing mechanics`);
  for (const a of ["volleyball", "cricket", "tennis"]) assert.ok(ids(a).includes("cable_external_rotation"), `${a}: shoulder care`);
  for (const a of ["cricket", "tennis"]) assert.ok(ids(a).some((x) => /rotational/.test(x)), `${a}: rotational power`);
  // Volleyball players already take very high jump counts in practice: keep gym plyometrics to landing work only.
  assert.equal(ids("volleyball").filter((x) => /jump|bound/.test(x)).length, 0, "volleyball: no extra jump volume");
});

// Endurance athletes already carry huge sport volume: strength work is a
// minimum effective dose - explosive first, low-rep heavy work, the sport's
// own resilience work, and no generic pressing or hypertrophy volume.
const ENDURANCE_SPORTS = ["athletics", "swimming", "cycling", "rowing", "kayaking", "triathlon"];

test("Phase4: endurance sports get a minimum-effective-dose strength session", () => {
  const plans = new Set();
  for (const activity of ENDURANCE_SPORTS) {
    const r = phase4AssembleProgram(mkInput(activity), mkPhase3());
    assert.equal(r.ok, true, `${activity} must assemble`);
    const items = r.program.planned_items;
    const ids = r.program.planned_exercise_ids;
    assert.match(ids[0], POWER, `${activity} must open with explosive work, got ${ids[0]}`);
    for (const generic of ["bench_press", "incline_bench_press", "push_up", "overhead_press"]) {
      assert.ok(!ids.includes(generic), `${activity} must not plan generic ${generic}`);
    }
    for (const it of items.filter((x) => x.intensity.type === "percent_1rm")) {
      assert.ok(it.reps <= 6, `${activity} ${it.exercise_id}: loaded work stays low-rep, got ${it.reps}`);
    }
    const totalSets = items.reduce((n, it) => n + it.sets, 0);
    assert.ok(totalSets <= 21, `${activity}: low total volume, got ${totalSets} sets`);
    plans.add(ids.join(","));
  }
  assert.equal(plans.size, ENDURANCE_SPORTS.length, "no two endurance sports may share a session");

  const ids = (a) => phase4AssembleProgram(mkInput(a), mkPhase3()).program.planned_exercise_ids;
  assert.ok(ids("swimming").includes("cable_external_rotation"), "swimming: shoulder care");
  assert.ok(!ids("swimming").some((x) => /overhead_press|landmine_press/.test(x)), "swimming: no added overhead pressing");
  assert.ok(ids("triathlon").includes("single_leg_calf_raise"), "triathlon: calf/Achilles resilience");
  assert.ok(ids("athletics").includes("nordic_curl"), "athletics: hamstring resilience");
});

// Fighters make weight, so strength work stays low-rep with no hypertrophy
// volume; grapplers need pulling and grip, strikers rotational power.
const COMBAT_SPORTS = ["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"];

test("Phase4: combat sports get power, pulling and grip work without hypertrophy volume", () => {
  const plans = new Set();
  const ids = (a) => phase4AssembleProgram(mkInput(a), mkPhase3()).program.planned_exercise_ids;
  for (const activity of COMBAT_SPORTS) {
    const r = phase4AssembleProgram(mkInput(activity), mkPhase3());
    assert.equal(r.ok, true, `${activity} must assemble`);
    const items = r.program.planned_items;
    assert.match(items[0].exercise_id, POWER, `${activity} must open with power work`);
    for (const generic of ["bench_press", "incline_bench_press", "push_up", "overhead_press"]) {
      assert.ok(!r.program.planned_exercise_ids.includes(generic), `${activity} must not plan generic ${generic}`);
    }
    for (const it of items.filter((x) => x.intensity.type === "percent_1rm")) {
      assert.ok(it.reps <= 6, `${activity} ${it.exercise_id}: no hypertrophy-range loaded work`);
    }
    assert.ok(r.program.planned_exercise_ids.some((x) => /chin_up|pull_up|row/.test(x)), `${activity}: pulling strength`);
    plans.add(r.program.planned_exercise_ids.join(","));
  }
  assert.equal(plans.size, COMBAT_SPORTS.length, "no two combat sports may share a session");
  for (const a of ["wrestling", "judo", "brazilian_jiu_jitsu"]) assert.ok(ids(a).includes("trap_bar_static_hold"), `${a}: grip strength`);
  for (const a of ["boxing", "muay_thai", "judo"]) assert.ok(ids(a).includes("rotational_medicine_ball_throw"), `${a}: rotational power`);
});

// General strength: every major movement pattern once, novice-safe loading.
test("Phase4: general_strength covers every major pattern with novice-safe loading", () => {
  const r = phase4AssembleProgram(mkInput("general_strength"), mkPhase3());
  assert.equal(r.ok, true);
  const ids = r.program.planned_exercise_ids;
  assert.deepEqual(ids, ["trap_bar_deadlift", "goblet_squat", "dumbbell_bench_press", "single_arm_dumbbell_row", "farmers_carry", "pallof_press"]);
  for (const it of r.program.planned_items.filter((x) => x.intensity.type === "percent_1rm")) {
    assert.ok(it.intensity.value <= 75, `${it.exercise_id}: no heavy % 1RM work for an unknown-level adult`);
  }
});

// Street lifting: weighted pull-up and dip by effort, never % 1RM of added load.
test("Phase4: street_lifting trains weighted pull-up and dip by effort, without muscle-up volume", () => {
  const r = phase4AssembleProgram(mkInput("street_lifting"), mkPhase3());
  assert.equal(r.ok, true);
  const [pull, dip] = r.program.planned_items;
  assert.equal(pull.exercise_id, "pull_up");
  assert.equal(dip.exercise_id, "dip");
  for (const it of [pull, dip]) assert.equal(it.intensity.type, "rpe", `${it.exercise_id} must be prescribed by effort`);
  assert.ok(!r.program.planned_exercise_ids.includes("muscle_up"), "no muscle-up volume without an athlete level");
  assert.ok(r.program.planned_exercise_ids.includes("face_pull"), "elbow/shoulder care");
});

// HYROX is half running: the programme must run, and sleds/bodyweight
// stations have no 1RM, so nothing may be prescribed as % 1RM.
test("Phase4: hyrox runs, and prescribes every station by effort (never % 1RM)", () => {
  const r = phase4AssembleProgram(mkInput("hyrox"), mkPhase3());
  assert.equal(r.ok, true);
  const ids = r.program.planned_exercise_ids;
  assert.equal(ids[0], "tempo_run", "hyrox must include race-effort running");
  for (const it of r.program.planned_items) {
    assert.notEqual(it.intensity.type, "percent_1rm", `${it.exercise_id} must not be prescribed as % 1RM`);
  }
  for (const station of ["sled_push", "sled_drag", "wall_ball", "sandbag_lunge", "burpee_broad_jump"]) {
    assert.ok(ids.includes(station), `hyrox: ${station}`);
  }
});

// Powerlifting: the three competition lifts as top sets (competition-style
// paused bench), no generic overhead/incline/push-up filler.
test("Phase4: powerlifting trains squat, paused bench and deadlift as low-rep top sets", () => {
  const r = phase4AssembleProgram(mkInput("powerlifting"), mkPhase3());
  assert.equal(r.ok, true);
  const plan = r.program.planned_items.slice(0, 3).map((it) => [it.exercise_id, it.reps, it.intensity.value]);
  assert.deepEqual(plan, [["back_squat", 3, 80], ["paused_bench_press", 3, 77], ["deadlift", 3, 82]]);
  for (const generic of ["overhead_press", "incline_bench_press", "push_up"]) {
    assert.ok(!r.program.planned_exercise_ids.includes(generic), `powerlifting must not plan ${generic}`);
  }
});

// Collision (rugby, American football, ice hockey) and combat sports need neck strength. It sits in the first
// accessory slot, which timebox pruning keeps in 30-44 minute sessions.
test("Phase4: collision and combat programmes include neck work that survives a shorter session", () => {
  for (const activity of NECK_SPORTS) {
    const full = phase4AssembleProgram(mkInput(activity), mkPhase3()).program.planned_items;
    const neck = full[4];
    assert.equal(neck.exercise_id, "self_resisted_neck_isometric", `${activity}: neck work is the first accessory`);
    assert.equal(neck.role, "accessory");
    assert.deepEqual([neck.sets, neck.reps, neck.intensity.type, neck.intensity.value], [3, 4, "rpe", 6]);
    const short = phase4AssembleProgram(mkInput(activity, 40), mkPhase3()).program.planned_exercise_ids;
    assert.ok(short.includes("self_resisted_neck_isometric"), `${activity}: neck work kept at 40 minutes`);
  }
  for (const activity of ["swimming", "cycling", "tennis"]) {
    const ids = phase4AssembleProgram(mkInput(activity), mkPhase3()).program.planned_exercise_ids;
    assert.ok(!ids.some((x) => /neck/.test(x)), `${activity}: no neck work programmed`);
  }
});

// Programs without item_prescriptions keep the default primary/accessory
// prescription exactly (exercised directly now that every activity declares its own).
test("Phase4: planned items without declared prescriptions keep the default prescription", () => {
  const items = buildPlannedItems(["a", "b", "c", "d", "e", "f"], "SESSION_V1", NaN);
  const plan = items.map((it) => [it.sets, it.reps, it.intensity.value, it.rest_seconds]);
  assert.deepEqual(plan, [
    [4, 5, 75, 180], [4, 5, 75, 180], [4, 5, 75, 180], [4, 5, 75, 180],
    [3, 10, 60, 90], [3, 10, 60, 90]
  ]);
});

test("Phase4: unsupported activity fails closed instead of returning a stub program", () => {
  const constraints = { constraints_version: "1.0.0", demo: true };
  const canonicalInput = { activity_id: "unknown_activity" };
  const phase3 = mkPhase3(constraints);

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, false, "phase4AssembleProgram must fail closed for an unrecognised activity_id");
  assert.equal(r.failure_token, "phase4_unsupported_activity");
});

test("Phase4: Phase3 timebox is sovereign over raw input when both are present and disagree", () => {
  const canonicalInput = mkInput("powerlifting", 60);
  const phase3 = mkPhase3({
    constraints_version: "1.0.0",
    schedule: { session_timebox_minutes: 25 }
  });

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true);
  assertTimeboxPlan(r.program, 4, 0);
});

test("Phase4: FAIL HARD if any planned exercise_id is missing from registry (no silent omission) — no disk mutation", () => {
  const { regPath, entries } = loadEntriesForTest();

  assert.ok(entries && typeof entries === "object", "entries must load");
  assert.ok(entries.back_squat, "registry must include back_squat for this test");

  // Remove back_squat (planned by powerlifting) from the injected entries map (no filesystem writes).
  const injected = { ...entries };
  delete injected.back_squat;

  const canonicalInput = { activity_id: "powerlifting" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3, { entries: injected });

  assert.equal(r.ok, false, "phase4AssembleProgram must fail when planned id missing");
  assert.equal(r.failure_token, "PHASE4_MISSING_PLANNED_EXERCISE");
  assert.ok(r.details, "details must exist");
  assert.equal(r.details.registry_path, "INJECTED_ENTRIES", "should report injected registry source");
  assert.ok(Array.isArray(r.details.missing_exercise_ids), "details.missing_exercise_ids must be an array");
  assert.ok(r.details.missing_exercise_ids.includes("back_squat"), "missing list must include back_squat");

  // Extra guard: regPath exists and we didn't touch it; this variable is here to prevent accidental removal.
  assert.ok(typeof regPath === "string" && regPath.length > 0, "regPath must be present");
});
