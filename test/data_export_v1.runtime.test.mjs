
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import test from "node:test";

test("data export v1 runtime: session aggregation envelope is closed and factual", async () => {
  const mod = await import(`../dist/src/api/data_export_v1.js?case=export_session_truth`);

  const result = mod.buildExportEnvelopeV1({
    export_type: "session_aggregation",
    exported_at: "2026-06-04T00:00:00.000Z",
    payload: {
      total_events: 8,
      total_completed_exercises: 3,
      total_dropped_exercises: 1,
      split_count: 1,
      has_return_decision: true,
      last_event_seq: 8,
      completed_ids_count: 3,
      dropped_ids_count: 1,
      remaining_ids_count: 2,
      execution_status: "partial",
      ignored_extra: "ignored"
    }
  });

  assert.deepEqual(result, {
    version: "v1",
    export_type: "session_aggregation",
    exported_at: "2026-06-04T00:00:00.000Z",
    payload: {
      total_events: 8,
      total_completed_exercises: 3,
      total_dropped_exercises: 1,
      split_count: 1,
      has_return_decision: true,
      last_event_seq: 8,
      completed_ids_count: 3,
      dropped_ids_count: 1,
      remaining_ids_count: 2,
      execution_status: "partial"
    }
  });
});

test("data export v1 runtime: non-session export requests remain session aggregation", async () => {
  const mod = await import(`../dist/src/api/data_export_v1.js?case=export_boundary`);

  for (const exportType of ["facility_metrics", "dashboard", "proof", "evidence", null, undefined]) {
    const result = mod.buildExportEnvelopeV1({
      export_type: exportType,
      exported_at: 123,
      payload: {
        refused_product_scope_id: "scope-1",
        cards: [{ id: "card-1" }],
        total_events: "not-number",
        execution_status: "unknown"
      }
    });

    assert.equal(result.version, "v1");
    assert.equal(result.export_type, "session_aggregation");
    assert.equal(result.exported_at, null);
    assert.deepEqual(result.payload, {
      total_events: 0,
      total_completed_exercises: 0,
      total_dropped_exercises: 0,
      split_count: 0,
      has_return_decision: false,
      last_event_seq: null,
      completed_ids_count: 0,
      dropped_ids_count: 0,
      remaining_ids_count: 0,
      execution_status: null
    });
  }
});
