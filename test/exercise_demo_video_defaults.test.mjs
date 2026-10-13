// The seeded default demo videos (scripts/exercise_demo_video_defaults.json):
// every one is a real exercise, a well-formed YouTube id the app will embed,
// once per exercise, and the most-used programme exercises are covered.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseDemoVideoLink } from "../dist/src/api/exercise_demo_video_links.js";

const defaults = JSON.parse(fs.readFileSync("scripts/exercise_demo_video_defaults.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;

test("every default demo is a library exercise with a YouTube video the app will play inline", () => {
  assert.ok(defaults.length >= 45);
  for (const demo of defaults) {
    assert.ok(registry[demo.exercise_id], `${demo.exercise_id} is in the exercise library`);
    assert.equal(demo.provider, "youtube");
    const link = parseDemoVideoLink(`https://youtu.be/${demo.video_id}`);
    assert.equal(link?.video_id, demo.video_id, demo.exercise_id);
    assert.ok(demo.title && demo.channel, `${demo.exercise_id} records which video was chosen`);
  }
  assert.equal(new Set(defaults.map((d) => d.exercise_id)).size, defaults.length, "one default per exercise");
});

test("the big lifts and the most-programmed exercises have a demo", () => {
  const covered = new Set(defaults.map((d) => d.exercise_id));
  for (const id of ["back_squat", "front_squat", "bench_press", "deadlift", "overhead_press", "romanian_deadlift", "trap_bar_deadlift", "pull_up", "nordic_curl", "pallof_press"]) {
    assert.ok(covered.has(id), id);
  }
});
