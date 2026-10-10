import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render } from "@testing-library/react";

import { PlateWarmupCalculator } from "../components/PlateWarmupCalculator";
import { SetLogger } from "../screens/athlete/SetLogger";
import { exerciseDetails } from "../utils/format";

test.afterEach(() => cleanup());

const drill = { exercise_id: "worlds_greatest_stretch", segment: "warm_up", sets: 1, reps: 4, rest_seconds: 0, intensity: { type: "bodyweight" } };

test("a warm-up drill reads '1 set' with no '0s rest', and has no set logger or plate calculator - the athlete just ticks it off", () => {
  assert.deepEqual(exerciseDetails(drill).slice(0, 2), ["1 set", "4 reps"]);
  assert.ok(!exerciseDetails(drill).some((d) => /rest/u.test(d)), "no '0s rest'");
  assert.ok(exerciseDetails({ ...drill, segment: "working", sets: 3, rest_seconds: 90 }).includes("3 sets"));
  assert.ok(exerciseDetails({ ...drill, segment: "working", sets: 3, rest_seconds: 90 }).includes("90s rest"));
  const { container } = render(<div>
    <SetLogger exercise={drill} setLogs={[]} busy={false} logSet={async () => {}} />
    <PlateWarmupCalculator exercise={drill} />
    <SetLogger exercise={{ ...drill, segment: "cool_down" }} setLogs={[]} busy={false} logSet={async () => {}} />
  </div>);
  assert.equal(container.querySelector("input"), null, "nothing to log");
  assert.ok(!/Plate calculator/u.test(container.textContent ?? ""), "nothing to load");
});

test("a loaded lift still gets its set logger and plate calculator", () => {
  const squat = { exercise_id: "back_squat", segment: "working", sets: 3, reps: 5, rest_seconds: 180, intensity: { type: "load", value: 100, unit: "kg" } };
  const { container } = render(<div>
    <SetLogger exercise={squat} setLogs={[]} busy={false} logSet={async () => {}} />
    <PlateWarmupCalculator exercise={squat} />
  </div>);
  assert.ok(container.querySelector("input"), "set inputs");
  assert.match(container.textContent ?? "", /Plate calculator/u);
});
