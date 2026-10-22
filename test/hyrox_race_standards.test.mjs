// A HYROX athlete trains with their division's race weights in view: a
// Women's Open athlete sees a 102 kg sled push (including the sled), a Men's
// Pro athlete 202 kg - never the wrong division's weight.
import assert from "node:assert/strict";
import test from "node:test";

import { applyHyroxRaceStandards, isHyroxDivision, raceStandardFor } from "../dist/src/api/hyrox_race_standards.js";

test("each station's race weight by division (2025/26), sleds including the sled, farmers per hand", () => {
  assert.equal(raceStandardFor("sled_push", "women_open"), "Race weight, Women's Open (2025/26): 102 kg sled (including the sled). Check your event's rulebook.");
  assert.match(raceStandardFor("sled_push", "men_pro"), /202 kg sled/u);
  assert.match(raceStandardFor("sled_drag", "men_open"), /103 kg sled pull/u);
  assert.match(raceStandardFor("farmers_carry", "women_pro"), /2 x 24 kg/u);
  assert.match(raceStandardFor("sandbag_lunge", "men_pro"), /30 kg sandbag/u);
  assert.match(raceStandardFor("wall_ball", "women_open"), /4 kg ball/u);
  assert.match(raceStandardFor("wall_ball", "men_pro"), /9 kg ball/u);
  assert.equal(raceStandardFor("trap_bar_deadlift", "men_pro"), null, "not a station");
});

test("a session's stations gain the line; other work and unknown divisions don't", () => {
  const session = [{ exercise_id: "trap_bar_deadlift" }, { exercise_id: "sled_push" }, { exercise_id: "wall_ball__r2" }];
  const out = applyHyroxRaceStandards(session, "men_open");
  assert.equal(out[0].race_standard, undefined);
  assert.match(out[1].race_standard, /152 kg/u);
  assert.match(out[2].race_standard, /6 kg ball/u);
  assert.equal(isHyroxDivision("athlete"), false);
  assert.equal(isHyroxDivision("women_pro"), true);
});
