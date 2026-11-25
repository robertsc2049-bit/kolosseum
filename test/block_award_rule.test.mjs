// The block-complete award's rule: the last session of a block of two weeks
// or more, and at least three quarters of its sessions.
import assert from "node:assert/strict";
import test from "node:test";

import { finishedBlocks } from "../dist/src/api/block_award_rule.js";

const weeks = (blockId, count, perWeek = 2) => Array.from({ length: count * perWeek }, (_, index) => ({ block_id: blockId, block_name: blockId, week_key: `${blockId}-${Math.floor(index / perWeek)}` }));
const names = (slots, done) => finishedBlocks(slots, new Set(done)).map((block) => block.block_name);

test("the award needs the block's last session and three quarters of the rest", () => {
  const slots = weeks("Strength", 4); // 8 sessions, so 6 are enough
  assert.deepEqual(names(slots, [0, 1, 2, 3, 4, 5, 6]), [], "the last session isn't done");
  assert.deepEqual(names(slots, [0, 1, 2, 3, 7]), [], "five of eight");
  assert.deepEqual(names(slots, [0, 1, 2, 3, 4, 7]), ["Strength"], "six of eight");
  const [block] = finishedBlocks(slots, new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.deepEqual([block.weeks, block.sessions_total, block.indexes.length], [4, 8, 8]);
});

test("each block stands on its own, and a single week isn't one", () => {
  const slots = [...weeks("Build", 2), ...weeks("Deload", 1), ...weeks("Peak", 2)];
  assert.deepEqual(names(slots, [0, 1, 2, 3, 4, 5]), ["Build"], "the one-week deload earns nothing");
  assert.deepEqual(names(slots, [6, 7, 8, 9]), ["Peak"], "joined half way");
  assert.deepEqual(names([], []), []);
  assert.deepEqual(names([{ block_id: "", block_name: "", week_key: "a" }, { block_id: "", block_name: "", week_key: "b" }], [0, 1]), [], "a week with no block");
});
