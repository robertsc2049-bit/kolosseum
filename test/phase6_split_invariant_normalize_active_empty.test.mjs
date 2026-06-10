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
    last_seq: 456
  };
}

// Invariant under test:
// If split_active === true then remaining_at_split_ids MUST exist and be [] (not missing / undefined)
// after normalize/restore, and split_active stays true.
{
  const planned = plannedSession(["ex1", "ex2"]);

  // Deliberately omit remaining_at_split_ids and legacy nested split to simulate partial/older/buggy storage.
  const raw = v3Summary({
    remaining_ids: ["ex1", "ex2"],
    completed_ids: [],
    skipped_ids: [],
    split_active: true
  });

  const { summary, needsUpgrade } = normalizeSummary(planned, raw);

  assert.equal(summary.version, 3);
  assert.equal(summary.started, true);
  assert.equal(summary.last_seq, 456);

  // Because input is missing a canonical field, normalization should repair it.
  assert.equal(needsUpgrade, true, "normalize should upgrade/repair missing remaining_at_split_ids");

  assert.equal(summary.runtime.split_active, true);
  assert.deepEqual(
    summary.runtime.remaining_at_split_ids,
    [],
    "active split with missing remaining_at_split_ids must normalize to []"
  );

  // Back-compat emission: active split SHOULD emit nested split object even if remaining_at_split is empty.
  assert.ok("split" in summary.runtime, "active split should emit nested split object");
  assert.equal(summary.runtime.split.active, true);
  assert.deepEqual(summary.runtime.split.remaining_at_split, []);
}

console.log("PASS phase6_split_invariant_normalize_active_empty.test.mjs");
