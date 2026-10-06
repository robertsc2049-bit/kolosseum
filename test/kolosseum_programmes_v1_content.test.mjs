// Kolosseum programmes v1 (product/programmes/kolosseum_programmes_v1.mjs):
// every programme is one the builder can hold and an athlete can run - real
// exercises, within the builder's limits, sensible loads - and is listed for
// the athletes its design notes say it's for.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";

const registry = JSON.parse(fs.readFileSync(new URL("../registries/exercise/exercise.registry.json", import.meta.url), "utf8")).entries;
const activities = new Set(Object.values(JSON.parse(fs.readFileSync(new URL("../registries/activity/activity.registry.json", import.meta.url), "utf8")).entries).map((a) => a.activity_id));
const sessionsOf = (p) => p.blocks.flatMap((b) => b.weeks.flat());

test("sixteen programmes: general, powerlifting, team, endurance, combat, tennis, cricket and athletics power", () => {
  assert.deepEqual(PROGRAMMES.map((p) => p.key), [
    "beginner_full_body", "intermediate_upper_lower", "powerlifting_meet_prep", "team_sport_off_season", "team_sport_in_season",
    "endurance_run_ride_strength", "endurance_swim_row_paddle_strength", "endurance_in_season", "combat_strength_power", "combat_fight_camp", "tennis_off_season", "tennis_in_season",
    "cricket_off_season", "cricket_in_season", "athletics_power_build", "athletics_competition_season"
  ]);
  assert.equal(new Set(PROGRAMMES.map((p) => p.template_name)).size, PROGRAMMES.length, "names are unique (the seed script skips by name)");
});

test("every exercise is in the exercise registry the builder offers", () => {
  const missing = [];
  for (const p of PROGRAMMES) for (const s of sessionsOf(p)) for (const i of s.items) if (!registry[i.id]) missing.push(`${p.key}: ${i.id}`);
  assert.deepEqual(missing, []);
});

test("every programme fits the builder: 1-12 exercises a session, 1-7 sessions a week, at most 52 weeks a block", () => {
  for (const p of PROGRAMMES) {
    for (const b of p.blocks) {
      assert.ok(b.weeks.length >= 1 && b.weeks.length <= 52, `${p.key}/${b.name}: weeks`);
      assert.ok(["general", "volume", "strength", "peak", "deload", "custom"].includes(b.block_type), `${p.key}/${b.name}: block type`);
      for (const week of b.weeks) {
        assert.ok(week.length >= 1 && week.length <= 7, `${p.key}/${b.name}: sessions a week`);
        for (const s of week) assert.ok(s.items.length >= 1 && s.items.length <= 12, `${p.key}: ${s.title} exercises`);
      }
    }
  }
});

test("loads are sensible: % of 1RM between 50 and 95, RPE between 5 and 9, 1-8 sets, no % on a bodyweight lift", () => {
  for (const p of PROGRAMMES) {
    for (const s of sessionsOf(p)) {
      for (const i of s.items) {
        const where = `${p.key}: ${s.title} ${i.id}`;
        assert.ok(Number.isInteger(i.sets) && i.sets >= 1 && i.sets <= 8, `${where} sets`);
        if (i.load !== "bw" && "pct" in i.load) {
          assert.ok(i.load.pct >= 50 && i.load.pct <= 95, `${where} % ${i.load.pct}`);
          assert.ok(!(registry[i.id].equipment_requirements ?? []).includes("bodyweight"), `${where} is a bodyweight lift with a %`);
        }
        if (i.load !== "bw" && "rpe" in i.load) assert.ok(i.load.rpe >= 5 && i.load.rpe <= 9, `${where} RPE`);
      }
    }
  }
});

test("a beginner never gets more than 85% or a single: the beginner programme stays at 5s and up", () => {
  const beginner = PROGRAMMES.find((p) => p.key === "beginner_full_body");
  for (const s of sessionsOf(beginner)) {
    for (const i of s.items) {
      if (i.load !== "bw" && "pct" in i.load) assert.ok(i.load.pct <= 85, `${s.title} ${i.id} ${i.load.pct}%`);
      if (typeof i.reps === "number") assert.ok(i.reps >= 5, `${s.title} ${i.id} ${i.reps} reps`);
    }
  }
});

test("each programme is listed for the athletes its design notes describe", () => {
  const byKey = Object.fromEntries(PROGRAMMES.map((p) => [p.key, p.listing]));
  assert.deepEqual([byKey.beginner_full_body.levels, byKey.beginner_full_body.activity_ids], [["beginner"], []], "beginner, any sport");
  assert.deepEqual(byKey.intermediate_upper_lower.activity_ids, [], "any sport");
  assert.deepEqual(byKey.powerlifting_meet_prep.activity_ids, ["powerlifting"]);
  for (const key of ["team_sport_off_season", "team_sport_in_season"]) {
    assert.ok(byKey[key].activity_ids.includes("rugby_union") && byKey[key].activity_ids.includes("basketball"), key);
    assert.ok(!byKey[key].levels.includes("beginner"), `${key}: beginners start on the full-body programme`);
  }
  assert.deepEqual(byKey.endurance_run_ride_strength.activity_ids, ["athletics", "cycling", "triathlon"]);
  assert.deepEqual(byKey.endurance_swim_row_paddle_strength.activity_ids, ["swimming", "rowing", "kayaking"]);
  assert.deepEqual([...byKey.endurance_in_season.activity_ids].sort(), ["athletics", "cycling", "kayaking", "rowing", "swimming", "triathlon"]);
  for (const key of ["combat_strength_power", "combat_fight_camp"]) assert.deepEqual([...byKey[key].activity_ids].sort(), ["boxing", "brazilian_jiu_jitsu", "judo", "mma", "muay_thai", "wrestling"], key);
  for (const key of ["tennis_off_season", "tennis_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["tennis"], key);
  for (const key of ["cricket_off_season", "cricket_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["cricket"], key);
  for (const key of ["athletics_power_build", "athletics_competition_season"]) assert.deepEqual(byKey[key].activity_ids, ["athletics"], key);
  for (const p of PROGRAMMES.filter((x) => x.listing.activity_ids.length && x.key !== "powerlifting_meet_prep")) {
    assert.deepEqual(p.listing.levels, ["amateur", "pro"], `${p.key}: beginners in any sport start on the full-body programme`);
  }
  for (const p of PROGRAMMES) {
    for (const id of p.listing.activity_ids) assert.ok(activities.has(id), `${p.key}: ${id} is a real sport`);
    assert.ok(activities.has(p.activity_id), `${p.key}: template activity`);
    assert.ok(p.listing.summary.length > 0 && p.listing.summary.length <= 400, `${p.key}: summary`);
    const firstWeek = p.blocks[0].weeks[0].length;
    assert.equal(p.listing.days_per_week, firstWeek, `${p.key}: days a week matches the first week`);
  }
});

test("the powerlifting peak ends with a taper week of openers, nothing heavier than 90%", () => {
  const pl = PROGRAMMES.find((p) => p.key === "powerlifting_meet_prep");
  const taper = pl.blocks.at(-1);
  assert.equal(taper.block_type, "deload");
  for (const s of taper.weeks.flat()) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok(i.load.pct <= 90, `${s.title} ${i.id}`);
});

test("endurance athletes lift heavy at low reps: no main lift above 8 reps, and at most two sessions a week", () => {
  for (const key of ["endurance_run_ride_strength", "endurance_swim_row_paddle_strength", "endurance_in_season"]) {
    const p = PROGRAMMES.find((x) => x.key === key);
    for (const week of p.blocks.flatMap((b) => b.weeks)) assert.ok(week.length <= 2, `${key}: sessions a week`);
    for (const s of sessionsOf(p)) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok(i.reps <= 8, `${key}: ${s.title} ${i.id}`);
  }
});

test("a fighter tapers into the fight: nothing above 70% in the last fortnight, no barbell work in fight week", () => {
  const camp = PROGRAMMES.find((p) => p.key === "combat_fight_camp");
  const taper = camp.blocks.at(-1);
  assert.equal(taper.block_type, "deload");
  for (const s of taper.weeks.flat()) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok(i.load.pct <= 70, `${s.title} ${i.id}`);
  const fightWeek = taper.weeks.at(-1);
  assert.equal(fightWeek.length, 1, "one primer session in fight week");
  for (const i of fightWeek[0].items) assert.ok(i.load === "bw" || !("pct" in i.load), `fight week ${i.id}`);
});

test("fighters train neck every week; tennis players, and swimmers, rowers and paddlers in and out of race season, train the rotator cuff every week", () => {
  for (const key of ["combat_strength_power", "combat_fight_camp"]) {
    const weeks = PROGRAMMES.find((p) => p.key === key).blocks.flatMap((b) => b.weeks);
    for (const week of weeks) assert.ok(week.some((s) => s.items.some((i) => registry[i.id].movement_pattern_id === "neck_isometric")), `${key}: neck work`);
  }
  for (const key of ["tennis_off_season", "tennis_in_season", "endurance_swim_row_paddle_strength", "endurance_in_season"]) {
    const weeks = PROGRAMMES.find((p) => p.key === key).blocks.flatMap((b) => b.weeks);
    for (const week of weeks) assert.ok(week.some((s) => s.items.some((i) => registry[i.id].movement_pattern_id === "shoulder_external_rotation")), `${key}: rotator cuff`);
  }
});

test("a fast bowler's weekly basics: hamstring, groin, side-trunk and throwing-shoulder work every cricket week", () => {
  const has = (week, check) => week.some((s) => s.items.some((i) => check(i, registry[i.id])));
  for (const key of ["cricket_off_season", "cricket_in_season"]) {
    const weeks = PROGRAMMES.find((p) => p.key === key).blocks.flatMap((b) => b.weeks);
    for (const week of weeks) {
      assert.ok(has(week, (i) => i.id === "nordic_curl"), `${key}: Nordic curls`);
      assert.ok(has(week, (i) => i.id === "machine_hip_adduction"), `${key}: groin`);
      assert.ok(has(week, (i) => i.id === "side_plank"), `${key}: side strain`);
      assert.ok(has(week, (_, r) => r.movement_pattern_id === "shoulder_external_rotation"), `${key}: rotator cuff`);
    }
  }
});

test("sprinters, jumpers and throwers: heavy main lifts at 5 reps or fewer, rising block to block, and Nordic curls every week", () => {
  const build = PROGRAMMES.find((p) => p.key === "athletics_power_build");
  const topSquat = build.blocks.map((b) => Math.max(...b.weeks.flat().flatMap((s) => s.items.filter((i) => i.id === "back_squat").map((i) => i.load.pct))));
  assert.ok(topSquat[0] < topSquat[1] && topSquat[1] < topSquat[2], `squat peaks rise: ${topSquat}`);
  for (const key of ["athletics_power_build", "athletics_competition_season"]) {
    const p = PROGRAMMES.find((x) => x.key === key);
    for (const s of sessionsOf(p)) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok(i.reps <= 5, `${key}: ${s.title} ${i.id}`);
    for (const week of p.blocks.flatMap((b) => b.weeks)) assert.ok(week.some((s) => s.items.some((i) => i.id === "nordic_curl")), `${key}: Nordic curls`);
  }
});

test("each finished programme leads somewhere sensible: off-season to in-season and back, beginner to intermediate, fight camp back to between camps", () => {
  const byKey = Object.fromEntries(PROGRAMMES.map((p) => [p.key, p]));
  const next = Object.fromEntries(PROGRAMMES.filter((p) => p.listing.next).map((p) => [p.key, p.listing.next]));
  assert.deepEqual(next, {
    beginner_full_body: "intermediate_upper_lower",
    powerlifting_meet_prep: "intermediate_upper_lower",
    team_sport_off_season: "team_sport_in_season",
    team_sport_in_season: "team_sport_off_season",
    endurance_run_ride_strength: "endurance_in_season",
    endurance_swim_row_paddle_strength: "endurance_in_season",
    combat_strength_power: "combat_fight_camp",
    combat_fight_camp: "combat_strength_power",
    tennis_off_season: "tennis_in_season",
    tennis_in_season: "tennis_off_season",
    cricket_off_season: "cricket_in_season",
    cricket_in_season: "cricket_off_season",
    athletics_power_build: "athletics_competition_season",
    athletics_competition_season: "athletics_power_build"
  });
  for (const [from, to] of Object.entries(next)) {
    assert.ok(byKey[to], `${from} -> ${to} exists`);
    assert.notEqual(from, to);
    // The athlete finishing `from` plays a sport `to` is listed for.
    const fromSports = byKey[from].listing.activity_ids;
    const toSports = byKey[to].listing.activity_ids;
    if (toSports.length) assert.ok(fromSports.length && fromSports.every((s) => toSports.includes(s)), `${from} -> ${to}: sports`);
  }
});
