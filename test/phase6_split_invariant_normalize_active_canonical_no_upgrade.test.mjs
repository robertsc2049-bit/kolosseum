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
// Active split canonical should NOT cry upgrade.
// - If split_active === true and remaining_at_split_ids exactly matches the deterministic canonical value, needsUpgrade MUST be false.
// - If split_active === true and remaining_at_split_ids is present but [], contract-dependent:
//     * If normalize keeps it [], needsUpgrade MUST be false.
//     * If normalize repairs it deterministically to non-empty, needsUpgrade MUST be true, and the repaired value MUST match the deterministic canonical value.
//
// (This kills “always-upgrade while mid-split” loops.)
{
  const planned = plannedSession(["ex1", "ex2"]);

  const cases = [
    {
      name: "active split + remaining_at_split_ids is canonical planned remaining -> no upgrade",
      last_seq: 9301,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: true,
        remaining_at_split_ids: ["ex1", "ex2"]
      },
      mode: "present_canonical"
    },
    {
      name: "active split + remaining_at_split_ids present but empty (contract-dependent)",
      last_seq: 9302,
      runtime: {
        remaining_ids: ["ex1", "ex2"],
        completed_ids: [],
        skipped_ids: [],
        split_active: true,
        remaining_at_split_ids: []
      },
      mode: "present_empty"
    }
  ];

  for (const c of cases) {
    const raw = v3Summary(c.runtime, c.last_seq);
    const { summary, needsUpgrade } = normalizeSummary(planned, raw);

    assert.equal(summary.version, 3, c.name);
    assert.equal(summary.started, true, c.name);
    assert.equal(summary.last_seq, c.last_seq, c.name);

    assert.equal(summary.runtime.split_active, true, c.name);

    const has = Object.prototype.hasOwnProperty.call(summary.runtime, "remaining_at_split_ids");
    assert.equal(has, true, c.name + " (field should exist for active split)");

    if (c.mode === "present_canonical") {
      assert.deepEqual(summary.runtime.remaining_at_split_ids, ["ex1", "ex2"], c.name);
      assert.equal(
        needsUpgrade,
        false,
        "normalize must NOT claim upgrade when active split remaining_at_split_ids is already canonical: " + c.name
      );
    } else {
      // present_empty: contract-dependent
      const out = summary.runtime.remaining_at_split_ids;

      if (Array.isArray(out) && out.length === 0) {
        // Allowed: empty is canonical => no mutation => no upgrade
        assert.equal(
          needsUpgrade,
          false,
          "normalize kept empty remaining_at_split_ids; must NOT claim upgrade: " + c.name
        );
      } else {
        // Forbidden: normalize repaired deterministically => must claim upgrade and must match canonical value
        assert.equal(
          needsUpgrade,
          true,
          "normalize repaired empty remaining_at_split_ids; must claim upgrade: " + c.name
        );
        assert.deepEqual(
          out,
          ["ex1", "ex2"],
          c.name + " (if repaired, must deterministically become canonical planned remaining ids)"
        );
      }
    }

    // Back-compat emission policy: if nested split exists, it MUST agree with runtime split state.
    if ("split" in summary.runtime) {
      assert.equal(summary.runtime.split.active, true, c.name + " (nested split must be active)");
      const s = summary.runtime.split.remaining_at_split;

      if (c.mode === "present_canonical") {
        assert.deepEqual(s, ["ex1", "ex2"], c.name + " (nested split remaining must match canonical)");
      } else {
        // If runtime repaired, nested must match repaired; if runtime kept empty, nested must be empty.
        if (Array.isArray(summary.runtime.remaining_at_split_ids) && summary.runtime.remaining_at_split_ids.length === 0) {
          assert.deepEqual(s, [], c.name + " (nested split remaining must be empty if runtime kept empty)");
        } else {
          assert.deepEqual(s, ["ex1", "ex2"], c.name + " (nested split remaining must match repaired canonical)");
        }
      }
    }
  }
}

console.log("PASS phase6_split_invariant_normalize_active_canonical_no_upgrade.test.mjs");
