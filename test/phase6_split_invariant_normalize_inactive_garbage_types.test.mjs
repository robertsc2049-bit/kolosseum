import assert from "node:assert/strict";
import { normalizeSummary } from "../engine/src/runtime/session_summary.js";

function plannedSession(ids) {
  return { exercises: ids.map((id) => ({ exercise_id: id, source: "program" })) };
}

function v3Summary(runtime, last_seq) {
  return {
    version: 3,
    started: true,
    runtime,
    last_seq
  };
}

// Invariant under test:
// If split_active === false and remaining_at_split_ids is present but NOT an array (e.g. string/object),
// normalize MUST coerce it to [] and MUST NOT throw.
// Additionally, needsUpgrade MUST be true (repair occurred).
{
  const planned = plannedSession(["ex1", "ex2"]);

  const cases = [
    {
      name: "inactive split + remaining_at_split_ids is string",
      last_seq: 9101,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: false,
        remaining_at_split_ids: "ex1"
      }
    },
    {
      name: "inactive split + remaining_at_split_ids is object",
      last_seq: 9102,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: false,
        remaining_at_split_ids: {}
      }
    }
  ];

  for (const c of cases) {
    const raw = v3Summary(c.runtime, c.last_seq);

    const { summary, needsUpgrade } = normalizeSummary(planned, raw);

    assert.equal(summary.version, 3, c.name);
    assert.equal(summary.started, true, c.name);
    assert.equal(summary.last_seq, c.last_seq, c.name);

    assert.equal(
      needsUpgrade,
      true,
      "normalize should upgrade/repair invalid remaining_at_split_ids when split is inactive: " + c.name
    );

    assert.equal(summary.runtime.split_active, false, c.name);
    assert.deepEqual(summary.runtime.remaining_at_split_ids, [], c.name);

    // Back-compat emission policy: if nested split exists, it MUST be inactive and empty.
    if ("split" in summary.runtime) {
      assert.equal(summary.runtime.split.active, false, c.name + " (nested split must be inactive)");
      assert.deepEqual(summary.runtime.split.remaining_at_split, [], c.name + " (nested split must be empty)");
    }
  }
}

console.log("PASS phase6_split_invariant_normalize_inactive_garbage_types.test.mjs");
