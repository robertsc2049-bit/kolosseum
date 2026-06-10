import assert from "node:assert/strict";
import { normalizeSummary } from "../engine/src/runtime/session_summary.js";

function plannedSession(ids) {
  return { exercises: ids.map((id) => ({ exercise_id: id, source: "program" })) };
}

function v3Summary(runtime) {
  return {
    version: 3,
    started: true,
    runtime,
    last_seq: 123
  };
}

// Invariant under test:
// If split_active === false then remaining_at_split_ids MUST be [] after normalize/restore.
{
  const planned = plannedSession(["ex1"]);

  const raw = v3Summary({
    remaining_ids: ["ex1"],
    completed_ids: [],
    skipped_ids: [],
    split_active: false,
    remaining_at_split_ids: ["ex1"],

    // Also include legacy nested split to ensure back-compat input doesn't bypass invariant.
    split: { active: false, remaining_at_split: ["ex1"] }
  });

  const { summary, needsUpgrade } = normalizeSummary(planned, raw);

  assert.equal(summary.version, 3);
  assert.equal(summary.started, true);
  assert.equal(summary.last_seq, 123);
  assert.equal(needsUpgrade, true, "normalize should upgrade/repair invalid split shape");

  assert.equal(summary.runtime.split_active, false);
  assert.deepEqual(summary.runtime.remaining_at_split_ids, [], "inactive split must clear remaining_at_split_ids");

  // Back-compat emission: split should be omitted when inactive+empty.
  assert.ok(!("split" in summary.runtime), "inactive split should not emit nested split object");
}

console.log("PASS phase6_split_invariant_normalize.test.mjs");
