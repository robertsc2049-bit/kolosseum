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
//
// If split_active === false, remaining_at_split_ids MUST normalize to [].
// - If remaining_at_split_ids is present and non-empty (even if "valid"), normalize MUST clear it to [] and set needsUpgrade=true.
// - If remaining_at_split_ids is present but contains garbage (wrong ids, empty strings, nulls, numbers, dupes), normalize MUST clear it to [] and set needsUpgrade=true.
// - If remaining_at_split_ids is missing entirely and split is inactive:
//     * If normalize EMITS the field, that is a mutation => needsUpgrade MUST be true.
//     * If normalize OMITS the field, no mutation => needsUpgrade MUST be false.
//   (Contract can choose either emission policy; this test enforces internal consistency.)
{
  const planned = plannedSession(["ex1", "ex2"]);

  const cases = [
    {
      name: "inactive split + remaining_at_split_ids array contains garbage",
      last_seq: 9201,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: false,
        remaining_at_split_ids: ["ex999", "", null, 123, "ex1", "ex1"]
      },
      mode: "present_nonempty"
    },
    {
      name: "inactive split + remaining_at_split_ids is non-empty but valid planned ids",
      last_seq: 9202,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: false,
        remaining_at_split_ids: ["ex1"]
      },
      mode: "present_nonempty"
    },
    {
      name: "inactive split + remaining_at_split_ids missing entirely",
      last_seq: 9203,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: false
      },
      mode: "absent"
    }
  ];

  for (const c of cases) {
    const raw = v3Summary(c.runtime, c.last_seq);

    const { summary, needsUpgrade } = normalizeSummary(planned, raw);

    assert.equal(summary.version, 3, c.name);
    assert.equal(summary.started, true, c.name);
    assert.equal(summary.last_seq, c.last_seq, c.name);

    assert.equal(summary.runtime.split_active, false, c.name);

    const has = Object.prototype.hasOwnProperty.call(summary.runtime, "remaining_at_split_ids");

    if (c.mode === "present_nonempty") {
      // Field existed and was non-empty => MUST be cleared => MUST count as repair.
      assert.equal(
        needsUpgrade,
        true,
        "normalize must claim upgrade when clearing present+non-empty remaining_at_split_ids under inactive split: " + c.name
      );
      assert.equal(has, true, c.name + " (field should be emitted after normalize)");
      assert.deepEqual(summary.runtime.remaining_at_split_ids, [], c.name);
    } else {
      // Field absent in raw input; contract may or may not emit it.
      if (has) {
        // Emission is a mutation => MUST count as upgrade.
        assert.equal(
          needsUpgrade,
          true,
          "normalize emitted remaining_at_split_ids despite being absent; must claim upgrade: " + c.name
        );
        assert.deepEqual(summary.runtime.remaining_at_split_ids, [], c.name + " (if emitted, must be [])");
      } else {
        // No emission => no mutation => MUST NOT claim upgrade.
        assert.equal(
          needsUpgrade,
          false,
          "normalize omitted remaining_at_split_ids and should NOT claim upgrade: " + c.name
        );
      }
    }

    // Back-compat emission policy: if nested split exists, it MUST be inactive and empty.
    if ("split" in summary.runtime) {
      assert.equal(summary.runtime.split.active, false, c.name + " (nested split must be inactive)");
      assert.deepEqual(summary.runtime.split.remaining_at_split, [], c.name + " (nested split must be empty)");
    }
  }
}

console.log("PASS phase6_split_invariant_normalize_inactive_arrays.test.mjs");
