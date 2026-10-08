// Meet, race and fight preps are timed to the competition date, not to how
// many sessions the athlete has done (src/api/peak_timing.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { peakTimedIndex } from "../dist/src/api/peak_timing.js";

// A 12-week powerlifting meet prep: weeks 1-11 four sessions, week 12 the
// taper and openers (two sessions).
const meetPrep = [
  ...Array.from({ length: 11 }, (_, w) => Array.from({ length: 4 }, () => ({ template_week_index_global: w + 1, template_block_type: w < 4 ? "volume" : w < 8 ? "strength" : "peak" }))).flat(),
  { template_week_index_global: 12, template_block_type: "deload" }, { template_week_index_global: 12, template_block_type: "deload" }
];
const firstOfWeek = (week) => meetPrep.findIndex((s) => s.template_week_index_global === week);

test("a powerlifter who missed two weeks skips ahead so her openers still land in meet week - the missed build weeks go, the peak and taper stay", () => {
  // Done 4 weeks (16 sessions), but the meet is 6 weeks away (week 7 of 12 now).
  const timing = peakTimedIndex(meetPrep, 16, "2026-11-12", "2026-10-06");
  assert.deepEqual(timing, { index: firstOfWeek(7), adjustment: "skipped", weeks: 2, competition_date: "2026-11-12" });
});

test("on schedule, nothing changes; a meet already passed, or more than 12 weeks off, changes nothing", () => {
  assert.equal(peakTimedIndex(meetPrep, firstOfWeek(7), "2026-11-12", "2026-10-06"), null, "on schedule");
  assert.equal(peakTimedIndex(meetPrep, firstOfWeek(7), "2026-10-01", "2026-10-06"), null, "passed");
  assert.equal(peakTimedIndex(meetPrep, 0, "2027-03-01", "2026-10-06"), null, "too far off to reach yet");
  assert.equal(peakTimedIndex(meetPrep, 3, null, "2026-10-06"), null, "no date");
});

test("meet week itself: whatever she's done, her next session is the taper", () => {
  const timing = peakTimedIndex(meetPrep, 20, "2026-10-10", "2026-10-06");
  assert.equal(timing.index, firstOfWeek(12));
  assert.equal(meetPrep[timing.index].template_block_type, "deload");
});

test("a fighter who started camp too early repeats the last hard week instead of tapering into an empty fortnight", () => {
  // Reached the taper (index 44) with the fight still three weeks off.
  const timing = peakTimedIndex(meetPrep, 44, "2026-10-27", "2026-10-06");
  assert.equal(timing.adjustment, "held");
  assert.equal(meetPrep[timing.index].template_week_index_global, 11, "the last build week again");
  assert.equal(timing.weeks, 3, "three more weeks before fight week");
  // Next session (index 41 + 1) carries on through week 11, then tapers when the fight is a week out.
  assert.equal(peakTimedIndex(meetPrep, timing.index + 1, "2026-10-27", "2026-10-06"), null);
  assert.equal(peakTimedIndex(meetPrep, 44, "2026-10-27", "2026-10-21"), null, "fight week: the taper");
});

test("an off-season or maintenance programme (no taper at the end) is never re-timed", () => {
  const offSeason = Array.from({ length: 24 }, (_, i) => ({ template_week_index_global: Math.floor(i / 3) + 1, template_block_type: "strength" }));
  assert.equal(peakTimedIndex(offSeason, 3, "2026-10-20", "2026-10-06"), null);
});
