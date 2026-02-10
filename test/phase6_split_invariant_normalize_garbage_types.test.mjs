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
// If split_active === true and remaining_at_split_ids is present but NOT an array (e.g. string/object),
// normalize MUST coerce it to [] and MUST NOT throw.
{
  const planned = plannedSession(["ex1", "ex2"]);

  const cases = [
    {
      name: "remaining_at_split_ids is string",
      last_seq: 9001,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: true,
        remaining_at_split_ids: "ex1"
      }
    },
    {
      name: "remaining_at_split_ids is object",
      last_seq: 9002,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: true,
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

    assert.equal(needsUpgrade, true, "normalize should upgrade/repair invalid remaining_at_split_ids: " + c.name);

    assert.equal(summary.runtime.split_active, true, c.name);
    assert.deepEqual(summary.runtime.remaining_at_split_ids, [], c.name);

    // Back-compat emission: active split SHOULD emit nested split object even if remaining_at_split is empty.
    assert.ok("split" in summary.runtime, c.name + " (split must be emitted when active)");
    assert.equal(summary.runtime.split.active, true, c.name);
    assert.deepEqual(summary.runtime.split.remaining_at_split, [], c.name);
  }
}

console.log("PASS phase6_split_invariant_normalize_garbage_types.test.mjs");
