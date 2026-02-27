// test/api_session_state_corrupt_snapshot_hardening.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { deriveTrace, normalizeSummary } from "../engine/src/runtime/session_summary.js";

function planned(ids) {
  return {
    exercises: ids.map((exercise_id) => ({ exercise_id, source: "program" }))
  };
}

test("Corrupt V3 snapshot: junk + duplicates are scoped/uniq + terminals rebuilt through reducer; order is stable", () => {
  const planIds = ["exA", "exB", "exC", "exD"];
  const planned_session = planned(planIds);

  // Put junk IDs and duplicate IDs into session_state_summary.runtime
  const corruptV3 = {
    version: 3,
    started: true,
    last_seq: "9",
    runtime: {
      remaining_ids: ["exD", "exD", "exJUNK", "exC", "exA", "exC"],
      completed_ids: ["exB", "exB", "exNOPE"],
      skipped_ids: ["exA", "exA", "exNOPE2"],
      split: {
        active: true,
        remaining_at_split: ["exC", "exC", "exD", "exJUNK", "exD"]
      }
    }
  };

  const { summary, needsUpgrade } = normalizeSummary(planned_session, corruptV3);
  assert.equal(summary.version, 3);
  assert.equal(summary.started, true);

  // This should upgrade because last_seq gets coerced + runtime normalizes
  assert.equal(needsUpgrade, true);

  const apiTrace = deriveTrace(summary);

  // Contract: trace is the stable API-level view.
  // After scoping+uniq:
  // completed_ids => ["exB"]
  // dropped_ids (skipped) => ["exA"]
  // remaining_ids => ["exC","exD"]
  // split restored from stored data after scoping/uniq => active true, remaining_at_split ["exC","exD"]
  const expectedTrace = {
    started: true,
    remaining_ids: ["exC", "exD"],
    completed_ids: ["exB"],
    dropped_ids: ["exA"],
    split_active: true,
    remaining_at_split_ids: ["exC", "exD"]
  };

  assert.deepEqual(apiTrace, expectedTrace);

  // Stability: repeated normalize must be idempotent and not reorder
  const again = normalizeSummary(planned_session, summary).summary;
  assert.deepEqual(deriveTrace(again), apiTrace);
});
