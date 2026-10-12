import assert from "node:assert/strict";
import test from "node:test";

import { thisWeekText } from "../screens/athlete/ProgrammeExercisesCard";

test("the choices screen says the doses are this week's - phase and week of the wave, with the lighter week called out", () => {
  assert.equal(thisWeekText({ macro_phase: "accumulation", meso_week: 2 }), "Doses shown are this week's: build phase, week 2 of 4.");
  assert.equal(thisWeekText({ macro_phase: "in_season", meso_week: 4 }), "Doses shown are this week's: in-season, week 4 of 4 (lighter week).");
  assert.equal(thisWeekText({ macro_phase: "taper", meso_week: 1 }), "Doses shown are this week's: taper.");
  assert.equal(thisWeekText(null), "");
});
