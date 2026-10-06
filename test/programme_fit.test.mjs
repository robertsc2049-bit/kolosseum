// Before an athlete starts a Kolosseum programme they're told how it fits
// them (src/api/programme_fit.ts): their training days, and when to start a
// programme that ends in a taper for their competition.
import test from "node:test";
import assert from "node:assert/strict";

const { programmeFit, programmeShape } = await import(new URL("../dist/src/api/programme_fit.js", import.meta.url).href);

const sessions = (weeks, perWeek, lastBlock) => Array.from({ length: weeks * perWeek }, (_, i) => ({
  template_week_index_global: Math.floor(i / perWeek) + 1,
  template_block_type: Math.floor(i / perWeek) + 1 === weeks ? lastBlock : "strength"
}));
const meetPrep = programmeShape(sessions(12, 4, "deload"));
const inSeason = programmeShape(sessions(12, 2, "general"));

test("a 12-week meet prep is 12 weeks and ends in a taper; in-season maintenance doesn't", () => {
  assert.deepEqual(meetPrep, { weeks_total: 12, ends_with_taper: true });
  assert.deepEqual(inSeason, { weeks_total: 12, ends_with_taper: false });
});

test("a powerlifter who trains 3 days is told a 4-day programme will take longer", () => {
  assert.deepEqual(programmeFit(meetPrep, 4, { training_days_per_week: 3 }, "2026-10-06").days, { programme: 4, athlete: 3 });
  assert.equal(programmeFit(meetPrep, 4, { training_days_per_week: 4 }, "2026-10-06").days, null);
  assert.equal(programmeFit(meetPrep, 2, { training_days_per_week: 3 }, "2026-10-06").days, null, "a 2-day fight camp for someone who trains 3: days to spare, nothing to warn about");
});

test("a powerlifter whose meet is in 8 weeks is told a 12-week meet prep won't peak on the day", () => {
  const fit = programmeFit(meetPrep, 4, { training_days_per_week: 4, competition_date: "2026-12-01" }, "2026-10-06");
  assert.equal(fit.competition.timing, "too_late");
  assert.equal(fit.competition.weeks_away, 8);
});

test("a fighter whose fight is 20 weeks away is told the week to start so the taper lands on fight week", () => {
  const fit = programmeFit(meetPrep, 4, { training_days_per_week: 4, competition_date: "2027-02-23" }, "2026-10-06");
  assert.equal(fit.competition.timing, "too_early");
  assert.equal(fit.competition.start_on, "2026-12-01", "12 weeks before");
});

test("starting now, 12 weeks out, is on time; a programme without a taper, or no competition date, says nothing about timing", () => {
  assert.equal(programmeFit(meetPrep, 4, { competition_date: "2026-12-29" }, "2026-10-06").competition.timing, "on_time");
  assert.equal(programmeFit(inSeason, 2, { competition_date: "2026-12-29" }, "2026-10-06").competition, null);
  assert.equal(programmeFit(meetPrep, 4, { training_days_per_week: 4 }, "2026-10-06").competition, null);
  assert.equal(programmeFit(meetPrep, 4, { competition_date: "2026-10-01" }, "2026-10-06").competition, null, "a past competition");
});
