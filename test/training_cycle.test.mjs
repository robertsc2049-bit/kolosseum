// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

import { computeTrainingCycle, macroPhaseFor, mesoWeekFor, weekIndex } from "../dist/src/api/training_cycle.js";
import { phase1Validate } from "../dist/engine/src/phases/phase1.js";

const on = (iso) => new Date(`${iso}T09:30:00Z`);
const plan = (activity_id, extra = {}) => ({ activity_id, training_days_per_week: 3, ...extra });

test("training cycle: a team season works up from off-season to pre-season, in-season and transition", () => {
  const rugby = plan("rugby_union", { season_start_date: "2026-09-05", season_end_date: "2027-05-29" });
  assert.equal(macroPhaseFor(rugby, on("2026-05-01")), "off_season", "18 weeks out");
  assert.equal(macroPhaseFor(rugby, on("2026-07-04")), "off_season", "9 weeks out");
  assert.equal(macroPhaseFor(rugby, on("2026-07-11")), "pre_season", "8 weeks out");
  assert.equal(macroPhaseFor(rugby, on("2026-09-04")), "pre_season", "the day before");
  assert.equal(macroPhaseFor(rugby, on("2026-09-05")), "in_season", "opening day");
  assert.equal(macroPhaseFor(rugby, on("2027-05-29")), "in_season", "final day");
  assert.equal(macroPhaseFor(rugby, on("2027-06-10")), "transition", "12 days after");
  assert.equal(macroPhaseFor(rugby, on("2027-06-19")), "transition", "21 days after");
  assert.equal(macroPhaseFor(rugby, on("2027-06-20")), "off_season", "then off-season until the next season is declared");
});

test("training cycle: strength sports peak for their meet", () => {
  const pl = plan("powerlifting", { competition_date: "2026-12-05" });
  assert.equal(macroPhaseFor(pl, on("2026-09-25")), "accumulation", "10 weeks out");
  assert.equal(macroPhaseFor(pl, on("2026-10-10")), "intensification", "8 weeks out");
  assert.equal(macroPhaseFor(pl, on("2026-11-14")), "peak", "3 weeks out");
  assert.equal(macroPhaseFor(pl, on("2026-12-05")), "peak", "meet day");
  assert.equal(macroPhaseFor(pl, on("2026-12-12")), "transition");
  assert.equal(macroPhaseFor(pl, on("2026-12-25")), "accumulation", "then back to building");
});

test("training cycle: endurance, hybrid and combat build to a dated event and taper", () => {
  const fight = plan("boxing", { competition_date: "2026-12-12" });
  assert.equal(macroPhaseFor(fight, on("2026-08-01")), "base", "19 weeks out");
  assert.equal(macroPhaseFor(fight, on("2026-10-01")), "build", "10 weeks out");
  assert.equal(macroPhaseFor(fight, on("2026-11-14")), "specific", "4 weeks out");
  assert.equal(macroPhaseFor(fight, on("2026-12-02")), "taper", "10 days out");
  assert.equal(macroPhaseFor(fight, on("2026-12-20")), "transition");
});

test("training cycle: no fixed date (and general strength) alternates 4-week general and specific blocks", () => {
  const seen = (p) => new Set(Array.from({ length: 16 }, (_, w) => macroPhaseFor(p, new Date(Date.UTC(2026, 0, 5) + w * 7 * 86400000))));
  assert.deepEqual([...seen(plan("general_strength"))].sort(), ["accumulation", "intensification"]);
  assert.deepEqual([...seen(plan("rugby_union", { no_fixed_date: true }))].sort(), ["off_season", "pre_season"]);
  assert.deepEqual([...seen(plan("triathlon", { no_fixed_date: true }))].sort(), ["base", "build"]);
  // Each block lasts exactly four calendar weeks.
  // Blocks count from the plan's first week, starting with a general block.
  const started = plan("general_strength", { plan_started_on: "2026-09-24" });
  const phases = Array.from({ length: 8 }, (_, w) => macroPhaseFor(started, new Date(Date.UTC(2026, 8, 21) + w * 7 * 86400000)));
  assert.equal(phases[0], "accumulation");
  assert.equal(new Set(phases.slice(0, 4)).size, 1);
  assert.notEqual(phases[3], phases[4]);
});

test("training cycle: mesocycle weeks follow the calendar (Monday-based), and competition-specific phases never deload", () => {
  const monday = Date.UTC(2026, 8, 21);
  const p = plan("rugby_union", { no_fixed_date: true, plan_started_on: "2026-09-23" });
  const weeks = Array.from({ length: 8 }, (_, w) => mesoWeekFor(p, "pre_season", new Date(monday + w * 7 * 86400000)));
  assert.deepEqual(weeks, [1, 2, 3, 4, 1, 2, 3, 4], "a new plan starts on week 1 of its first block");
  assert.deepEqual(weeks.slice(0, 4).sort(), [1, 2, 3, 4]);
  assert.deepEqual(weeks.slice(4), weeks.slice(0, 4), "the 4-week pattern repeats");
  assert.equal(mesoWeekFor(p, "pre_season", new Date(monday)), mesoWeekFor(p, "pre_season", new Date(monday + 6 * 86400000 + 3600000)), "Monday to Sunday is one week");
  for (let w = 0; w < 8; w++) {
    assert.ok(mesoWeekFor(p, "peak", new Date(monday + w * 7 * 86400000)) <= 3);
    assert.ok(mesoWeekFor(p, "specific", new Date(monday + w * 7 * 86400000)) <= 3);
  }
  // Two athletes who started in different weeks deload in different weeks.
  const other = plan("rugby_union", { no_fixed_date: true, plan_started_on: "2026-10-05" });
  assert.equal(mesoWeekFor(other, "pre_season", new Date(Date.UTC(2026, 9, 5))), 1);
  assert.equal(mesoWeekFor(p, "pre_season", new Date(Date.UTC(2026, 9, 5))), 3);
  assert.equal(weekIndex(Date.UTC(1970, 0, 5)), 0);
});

test("training cycle: the session slot counts this week's sessions, wrapping at the declared days", () => {
  const p = plan("netball", { training_days_per_week: 3, no_fixed_date: true });
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => computeTrainingCycle(p, on("2026-09-23"), n).session_slot), [0, 1, 2, 0, 1]);
});

test("training cycle: every computed cycle is one the engine accepts, for every sport and every day of a year", () => {
  const acts = {
    season: ["rugby_union", "tennis"], meet: ["powerlifting", "general_strength"], event: ["hyrox", "judo", "rowing"]
  };
  const base = { consent_granted: true, engine_version: "EB2-1.0.0", enum_bundle_version: "EB2-1.0.0", phase1_schema_version: "1.0.0",
    actor_type: "athlete", execution_scope: "individual", nd_mode: false, instruction_density: "standard", exposure_prompt_density: "standard", bias_mode: "none" };
  let checked = 0;
  for (const [model, list] of Object.entries(acts)) {
    for (const activity_id of list) {
      const dated = activity_id === "general_strength" ? plan(activity_id, { training_days_per_week: 5 })
        : model === "season" ? plan(activity_id, { training_days_per_week: 5, season_start_date: "2026-09-05", season_end_date: "2027-03-01" })
          : plan(activity_id, { training_days_per_week: 5, competition_date: "2026-12-05" });
      for (let d = 0; d < 400; d += 3) {
        const cycle = computeTrainingCycle(dated, new Date(Date.UTC(2026, 3, 1) + d * 86400000), d % 7);
        const r = phase1Validate({ ...base, activity_id, training_cycle: cycle });
        assert.equal(r.ok, true, `${activity_id} day ${d}: ${JSON.stringify(cycle)} ${JSON.stringify(r.details ?? "")}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 900);
});
