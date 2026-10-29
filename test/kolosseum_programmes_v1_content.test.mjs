// Kolosseum programmes v1 (product/programmes/kolosseum_programmes_v1.mjs):
// every programme is one the builder can hold and an athlete can run - real
// exercises, within the builder's limits, sensible loads - and is listed for
// the athletes its design notes say it's for.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";
import { RECOGNISED_PROGRAMMES } from "../product/programmes/recognised_programmes.mjs";

const registry = JSON.parse(fs.readFileSync(new URL("../registries/exercise/exercise.registry.json", import.meta.url), "utf8")).entries;
const activities = new Set(Object.values(JSON.parse(fs.readFileSync(new URL("../registries/activity/activity.registry.json", import.meta.url), "utf8")).entries).map((a) => a.activity_id));
// The training itself - the warm-up and cool-down are checked on their own below.
const working = (s) => ({ ...s, items: s.items.filter((i) => !i.segment) });
const allSessionsOf = (p) => p.blocks.flatMap((b) => b.weeks.flat());
const sessionsOf = (p) => allSessionsOf(p).map(working);

test("seventy-nine programmes: every sport has its own, team sports by family and position, athletics by event group, sport foundations for beginners, and pro versions of the sport builds and preps", () => {
  assert.deepEqual(PROGRAMMES.map((p) => p.key), [
    "beginner_full_body", "intermediate_upper_lower", "powerlifting_meet_prep",
    "collision_forwards_off_season", "collision_backs_off_season", "collision_in_season", "field_ice_off_season", "field_ice_in_season", "court_off_season", "court_in_season",
    "endurance_run_ride_strength", "triathlon_strength", "endurance_swim_row_paddle_strength", "endurance_in_season", "combat_strength_power", "combat_fight_camp", "tennis_off_season", "tennis_in_season",
    "cricket_off_season", "cricket_fast_bowler_off_season", "cricket_in_season", "athletics_power_build", "athletics_throws_build", "athletics_competition_season",
    "strongman_strength_events", "street_lifting_meet_prep", "hyrox_race_build", "crossfit_strength_conditioning",
    "olympic_weightlifting_meet_prep",
    "collision_forwards_off_season_pro", "collision_backs_off_season_pro", "field_ice_off_season_pro", "court_off_season_pro", "tennis_off_season_pro", "cricket_off_season_pro", "combat_strength_power_pro", "athletics_power_build_pro", "endurance_run_ride_strength_pro", "triathlon_strength_pro", "endurance_swim_row_paddle_strength_pro",
    "beginner_contact_foundation", "beginner_field_court_foundation", "beginner_weightlifting_foundation", "beginner_street_lifting_foundation", "beginner_crossfit_on_ramp", "beginner_hyrox_first_race",
    "powerlifting_meet_prep_pro", "olympic_weightlifting_meet_prep_pro", "strongman_strength_events_pro", "street_lifting_meet_prep_pro", "hyrox_race_build_pro", "crossfit_strength_conditioning_pro",
    "beginner_grip_sport_foundation", "grip_sport_meet_prep", "grip_sport_meet_prep_pro",
    // The recognised programmes (recognised_programmes.mjs).
    "bodyweight_fundamentals", "novice_linear_3x5", "novice_5x5", "novice_amrap_linear", "wave_531_full_body",
    "tiered_linear", "texas_method", "ramping_5x5", "wave_531_bbb", "rep_waves", "three_lift_waves", "easy_strength_40_day",
    "power_hypertrophy_upper_lower", "power_hypertrophy_5_day", "push_pull_legs_6_day", "body_part_split_5_day", "golden_era_6_day",
    "six_week_strength_peak", "competition_lift_volume", "max_effort_dynamic_effort", "soviet_weightlifting_cycle",
    "smolov_squat_pro", "bulgarian_daily_max_pro", "ten_sets_of_ten"
  ]);
  assert.equal(new Set(PROGRAMMES.map((p) => p.template_name)).size, PROGRAMMES.length, "names are unique (the seed script skips by name)");
});

test("every exercise is in the exercise registry the builder offers", () => {
  const missing = [];
  for (const p of PROGRAMMES) for (const s of sessionsOf(p)) for (const i of s.items) if (!registry[i.id]) missing.push(`${p.key}: ${i.id}`);
  assert.deepEqual(missing, []);
});

test("every programme fits the builder: 1-12 exercises a session, none twice, 1-7 sessions a week, at most 52 weeks a block, timed work up to 30 min and distances up to 10 km", () => {
  for (const p of PROGRAMMES) {
    for (const b of p.blocks) {
      assert.ok(b.weeks.length >= 1 && b.weeks.length <= 52, `${p.key}/${b.name}: weeks`);
      assert.ok(["general", "volume", "strength", "peak", "deload", "custom"].includes(b.block_type), `${p.key}/${b.name}: block type`);
      for (const week of b.weeks) {
        assert.ok(week.length >= 1 && week.length <= 7, `${p.key}/${b.name}: sessions a week`);
        for (const s of week) {
          assert.ok(s.items.length >= 1 && s.items.length <= 12, `${p.key}: ${s.title} exercises`);
          assert.equal(new Set(s.items.map((i) => i.id)).size, s.items.length, `${p.key}: ${s.title} has an exercise twice (the builder refuses it)`);
          for (const i of s.items) {
            if (i.reps && typeof i.reps === "object" && "seconds" in i.reps) assert.ok(i.reps.seconds >= 1 && i.reps.seconds <= 1800, `${p.key}: ${s.title} ${i.id} at most 30 min (the builder's limit)`);
            if (i.reps && typeof i.reps === "object" && "metres" in i.reps) assert.ok(i.reps.metres >= 1 && i.reps.metres <= 10000, `${p.key}: ${s.title} ${i.id} at most 10 km (the builder's limit)`);
          }
        }
      }
    }
  }
});

// The high-volume programmes a coach asks for by name (Smolov's 10x3, German
// Volume Training's 10x10) may go to 10 sets of a lift; nothing else past 8.
const HIGH_VOLUME = new Set(["smolov_squat_pro", "ten_sets_of_ten"]);
test("loads are sensible: % of 1RM between 50 and 95, whole RPEs between 5 and 9, 1-8 sets (10 on Smolov and 10x10), no % on a bodyweight lift", () => {
  for (const p of PROGRAMMES) {
    for (const s of sessionsOf(p)) {
      for (const i of s.items) {
        const where = `${p.key}: ${s.title} ${i.id}`;
        assert.ok(Number.isInteger(i.sets) && i.sets >= 1 && i.sets <= (HIGH_VOLUME.has(p.key) ? 10 : 8), `${where} sets`);
        if (i.load !== "bw" && "pct" in i.load) {
          assert.ok(i.load.pct >= 50 && i.load.pct <= 95, `${where} % ${i.load.pct}`);
          if ("pct_max" in i.load) assert.ok(i.load.pct_max > i.load.pct && i.load.pct_max <= 95, `${where} % range ${i.load.pct}-${i.load.pct_max}`);
          assert.ok(!(registry[i.id].equipment_requirements ?? []).includes("bodyweight"), `${where} is a bodyweight lift with a %`);
        }
        if (i.load !== "bw" && "rpe" in i.load) assert.ok(Number.isInteger(i.load.rpe) && i.load.rpe >= 5 && i.load.rpe <= 9, `${where} RPE ${i.load.rpe} (the builder takes whole RPEs)`);
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
  for (const key of ["collision_forwards_off_season", "collision_backs_off_season", "collision_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["rugby_union", "rugby_league", "rugby_sevens", "american_football"], key);
  for (const key of ["field_ice_off_season", "field_ice_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["football_soccer", "field_hockey", "ice_hockey"], key);
  for (const key of ["court_off_season", "court_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["netball", "basketball", "volleyball"], key);
  assert.deepEqual(byKey.endurance_run_ride_strength.activity_ids, ["athletics", "cycling"]);
  assert.deepEqual(byKey.triathlon_strength.activity_ids, ["triathlon"]);
  assert.deepEqual(byKey.endurance_swim_row_paddle_strength.activity_ids, ["swimming", "rowing", "kayaking"]);
  assert.deepEqual([...byKey.endurance_in_season.activity_ids].sort(), ["athletics", "cycling", "kayaking", "rowing", "swimming", "triathlon"]);
  for (const key of ["combat_strength_power", "combat_fight_camp"]) assert.deepEqual([...byKey[key].activity_ids].sort(), ["boxing", "brazilian_jiu_jitsu", "judo", "mma", "muay_thai", "wrestling"], key);
  for (const key of ["tennis_off_season", "tennis_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["tennis"], key);
  for (const key of ["cricket_off_season", "cricket_fast_bowler_off_season", "cricket_in_season"]) assert.deepEqual(byKey[key].activity_ids, ["cricket"], key);
  for (const key of ["athletics_power_build", "athletics_throws_build", "athletics_competition_season"]) assert.deepEqual(byKey[key].activity_ids, ["athletics"], key);
  for (const [key, sport] of [["strongman_strength_events", "strongman"], ["street_lifting_meet_prep", "street_lifting"], ["hyrox_race_build", "hyrox"], ["crossfit_strength_conditioning", "crossfit"], ["olympic_weightlifting_meet_prep", "olympic_weightlifting"]]) assert.deepEqual(byKey[key].activity_ids, [sport], key);
  for (const p of PROGRAMMES.filter((x) => x.listing.activity_ids.length && x.key !== "powerlifting_meet_prep")) {
    assert.deepEqual(p.listing.levels, p.key.endsWith("_pro") ? ["pro"] : p.key.startsWith("beginner_") ? ["beginner"] : ["amateur", "pro"], `${p.key}: sport foundations are for beginners; pro versions are for pros`);
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
    beginner_contact_foundation: "intermediate_upper_lower",
    beginner_field_court_foundation: "intermediate_upper_lower",
    cricket_fast_bowler_off_season: "cricket_in_season",
    beginner_weightlifting_foundation: "olympic_weightlifting_meet_prep",
    beginner_street_lifting_foundation: "street_lifting_meet_prep",
    beginner_crossfit_on_ramp: "crossfit_strength_conditioning",
    beginner_hyrox_first_race: "hyrox_race_build",
    powerlifting_meet_prep_pro: "intermediate_upper_lower",
    olympic_weightlifting_meet_prep_pro: "intermediate_upper_lower",
    strongman_strength_events_pro: "intermediate_upper_lower",
    street_lifting_meet_prep_pro: "intermediate_upper_lower",
    hyrox_race_build_pro: "intermediate_upper_lower",
    beginner_grip_sport_foundation: "grip_sport_meet_prep",
    grip_sport_meet_prep: "intermediate_upper_lower",
    grip_sport_meet_prep_pro: "intermediate_upper_lower",
    powerlifting_meet_prep: "intermediate_upper_lower",
    collision_forwards_off_season: "collision_in_season",
    collision_backs_off_season: "collision_in_season",
    field_ice_off_season: "field_ice_in_season",
    field_ice_in_season: "field_ice_off_season",
    court_off_season: "court_in_season",
    court_in_season: "court_off_season",
    endurance_run_ride_strength: "endurance_in_season",
    endurance_swim_row_paddle_strength: "endurance_in_season",
    combat_strength_power: "combat_fight_camp",
    combat_fight_camp: "combat_strength_power",
    tennis_off_season: "tennis_in_season",
    tennis_in_season: "tennis_off_season",
    cricket_off_season: "cricket_in_season",
    cricket_in_season: "cricket_off_season",
    athletics_power_build: "athletics_competition_season",
    athletics_throws_build: "athletics_competition_season",
    triathlon_strength: "endurance_in_season",
    triathlon_strength_pro: "endurance_in_season",
    athletics_competition_season: "athletics_power_build",
    strongman_strength_events: "intermediate_upper_lower",
    street_lifting_meet_prep: "intermediate_upper_lower",
    hyrox_race_build: "intermediate_upper_lower",
    olympic_weightlifting_meet_prep: "intermediate_upper_lower",
    collision_forwards_off_season_pro: "collision_in_season",
    collision_backs_off_season_pro: "collision_in_season",
    field_ice_off_season_pro: "field_ice_in_season",
    court_off_season_pro: "court_in_season",
    tennis_off_season_pro: "tennis_in_season",
    cricket_off_season_pro: "cricket_in_season",
    combat_strength_power_pro: "combat_fight_camp",
    athletics_power_build_pro: "athletics_competition_season",
    endurance_run_ride_strength_pro: "endurance_in_season",
    endurance_swim_row_paddle_strength_pro: "endurance_in_season",
    // Recognised programmes: novice -> intermediate -> advanced, hypertrophy
    // splits between each other, sport peaks into the sport's meet prep.
    bodyweight_fundamentals: "novice_linear_3x5",
    novice_linear_3x5: "texas_method",
    novice_5x5: "ramping_5x5",
    novice_amrap_linear: "texas_method",
    wave_531_full_body: "wave_531_bbb",
    tiered_linear: "wave_531_bbb",
    texas_method: "wave_531_bbb",
    ramping_5x5: "wave_531_bbb",
    wave_531_bbb: "rep_waves",
    rep_waves: "wave_531_bbb",
    easy_strength_40_day: "three_lift_waves",
    power_hypertrophy_upper_lower: "power_hypertrophy_5_day",
    power_hypertrophy_5_day: "power_hypertrophy_upper_lower",
    push_pull_legs_6_day: "power_hypertrophy_upper_lower",
    body_part_split_5_day: "push_pull_legs_6_day",
    golden_era_6_day: "body_part_split_5_day",
    six_week_strength_peak: "powerlifting_meet_prep",
    competition_lift_volume: "powerlifting_meet_prep",
    max_effort_dynamic_effort: "powerlifting_meet_prep",
    soviet_weightlifting_cycle: "olympic_weightlifting_meet_prep",
    smolov_squat_pro: "powerlifting_meet_prep",
    bulgarian_daily_max_pro: "olympic_weightlifting_meet_prep",
    ten_sets_of_ten: "power_hypertrophy_upper_lower"
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

test("timed pieces are ones the builder accepts: at least two exercises in a row, a time cap on For Time and AMRAP, round length and rounds on an EMOM", () => {
  for (const p of PROGRAMMES) {
    for (const s of sessionsOf(p)) {
      const groups = new Map();
      s.items.forEach((item, index) => { if (item.group) groups.set(item.group.id, [...(groups.get(item.group.id) ?? []), { item, index }]); });
      for (const [id, members] of groups) {
        const where = `${p.key}: ${s.title} ${id}`;
        assert.ok(members.length >= 2, `${where}: at least two exercises`);
        assert.ok(members.every((m, i) => i === 0 || m.index === members[i - 1].index + 1), `${where}: in a row`);
        const { type, cap, round, rounds } = members[0].item.group;
        assert.ok(["for_time", "amrap", "emom", "superset"].includes(type), where);
        if (type === "emom") assert.ok(round > 0 && rounds > 0, `${where}: EMOM round and rounds`);
        else if (type !== "superset") assert.ok(cap > 0, `${where}: time cap`);
      }
    }
  }
});

test("strongman event day is never a max every week; street lifting sets its competition lifts by effort with added weight; HYROX trains all eight stations and rehearses the race", () => {
  const strongman = PROGRAMMES.find((p) => p.key === "strongman_strength_events");
  for (const s of sessionsOf(strongman).filter((x) => x.title === "Event day")) for (const i of s.items) assert.ok(i.load.rpe <= 9, `${i.id} RPE ${i.load.rpe}`);
  const street = PROGRAMMES.find((p) => p.key === "street_lifting_meet_prep");
  for (const s of sessionsOf(street)) for (const i of s.items.filter((x) => ["pull_up", "dip"].includes(x.id) && x.load !== "bw")) assert.ok("rpe" in i.load, `${s.title} ${i.id} by effort`);
  assert.equal(street.blocks.at(-1).block_type, "deload", "a taper before the meet");
  const hyrox = PROGRAMMES.find((p) => p.key === "hyrox_race_build");
  const stationIds = new Set(sessionsOf(hyrox).flatMap((s) => s.items.map((i) => i.id)));
  for (const id of ["ski_erg", "sled_push", "sled_rope_pull", "burpee_broad_jump", "rowing_ergometer", "farmers_carry", "sandbag_lunge", "wall_ball", "treadmill_run"]) assert.ok(stationIds.has(id), id);
  const sim = sessionsOf(hyrox).find((s) => s.title.startsWith("Race simulation"));
  assert.deepEqual(sim.items.map((i) => i.id), ["treadmill_run", "ski_erg", "sled_push", "sled_rope_pull", "burpee_broad_jump", "rowing_ergometer", "farmers_carry", "sandbag_lunge", "wall_ball"], "all eight stations in race order");
  assert.ok(sim.items.every((i) => i.group?.type === "for_time"));
  for (const s of sessionsOf(hyrox)) assert.equal(new Set(s.items.map((i) => i.id)).size, s.items.length, `${s.title}: no exercise twice in a session (the builder refuses it)`);
});

test("a weightlifter does the snatch and clean & jerk first, in low reps, and tapers with openers no heavier than 90%", () => {
  const owl = PROGRAMMES.find((p) => p.key === "olympic_weightlifting_meet_prep");
  const classic = new Set(["snatch", "clean_and_jerk", "power_snatch", "hang_snatch", "hang_power_clean"]);
  for (const s of sessionsOf(owl)) {
    for (const i of s.items) if (classic.has(i.id)) assert.ok(i.reps <= 3, `${s.title} ${i.id} ${i.reps} reps`);
    const firstHeavy = s.items.findIndex((i) => ["back_squat", "front_squat", "romanian_deadlift"].includes(i.id));
    const lastClassic = s.items.map((i) => classic.has(i.id) || i.id === "split_jerk").lastIndexOf(true);
    if (firstHeavy >= 0 && lastClassic >= 0) assert.ok(lastClassic < firstHeavy, `${s.title}: lifts before squats`);
  }
  const taper = owl.blocks.at(-1);
  assert.equal(taper.block_type, "deload");
  for (const s of taper.weeks.flat()) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok(i.load.pct <= 90, `${s.title} ${i.id}`);
});

test("a pro's version of each sport build: the same programme with contrast pairs - heavy lift straight into a jump, throw or sprint - and an extra set on the main lifts", () => {
  for (const key of ["collision_forwards_off_season_pro","collision_backs_off_season_pro","field_ice_off_season_pro","court_off_season_pro","tennis_off_season_pro","cricket_off_season_pro","combat_strength_power_pro","athletics_power_build_pro","endurance_run_ride_strength_pro","triathlon_strength_pro","endurance_swim_row_paddle_strength_pro"]) {
    const pro = PROGRAMMES.find((p) => p.key === key);
    const amateur = PROGRAMMES.find((p) => p.key === key.replace(/_pro$/u, ""));
    assert.ok(amateur, key);
    assert.deepEqual(pro.listing.activity_ids, amateur.listing.activity_ids, `${key}: same sports`);
    const proSessions = sessionsOf(pro);
    const amSessions = sessionsOf(amateur);
    assert.equal(proSessions.length, amSessions.length, `${key}: same sessions`);
    let pairs = 0;
    proSessions.forEach((s, i) => {
      const am = amSessions[i];
      assert.deepEqual(new Set(s.items.map((x) => x.id)), new Set(am.items.map((x) => x.id)), `${key} ${s.title}: same exercises`);
      for (const item of s.items.filter((x) => x.load !== "bw" && "pct" in x.load)) {
        const before = am.items.find((x) => x.id === item.id);
        assert.equal(item.sets, Math.min(6, before.sets + 1), `${key} ${s.title} ${item.id}: one more set`);
        assert.equal(item.load.pct, before.load.pct, `${key} ${s.title} ${item.id}: same load`);
      }
      const contrast = s.items.filter((x) => x.group?.type === "superset");
      if (contrast.length) {
        pairs += 1;
        assert.equal(contrast.length, 2);
        assert.ok("pct" in contrast[0].load && (contrast[1].load === "bw" || "kg" in contrast[1].load), `${key} ${s.title}: heavy first, then the explosive`);
      }
    });
    assert.ok(pairs >= amSessions.length / 2, `${key}: most sessions have a contrast pair`);
  }
});

const weeksOf = (key) => PROGRAMMES.find((p) => p.key === key).blocks.flatMap((b) => b.weeks).map((w) => w.map(working));
const weekHas = (week, test) => week.some((s) => s.items.some((i) => test(i, registry[i.id])));

test("a rugby prop or an American football lineman trains the neck at least twice every week, in and out of season, like every collision player", () => {
  for (const key of ["collision_forwards_off_season", "collision_backs_off_season", "collision_in_season", "collision_forwards_off_season_pro", "collision_backs_off_season_pro"]) {
    for (const week of weeksOf(key)) {
      const neckSessions = week.filter((s) => s.items.some((i) => registry[i.id].movement_pattern_id === "neck_isometric")).length;
      assert.ok(neckSessions >= 2, `${key}: neck work in ${neckSessions} sessions`);
    }
  }
});

test("a footballer or ice hockey player does Nordic curls and Copenhagen planks every week of the year - the hamstring and groin injuries those sports lose most time to", () => {
  for (const key of ["field_ice_off_season", "field_ice_in_season", "field_ice_off_season_pro", "collision_in_season", "court_in_season"]) {
    for (const week of weeksOf(key)) {
      if (key.startsWith("field_ice")) assert.ok(weekHas(week, (i) => i.id === "nordic_curl"), `${key}: Nordic curls`);
      assert.ok(weekHas(week, (i) => i.id === "copenhagen_plank"), `${key}: Copenhagen plank`);
    }
  }
});

test("collision off-season is periodised: hypertrophy 8s, max strength 5s, then 3s, the heaviest squat rising block to block", () => {
  const p = PROGRAMMES.find((x) => x.key === "collision_forwards_off_season");
  assert.deepEqual(p.blocks.map((b) => b.block_type), ["volume", "strength", "peak"]);
  const squats = p.blocks.map((b) => b.weeks.flat().flatMap((s) => s.items).filter((i) => i.id === "back_squat"));
  assert.deepEqual(squats.map((list) => Math.max(...list.map((i) => i.reps))), [8, 5, 3]);
  const top = squats.map((list) => Math.max(...list.map((i) => i.load.pct)));
  assert.ok(top[0] < top[1] && top[1] < top[2], `top squat % rises: ${top}`);
});

test("a volleyball or basketball player in season does no extra jumping - games and practice supply it - and holds for the patellar tendon every week", () => {
  for (const week of weeksOf("court_in_season")) {
    assert.ok(!weekHas(week, (_, r) => ["jump_vertical", "jump_horizontal"].includes(r.movement_pattern_id)), "no jumps in season");
    assert.ok(weekHas(week, (i) => i.id === "split_squat" && typeof i.reps === "object" && "seconds" in i.reps), "tendon holds");
  }
});

test("a HYROX athlete runs twice a week on top of the compromised running - threshold and easy aerobic - because running is half the race", () => {
  const p = PROGRAMMES.find((x) => x.key === "hyrox_race_build");
  for (const week of p.blocks.flatMap((b) => b.weeks)) {
    assert.ok(week.some((s) => s.items.some((i) => i.id === "tempo_run")), "threshold run");
    assert.ok(week.some((s) => s.items.some((i) => i.id === "easy_run")), "easy run");
  }
  assert.ok(sessionsOf(p).flatMap((s) => s.items).some((i) => i.id === "sled_rope_pull"), "the race's rope sled pull");
  assert.ok(!sessionsOf(p).flatMap((s) => s.items).some((i) => i.id === "backward_sled_drag"), "not a backward drag");
});

test("a strongman loads stones - to a platform and over a bar - and pulls an axle, and every event note says to swap in the contest's events", () => {
  const p = PROGRAMMES.find((x) => x.key === "strongman_strength_events");
  const items = sessionsOf(p).flatMap((s) => s.items);
  for (const id of ["atlas_stone_load", "atlas_stone_over_bar", "axle_deadlift"]) assert.ok(items.some((i) => i.id === id), id);
  for (const s of sessionsOf(p).filter((x) => x.title === "Event day")) for (const i of s.items.filter((x) => x.note)) assert.match(i.note, /contest/u, i.id);
});

test("CrossFit varies the conditioning week to week, and retests week 1's benchmark in week 8", () => {
  const p = PROGRAMMES.find((x) => x.key === "crossfit_strength_conditioning");
  const weeks = p.blocks.flatMap((b) => b.weeks);
  const piece = (week, day) => week[day].items.filter((i) => i.group).map((i) => i.id).join(",");
  for (const day of [0, 1, 2, 3]) assert.ok(new Set(weeks.slice(0, 4).map((w) => piece(w, day))).size === 4, `day ${day + 1}: four different workouts in four weeks`);
  assert.equal(piece(weeks[7], 0), piece(weeks[0], 0), "week 8 retests week 1");
});

test("an intermediate's heavy 5s top out at 80%, and weeks 3 and 7 end each main lift with a rep-out that re-sets the max", () => {
  const p = PROGRAMMES.find((x) => x.key === "intermediate_upper_lower");
  const weeks = p.blocks.flatMap((b) => b.weeks);
  for (const s of weeks.flat()) for (const i of s.items) if (i.reps === 5 && i.load !== "bw" && "pct" in i.load && ["bench_press", "back_squat"].includes(i.id)) assert.ok(i.load.pct <= 80, `${s.title} ${i.id} ${i.load.pct}`);
  for (const w of [2, 6]) assert.ok(weeks[w].flat().some((s) => s.items.some((i) => /as many good reps/u.test(i.note ?? ""))), `week ${w + 1} rep-out`);
});

test("throwers lift heavier than sprinters - singles at the peak - with heavy medicine-ball throws in every session; triathletes train the swim shoulder every week", () => {
  const throws = PROGRAMMES.find((x) => x.key === "athletics_throws_build");
  assert.equal(throws.listing.days_per_week, 4);
  for (const s of sessionsOf(throws).filter((x) => x.title !== "Overhead and upper volume")) assert.ok(s.items.some((i) => i.id.startsWith("medicine_ball") || registry[i.id].movement_pattern_id === "throw_slam"), s.title);
  assert.ok(sessionsOf(throws).some((s) => s.items.some((i) => i.reps === 1)), "singles in the peak");
  for (const week of PROGRAMMES.find((x) => x.key === "triathlon_strength").blocks.flatMap((b) => b.weeks)) {
    assert.ok(week.some((s) => s.items.some((i) => registry[i.id].movement_pattern_id === "shoulder_external_rotation")), "rotator cuff");
  }
});

test("a beginner rugby player or fighter trains neck and hamstrings from week one - gentle neck holds at RPE 5 - on the same main lifts as any beginner", () => {
  for (const week of weeksOf("beginner_contact_foundation")) {
    assert.ok(weekHas(week, (_, r) => r.movement_pattern_id === "neck_isometric"), "neck work");
    assert.ok(weekHas(week, (i) => i.id === "nordic_curl"), "Nordic curls");
  }
  for (const s of sessionsOf(PROGRAMMES.find((p) => p.key === "beginner_contact_foundation"))) {
    for (const i of s.items) if (registry[i.id].movement_pattern_id === "neck_isometric") assert.equal(i.load.rpe, 5, "gentle");
  }
});

test("a new weightlifter learns the lifts light: snatch and clean & jerk every week at RPE 6-7 in triples and doubles, never a % or a single", () => {
  const p = PROGRAMMES.find((x) => x.key === "beginner_weightlifting_foundation");
  for (const week of weeksOf(p.key)) for (const id of ["snatch", "clean_and_jerk"]) assert.ok(weekHas(week, (i) => i.id === id), id);
  for (const s of sessionsOf(p)) for (const i of s.items.filter((x) => ["snatch", "clean_and_jerk", "power_snatch", "hang_power_clean"].includes(x.id))) {
    assert.ok("rpe" in i.load && i.load.rpe <= 7, `${i.id} by effort, light`);
    assert.ok(i.reps >= 2 && i.reps <= 3, `${i.id} triples and doubles`);
  }
});

test("a new street lifter builds bodyweight pull-ups and dips for eight weeks before adding any weight", () => {
  const weeks = weeksOf("beginner_street_lifting_foundation");
  for (const week of weeks.slice(0, 8)) for (const s of week) for (const i of s.items.filter((x) => ["pull_up", "dip"].includes(x.id))) assert.doesNotMatch(i.note ?? "", /Add a little weight/u);
  assert.ok(weeks.slice(8).every((week) => weekHas(week, (i) => /Add a little weight/u.test(i.note ?? ""))), "first weighted sets in the last block");
});

test("a first-time HYROX athlete learns all eight stations, light, every four weeks, and builds an easy run to 6 km", () => {
  const weeks = weeksOf("beginner_hyrox_first_race");
  const learned = new Set(weeks.slice(0, 4).flat().flatMap((s) => s.items.map((i) => i.id)));
  for (const id of ["ski_erg", "sled_push", "sled_rope_pull", "burpee_broad_jump", "rowing_ergometer", "farmers_carry", "sandbag_lunge", "wall_ball"]) assert.ok(learned.has(id), id);
  const longest = Math.max(...weeks.flat().flatMap((s) => s.items).filter((i) => i.id === "easy_run").map((i) => i.reps.metres));
  assert.equal(longest, 6000);
});

test("a pro powerlifter adds a heavy-single day and peaks at 95%; a pro weightlifter's last heavy single is 95%; pro preps add a day and leave the taper alone", () => {
  for (const key of ["powerlifting_meet_prep", "olympic_weightlifting_meet_prep", "strongman_strength_events", "street_lifting_meet_prep", "hyrox_race_build", "crossfit_strength_conditioning"]) {
    const amateur = PROGRAMMES.find((p) => p.key === key);
    const pro = PROGRAMMES.find((p) => p.key === `${key}_pro`);
    assert.equal(pro.listing.days_per_week, amateur.listing.days_per_week + 1, key);
    const taper = (p) => p.blocks.filter((b) => b.block_type === "deload");
    assert.deepEqual(taper(pro), taper(amateur), `${key}: taper unchanged`);
  }
  const pl = PROGRAMMES.find((p) => p.key === "powerlifting_meet_prep_pro");
  assert.ok(sessionsOf(pl).some((s) => s.title === "Heavy single"));
  assert.ok(sessionsOf(pl).some((s) => s.items.some((i) => i.load !== "bw" && i.load.pct === 95)), "95% in the peak");
  const owl = PROGRAMMES.find((p) => p.key === "olympic_weightlifting_meet_prep_pro");
  assert.ok(sessionsOf(owl).some((s) => s.title === "Heavy singles" && s.items.some((i) => i.id === "snatch" && i.load.pct === 95)));
});

test("a fast bowler's off-season is built around his injuries: Nordic curls, front-foot landing, side planks and the bowling shoulder every week, and no loaded flexion with rotation", () => {
  for (const week of weeksOf("cricket_fast_bowler_off_season")) {
    for (const [what, has] of [["Nordic curls", (i) => i.id === "nordic_curl"], ["landing", (i) => i.id === "drop_to_stick"], ["side strain", (i) => i.id === "side_plank"], ["groin", (i) => i.id === "copenhagen_plank"], ["rotator cuff", (_, r) => r.movement_pattern_id === "shoulder_external_rotation"]]) assert.ok(weekHas(week, has), what);
    assert.ok(!weekHas(week, (_, r) => r.movement_pattern_id === "trunk_flexion"), "no loaded trunk flexion");
  }
});

test("a beginner footballer, netballer or tennis player does Nordic curls, Copenhagen planks and landing practice from week one", () => {
  for (const week of weeksOf("beginner_field_court_foundation")) for (const id of ["nordic_curl", "copenhagen_plank", "drop_to_stick"]) assert.ok(weekHas(week, (i) => i.id === id), id);
});

test("a strongman trains the contest implements, not the same five events every week: keg, frame, real farmer's handles, Husafell, duck walk, vehicle pull, circus dumbbell, Viking press and a timed medley in every four-week block", () => {
  const weeks = weeksOf("strongman_strength_events");
  for (const block of [weeks.slice(0, 4), weeks.slice(4, 8)]) {
    const ids = new Set(block.flat().flatMap((s) => s.items.map((i) => i.id)));
    for (const id of ["keg_carry", "keg_load", "frame_carry", "strongman_farmers_walk", "husafell_stone_carry", "duck_walk", "vehicle_pull", "circus_dumbbell_press", "viking_press", "frame_deadlift", "atlas_stone_load", "atlas_stone_over_bar"]) assert.ok(ids.has(id), id);
    assert.ok(block.flat().some((s) => s.title === "Event day" && s.items.every((i) => i.group?.type === "for_time")), "a timed medley");
  }
});

test("a grip athlete trains crush, pinch and wrist every week, attempt-style at full rest, waves to singles and tapers with openers; a beginner builds tendons at RPE 6 first", () => {
  const prep = PROGRAMMES.find((p) => p.key === "grip_sport_meet_prep");
  assert.deepEqual(prep.listing.activity_ids, ["grip_sport"]);
  assert.equal(prep.blocks.at(-1).block_type, "deload", "a taper before the contest");
  for (const week of prep.blocks.slice(0, -1).flatMap((b) => b.weeks)) {
    for (const [what, pattern] of [["crush", "grip_crush"], ["support/pinch", "grip_support"]]) assert.ok(weekHas(week, (_, r) => r.movement_pattern_id === pattern), what);
    assert.ok(weekHas(week, (i) => ["rolling_handle_lift", "levering", "wrist_roller_roll"].includes(i.id)), "wrist");
    for (const s of week) for (const i of s.items) if (i.load !== "bw" && "rpe" in i.load) assert.ok(i.load.rpe <= 9, `${i.id} RPE ${i.load.rpe}`);
  }
  assert.ok(sessionsOf(prep).some((s) => s.items.some((i) => i.id === "gripper_close" && i.reps === 1)), "singles in the peak");
  const beginner = PROGRAMMES.find((p) => p.key === "beginner_grip_sport_foundation");
  for (const s of sessionsOf(beginner)) for (const i of s.items) if (registry[i.id].movement_pattern_id.startsWith("grip") && i.load !== "bw" && "rpe" in i.load) assert.ok(i.load.rpe <= 6, `${i.id} gentle`);
});

test("a strongman's medley is trained hard in a loading week - never only in the lighter weeks - and contest week rehearses light openers", () => {
  const weeks = weeksOf("strongman_strength_events");
  const medleyWeeks = weeks.map((w, i) => [i + 1, w.find((s) => s.title === "Event day")]).filter(([, s]) => s.items.every((i) => i.group?.type === "for_time")).map(([n]) => n);
  assert.ok(medleyWeeks.length >= 2 && medleyWeeks.every((n) => n % 4 !== 0 && n !== 12), `medley weeks ${medleyWeeks}`);
  for (const n of medleyWeeks) assert.ok(weeks[n - 1].find((s) => s.title === "Event day").items.every((i) => i.sets >= 3 && i.load.rpe >= 7), `week ${n}: three hard runs`);
  const contest = weeks[11].find((s) => s.title === "Event day");
  assert.ok(contest.items.every((i) => i.load.rpe <= 6), "contest week is light");
});

test("a pro grip athlete's heavy-attempts day replaces volume: every attempt item on the other days has a set less than the amateur version", () => {
  const am = PROGRAMMES.find((p) => p.key === "grip_sport_meet_prep");
  const pro = PROGRAMMES.find((p) => p.key === "grip_sport_meet_prep_pro");
  const amWeeks = am.blocks.flatMap((b) => b.weeks);
  pro.blocks.flatMap((b) => b.weeks).forEach((week, w) => {
    if (am.blocks.flatMap((b) => b.weeks.map(() => b.block_type))[w] === "deload") return;
    for (const s of week.filter((x) => x.title !== "Heavy attempts")) {
      const amS = amWeeks[w].find((x) => x.title === s.title);
      for (const i of s.items.filter((x) => /Attempt-style|Set the gripper/u.test(x.note ?? ""))) {
        assert.equal(i.sets, Math.max(2, amS.items.find((x) => x.id === i.id).sets - 1), `week ${w + 1} ${i.id}`);
      }
    }
  });
});

test("every session opens with a warm-up for what it trains and ends with stretches for it - bodyweight mobility work, within the builder's 12 exercises, never repeating an exercise", () => {
  const order = { warm_up: 0, undefined: 1, cool_down: 2 };
  for (const p of PROGRAMMES) {
    for (const s of allSessionsOf(p)) {
      const where = `${p.key}: ${s.title}`;
      assert.ok(s.items.length <= 12, `${where}: ${s.items.length} exercises`);
      assert.equal(new Set(s.items.map((i) => i.id)).size, s.items.length, `${where}: an exercise twice`);
      const segments = s.items.map((i) => order[i.segment]);
      assert.deepEqual(segments, [...segments].sort((a, b) => a - b), `${where}: warm-up, then training, then cool-down`);
      const bookends = s.items.filter((i) => i.segment);
      assert.ok(s.items.some((i) => i.segment === "warm_up") && s.items.some((i) => i.segment === "cool_down"), `${where}: has both`);
      for (const i of bookends) {
        assert.equal(registry[i.id].movement_pattern_id, "mobility", `${where}: ${i.id} is mobility work`);
        assert.equal(i.load, "bw", `${where}: ${i.id} unloaded`);
        const needs = registry[i.id].equipment_requirements.filter((e) => !["bodyweight", "open_floor_space"].includes(e));
        assert.ok(needs.length === 0 || registry[i.id].equipment_alternatives.includes("bodyweight"), `${where}: ${i.id} needs no equipment`);
      }
      assert.match(s.items.filter((i) => i.segment === "warm_up").at(-1).note, /build up to your first working set/u, `${where}: ramps into the first set`);
    }
  }
});

test("a squat day stretches the hips and hamstrings, a bench day the chest and lats, a sprint day the calves, and a grip day the wrists", () => {
  const find = (key, title) => allSessionsOf(PROGRAMMES.find((p) => p.key === key)).find((s) => s.title === title);
  const cool = (s) => s.items.filter((i) => i.segment === "cool_down").map((i) => i.id);
  const warm = (s) => s.items.filter((i) => i.segment === "warm_up").map((i) => i.id);
  const lower = find("intermediate_upper_lower", "Lower 1 - strength");
  assert.deepEqual(cool(lower), ["kneeling_hip_flexor_stretch", "lying_hamstring_stretch"]);
  assert.deepEqual(warm(lower), ["worlds_greatest_stretch", "leg_swing", "open_close_gate"]);
  const upper = find("intermediate_upper_lower", "Upper 1 - strength");
  assert.deepEqual(cool(upper), ["doorway_chest_stretch", "kneeling_lat_stretch"]);
  assert.deepEqual(warm(upper), ["arm_circles", "quadruped_thoracic_rotation", "cat_cow"]);
  const sprint = allSessionsOf(PROGRAMMES.find((p) => p.key === "collision_backs_off_season")).find((s) => s.items.some((i) => registry[i.id]?.movement_pattern_id?.startsWith("sprint_")));
  assert.ok(cool(sprint).includes("wall_calf_stretch"), "calves after sprinting");
  assert.ok(warm(sprint).includes("walking_straight_leg_kick"), "hamstrings opened up before sprinting");
  const grip = find("beginner_grip_sport_foundation", "Pull and crush");
  assert.ok(cool(grip).includes("wrist_flexor_stretch"), "wrists after grip work");
});

// ---------------------------------------------------------------------------
// Recognised programmes (recognised_programmes.mjs).
const recognised = PROGRAMMES.filter((p) => RECOGNISED_PROGRAMMES.some((r) => r.key === p.key));
const mainOf = (p, week, title) => working(p.blocks.flatMap((b) => b.weeks)[week - 1].find((s) => s.title === title)).items[0];

test("every recognised programme is named for what it is, credits the programme it's based on, and says it isn't endorsed", () => {
  assert.equal(recognised.length, 24);
  for (const p of recognised) {
    assert.match(p.listing.title, /\(based on [^)]+\)$/, `${p.key}: title credits the original`);
    assert.equal(p.template_name, p.listing.title, `${p.key}: the coach's copy keeps the credit`);
    assert.match(p.listing.summary, /Based on .+\. Independent - not endorsed by .+\.$/, `${p.key}: summary`);
    assert.match(p.description, /In the style of|based on/i, `${p.key}: design notes say what it follows`);
  }
});

test("a 5/3/1 cycle climbs 5s, 3s, then 5/3/1, and deloads in week 4 - from a 90% training max", () => {
  const bbb = recognised.find((p) => p.key === "wave_531_bbb");
  const week = (n) => mainOf(bbb, n, "Squat");
  assert.deepEqual([week(1).load, week(1).reps], [{ pct: 57.5, pct_max: 77.5 }, 5], "65/75/85% of a 90% training max");
  assert.deepEqual([week(2).load, week(2).reps], [{ pct: 62.5, pct_max: 80 }, 3]);
  assert.deepEqual([week(3).load, week(3).reps], [{ pct: 67.5, pct_max: 85 }, [1, 5]], "5, 3, then 1+ at 85%");
  assert.deepEqual(week(4).load, { pct: 50, pct_max: 55 }, "deload");
  assert.deepEqual(week(5).load, week(1).load, "cycle 2 starts the wave again (the training max goes up instead)");
});

test("the recognised beginner programmes never go past 85% or below 3 reps on a weighted lift", () => {
  for (const p of recognised.filter((x) => x.listing.levels.includes("beginner"))) {
    for (const s of sessionsOf(p)) {
      for (const i of s.items) {
        if (i.load !== "bw" && "pct" in i.load) assert.ok((i.load.pct_max ?? i.load.pct) <= 85, `${p.key}: ${s.title} ${i.id}`);
        if (i.load !== "bw" && typeof i.reps === "number") assert.ok(i.reps >= 3, `${p.key}: ${s.title} ${i.id} ${i.reps} reps`);
      }
    }
  }
});

test("the Texas Method's Friday is heavier than Monday every week, and Wednesday is the lightest", () => {
  const texas = recognised.find((p) => p.key === "texas_method");
  for (let week = 1; week <= 12; week += 1) {
    const [mon, wed, fri] = ["Volume day", "Recovery day", "Intensity day"].map((title) => mainOf(texas, week, title).load.pct);
    assert.ok(fri > mon && mon > wed, `week ${week}: ${mon} / ${wed} / ${fri}`);
  }
});

test("a novice adds weight session to session; past novice, the programmes progress weekly and then in waves", () => {
  const byKey = Object.fromEntries(recognised.map((p) => [p.key, p]));
  for (const key of ["novice_linear_3x5", "novice_5x5", "novice_amrap_linear", "bodyweight_fundamentals"]) assert.deepEqual(byKey[key].listing.levels, ["beginner"], key);
  for (const key of ["texas_method", "ramping_5x5", "tiered_linear"]) assert.deepEqual(byKey[key].listing.levels, ["amateur"], key);
  assert.deepEqual(byKey.golden_era_6_day.listing.levels, ["pro"], "six days of bodybuilding volume");
  assert.deepEqual(byKey.push_pull_legs_6_day.listing.levels, ["pro"], "six days of bodybuilding volume");
  assert.deepEqual(byKey.wave_531_full_body.listing.levels, ["beginner", "amateur"]);
});

test("Smolov, the Bulgarian method and 10x10 say on the card and on every main lift that they're high-risk and coach-supervised, and are listed for the right lifters", () => {
  const byKey = Object.fromEntries(recognised.map((p) => [p.key, p]));
  for (const key of ["smolov_squat_pro", "bulgarian_daily_max_pro", "ten_sets_of_ten"]) {
    const p = byKey[key];
    assert.match(p.listing.summary, /with a coach/, `${key}: card`);
    assert.match(p.listing.summary, /stop and tell/i, `${key}: card says when to stop`);
    assert.match(p.description, /High-risk .+ coach-supervised/, `${key}: design notes`);
  }
  assert.deepEqual(byKey.smolov_squat_pro.listing.levels, ["pro"]);
  assert.deepEqual(byKey.bulgarian_daily_max_pro.listing.levels, ["pro"]);
  for (const key of ["smolov_squat_pro", "bulgarian_daily_max_pro"]) {
    for (const s of sessionsOf(byKey[key])) {
      const main = s.items[0];
      if (main.id.includes("squat") || main.id.includes("snatch") || main.id.includes("clean")) {
        if (main.note && !/Lighter week|Light and fast|Easy movement|Switching phase|Lighter/.test(main.note)) assert.match(main.note, /coach watching/, `${key}: ${s.title} ${main.id}`);
      }
    }
  }
});

test("Smolov's base week is 4x9 at 70%, 5x7 at 75%, 7x5 at 80% and 10x3 at 85%, and nothing in the cycle passes 95% of the starting max", () => {
  const smolov = recognised.find((p) => p.key === "smolov_squat_pro");
  const base = smolov.blocks.find((b) => b.name === "Base mesocycle").weeks[0].map((s) => working(s).items.find((i) => i.id === "back_squat"));
  assert.deepEqual(base.map((i) => [i.sets, i.reps, i.load.pct]), [[4, 9, 70], [5, 7, 75], [7, 5, 80], [10, 3, 85]]);
  for (const s of sessionsOf(smolov)) for (const i of s.items) if (i.load !== "bw" && "pct" in i.load) assert.ok((i.load.pct_max ?? i.load.pct) <= 95, `${s.title}`);
});
