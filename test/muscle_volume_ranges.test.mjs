// Weekly sets per muscle group against the usual range for the athlete's
// level (shared/muscle-volume-ranges): the table itself, that Kolosseum's
// own coach-written programmes read as sound against it, and the Analysis
// page's weekly planned / done sets and the findings a coach reads.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  MUSCLE_VOLUME_RANGES, VOLUME_LEVELS, muscleVolumeRange, rangeText, volumeLevel, volumeStatus
} from "../shared/muscle-volume-ranges/muscleVolumeRanges.mjs";
import { analyseAthlete, findings, weekStarts } from "../dist/src/api/coach_analysis_metrics.js";
import { exerciseMuscleFields } from "../dist/src/api/exercise_muscles.js";
import { PROGRAMMES } from "../product/programmes/kolosseum_programmes_v1.mjs";

test("a beginner's ceiling is below an amateur's, an amateur's below a pro's, for every group; minimums only on the major groups", () => {
  const groups = Object.keys(MUSCLE_VOLUME_RANGES.amateur);
  for (const group of groups) {
    const [b, a, p] = VOLUME_LEVELS.map((level) => MUSCLE_VOLUME_RANGES[level][group]);
    assert.ok(b.max < a.max && a.max < p.max, `${group} max ${b.max} < ${a.max} < ${p.max}`);
    for (const r of [b, a, p]) assert.ok(r.min === null || r.min < r.max, `${group} min under max`);
  }
  assert.deepEqual(groups.filter((group) => MUSCLE_VOLUME_RANGES.amateur[group].min !== null).sort(), ["back", "chest", "glutes", "hamstrings", "quads", "shoulders"]);
});

test("under, in range and over; an unknown level reads as amateur; a sport's focus group has no ceiling", () => {
  const quads = muscleVolumeRange("quads", "amateur");
  assert.equal(volumeStatus(6, quads), "under");
  assert.equal(volumeStatus(8, quads), "in_range", "the minimum itself is enough");
  assert.equal(volumeStatus(22, quads), "in_range", "the maximum itself is recoverable");
  assert.equal(volumeStatus(23, quads), "over");
  assert.equal(volumeStatus(2, muscleVolumeRange("biceps", "amateur")), "in_range", "no minimum for arms - not every programme wants them bigger");
  assert.equal(volumeStatus(5, muscleVolumeRange("conditioning", "amateur")), null);
  assert.equal(volumeLevel(""), "amateur");
  assert.equal(volumeLevel("elite"), "amateur");
  assert.equal(volumeStatus(18, muscleVolumeRange("quads", "beginner")), "over", "18 sets of quads is more than a beginner needs or recovers from");
  assert.equal(volumeStatus(15, muscleVolumeRange("quads", "beginner")), "in_range", "a novice 5x5's 15 squat sets");
  assert.equal(volumeStatus(16, muscleVolumeRange("quads", "pro")), "in_range");
  assert.equal(volumeStatus(40, muscleVolumeRange("quads", "pro", "olympic_weightlifting")), "in_range", "a weightlifter squats a lot on purpose");
  assert.equal(volumeStatus(40, muscleVolumeRange("forearms_grip", "amateur", "grip_sport")), null, "a grip athlete's forearms: no range to read against");
  assert.equal(volumeStatus(30, muscleVolumeRange("forearms_grip", "amateur", "rugby_union")), "over");
  assert.equal(rangeText(muscleVolumeRange("quads", "amateur")), "8-22 sets");
  assert.equal(rangeText(muscleVolumeRange("biceps", "amateur")), "up to 20 sets");
});

// Movement pattern per exercise, from the registry, as the server reads it.
const registry = JSON.parse(fs.readFileSync(new URL("../registries/exercise/exercise.registry.json", import.meta.url), "utf8"));
const patternOf = (id) => registry.entries?.[id]?.movement_pattern_id ?? Object.values(registry.entries ?? {}).find((entry) => entry.exercise_id === id)?.movement_pattern_id;

test("no week of a Kolosseum programme reads 'over' for the levels it's written for - a strongman build, a meet prep and a beginner programme included", () => {
  const flat = (items) => items.flatMap((item) => (Array.isArray(item?.items) ? flat(item.items) : [item]));
  const over = [];
  let weeksChecked = 0;
  for (const programme of PROGRAMMES) {
    for (const block of programme.blocks) {
      block.weeks.forEach((week, weekIndex) => {
        weeksChecked += 1;
        const sets = {};
        for (const item of week.flatMap((session) => flat(session.items ?? []))) {
          if (!item?.id || item.segment === "warm_up" || item.segment === "cool_down") continue;
          const n = Array.isArray(item.sets) ? item.sets[1] : Number(item.sets);
          const id = String(item.id).replace(/__r[0-9]+$/u, "");
          const pattern = patternOf(id);
          if (!pattern || !n) continue;
          const fields = exerciseMuscleFields(id, pattern);
          if (!fields.volume_counted) continue;
          for (const group of fields.muscle_groups) sets[group] = (sets[group] ?? 0) + n;
          for (const group of fields.secondary_muscle_groups) sets[group] = (sets[group] ?? 0) + n / 2;
        }
        for (const level of programme.listing?.levels ?? []) {
          for (const [group, count] of Object.entries(sets)) {
            if (volumeStatus(count, muscleVolumeRange(group, level, programme.activity_id)) === "over") over.push(`${programme.key} ${block.name} week ${weekIndex + 1} (${level}): ${group} ${count}`);
          }
        }
      });
    }
  }
  assert.ok(weeksChecked > 300, `${weeksChecked} weeks checked`);
  assert.deepEqual(over, []);
});

// One session a week of `quads` sets of leg extensions and `hams` sets of
// lying leg curls, for 5 weeks to a Saturday.
const at = (date, hh, mm) => `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;
const MUSCLES = { leg_extension: { groups: ["quads"], secondary: [] }, lying_leg_curl: { groups: ["hamstrings"], secondary: [] }, back_squat: { groups: ["quads", "glutes"], secondary: ["adductors", "lower_back"] } };
function athlete({ quads, hams, level, activity, plannedQuads = quads, skipWeeks = [] }) {
  const sessions = weekStarts("2026-10-17", 5).map((week, w) => {
    const events = [{ type: "START_SESSION", at: at(week, 18, 0) }];
    const log = (exercise_id, n) => { for (let s = 1; s <= n; s += 1) events.push({ type: "SET_LOG_REPORT", at: at(week, 18, s), exercise_id, set_index: s, reps: 10, load_kg: 40 }); };
    log("leg_extension", quads);
    log("lying_leg_curl", hams);
    events.push({ type: "SET_LOG_REPORT", at: at(week, 19, 0), exercise_id: "lying_leg_curl", set_index: 99, reps: 0, load_kg: 40 });
    return {
      session_id: `s${w}`, status: "completed", created_at: at(week, 17, 0), events,
      planned: [
        { exercise_id: "leg_extension", segment: "working", sets: plannedQuads, reps_target: 10, load_kg: 40 },
        { exercise_id: "lying_leg_curl", segment: "working", sets: hams, reps_target: 10, load_kg: 40 },
        { exercise_id: "back_squat", segment: "warm_up", sets: 2, reps_target: 5, load_kg: 20 }
      ]
    };
  }).filter((_, w) => !skipWeeks.includes(w));
  return analyseAthlete({
    today: "2026-10-17", weeks: 5, sessions, readiness: [], checkins: [], planned_days_per_week: 1,
    exercise_name: (id) => id, is_strength_lift: () => false,
    muscles_of: (id) => MUSCLES[id] ?? null,
    muscle_group_labels: { quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes and hips" },
    experience_level: level, activity_id: activity
  });
}

test("Analysis: planned and done hard sets per group each week; a 0-rep set and warm-ups don't count", () => {
  const analysis = athlete({ quads: 12, hams: 4, level: "amateur", activity: "general_strength", plannedQuads: 14 });
  const mv = analysis.muscle_volume;
  assert.equal(mv.level, "amateur");
  assert.deepEqual(mv.rows[0].groups, { quads: { planned: 14, done: 12 }, hamstrings: { planned: 4, done: 4 } }, "no glutes from the warm-up squats");
  const hams = mv.groups.find((group) => group.group === "hamstrings");
  assert.deepEqual([hams.label, hams.min, hams.max, hams.average_done, hams.weeks_under, hams.weeks_complete], ["Hamstrings", 6, 20, 4, 4, 4], "this week is partial and not counted");
});

test("an amateur doing 26 sets of quads a week for 4 weeks is told it's over what they usually recover from", () => {
  const list = findings(athlete({ quads: 26, hams: 8, level: "amateur", activity: "powerlifting" }));
  const over = list.find((finding) => finding.id === "muscle_over_quads");
  assert.equal(over.text, "Quads: over 22 sets a week (the most an amateur usually recovers from) in 4 of the last 4 weeks trained, up to 26.");
  assert.equal(over.section, "volume");
  assert.match(over.action, /accessory sets/u);
});

test("the same 18 sets of quads: over for a beginner, in range for a pro", () => {
  assert.ok(findings(athlete({ quads: 18, hams: 6, level: "beginner", activity: "general_strength" })).some((finding) => finding.id === "muscle_over_quads"));
  assert.ok(!findings(athlete({ quads: 18, hams: 8, level: "pro", activity: "general_strength" })).some((finding) => finding.id.startsWith("muscle_")));
});

test("too few hamstring sets is flagged for general strength, never for a runner - their gym work isn't for size", () => {
  const lifter = findings(athlete({ quads: 10, hams: 3, level: "amateur", activity: "general_strength" })).find((finding) => finding.id === "muscle_under_hamstrings");
  assert.equal(lifter.text, "Hamstrings: under 6 sets a week (the usual minimum to build it) in 4 of the last 4 weeks trained.");
  assert.equal(lifter.level, "info");
  assert.ok(!findings(athlete({ quads: 10, hams: 3, level: "amateur", activity: "athletics" })).some((finding) => finding.id.startsWith("muscle_under")));
});

test("weeks before they started, or a week off, aren't counted as under - only weeks they trained", () => {
  const analysis = athlete({ quads: 10, hams: 3, level: "amateur", activity: "general_strength", skipWeeks: [0, 1] });
  const hams = analysis.muscle_volume.groups.find((group) => group.group === "hamstrings");
  assert.deepEqual([hams.weeks_complete, hams.weeks_under], [2, 2], "2 complete weeks trained, not 4");
  assert.ok(!findings(analysis).some((finding) => finding.id === "muscle_under_hamstrings"), "2 weeks is too soon to call it");
});

test("without a muscle map there is no muscle section", () => {
  const analysis = analyseAthlete({ today: "2026-10-17", weeks: 4, sessions: [], readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false });
  assert.equal(analysis.muscle_volume, null);
});
