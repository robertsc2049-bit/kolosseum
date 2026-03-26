import test from "node:test";
import assert from "node:assert/strict";

test("data export v1 runtime: session aggregation export matches internal truth without invented semantics", async () => {
  const mod = await import(`../dist/src/api/data_export_v1.js?case=export_session_truth`);

  const payload = {
    total_events: 11,
    total_completed_exercises: 4,
    total_dropped_exercises: 1,
    split_count: 1,
    has_return_decision: false,
    last_event_seq: 11,
    completed_ids_count: 4,
    dropped_ids_count: 1,
    remaining_ids_count: 0,
    execution_status: "partial"
  };

  const before = JSON.stringify(payload);
  const result = mod.buildExportEnvelopeV1({
    export_type: "session_aggregation",
    exported_at: "2026-03-26T12:00:00Z",
    payload
  });
  const after = JSON.stringify(payload);

  assert.equal(after, before);
  assert.deepEqual(result, {
    version: "v1",
    export_type: "session_aggregation",
    exported_at: "2026-03-26T12:00:00Z",
    payload: {
      total_events: 11,
      total_completed_exercises: 4,
      total_dropped_exercises: 1,
      split_count: 1,
      has_return_decision: false,
      last_event_seq: 11,
      completed_ids_count: 4,
      dropped_ids_count: 1,
      remaining_ids_count: 0,
      execution_status: "partial"
    }
  });
});

test("data export v1 runtime: facility metrics export preserves declared arrays and factual aggregates", async () => {
  const mod = await import(`../dist/src/api/data_export_v1.js?case=export_facility_truth`);

  const payload = {
    facility_id: "facility_alpha",
    total_events: 14,
    total_check_ins: 4,
    total_check_outs: 3,
    occupancy_current: 1,
    occupancy_peak: 4,
    equipment_usage: [
      { equipment_id: "bench", capacity_units: 1, usage_event_count: 4, started_count: 2, finished_count: 2, pressure_ratio: 4 },
      { equipment_id: "rack", capacity_units: 2, usage_event_count: 2, started_count: 1, finished_count: 1, pressure_ratio: 1 }
    ],
    bottleneck_equipment_ids: ["bench"]
  };

  const result = mod.buildExportEnvelopeV1({
    export_type: "facility_metrics",
    exported_at: null,
    payload
  });

  assert.deepEqual(result, {
    version: "v1",
    export_type: "facility_metrics",
    exported_at: null,
    payload: {
      facility_id: "facility_alpha",
      total_events: 14,
      total_check_ins: 4,
      total_check_outs: 3,
      occupancy_current: 1,
      occupancy_peak: 4,
      equipment_usage: [
        { equipment_id: "bench", capacity_units: 1, usage_event_count: 4, started_count: 2, finished_count: 2, pressure_ratio: 4 },
        { equipment_id: "rack", capacity_units: 2, usage_event_count: 2, started_count: 1, finished_count: 1, pressure_ratio: 1 }
      ],
      bottleneck_equipment_ids: ["bench"]
    }
  });
});

test("data export v1 runtime: dashboard export preserves truth and cards while defaulting safely on hostile input", async () => {
  const mod = await import(`../dist/src/api/data_export_v1.js?case=export_dashboard_truth`);

  const clean = mod.buildExportEnvelopeV1({
    export_type: "dashboard",
    exported_at: "2026-03-26T12:30:00Z",
    payload: {
      version: "v1",
      presentation_mode: "nd_compact",
      truth: {
        session: {
          total_events: 9,
          total_completed_exercises: 3,
          total_dropped_exercises: 1,
          split_count: 1,
          has_return_decision: false,
          last_event_seq: 9,
          completed_ids_count: 3,
          dropped_ids_count: 1,
          remaining_ids_count: 0,
          execution_status: "partial"
        },
        facility: {
          facility_id: "facility_alpha",
          total_events: 14,
          total_check_ins: 4,
          total_check_outs: 3,
          occupancy_current: 1,
          occupancy_peak: 4,
          equipment_usage_count: 2,
          bottleneck_equipment_ids: ["bench"]
        }
      },
      cards: [
        { id: "session_execution_status", label: "Session", value: "partial" },
        { id: "facility_occupancy_current", label: "In facility", value: 1 }
      ]
    }
  });

  const hostile = mod.buildExportEnvelopeV1({
    export_type: "dashboard",
    exported_at: 123,
    payload: {
      version: "wrong",
      presentation_mode: "weird",
      truth: "bad",
      cards: "bad"
    }
  });

  assert.deepEqual(clean, {
    version: "v1",
    export_type: "dashboard",
    exported_at: "2026-03-26T12:30:00Z",
    payload: {
      version: "v1",
      presentation_mode: "nd_compact",
      truth: {
        session: {
          total_events: 9,
          total_completed_exercises: 3,
          total_dropped_exercises: 1,
          split_count: 1,
          has_return_decision: false,
          last_event_seq: 9,
          completed_ids_count: 3,
          dropped_ids_count: 1,
          remaining_ids_count: 0,
          execution_status: "partial"
        },
        facility: {
          facility_id: "facility_alpha",
          total_events: 14,
          total_check_ins: 4,
          total_check_outs: 3,
          occupancy_current: 1,
          occupancy_peak: 4,
          equipment_usage_count: 2,
          bottleneck_equipment_ids: ["bench"]
        }
      },
      cards: [
        { id: "session_execution_status", label: "Session", value: "partial" },
        { id: "facility_occupancy_current", label: "In facility", value: 1 }
      ]
    }
  });

  assert.deepEqual(hostile, {
    version: "v1",
    export_type: "dashboard",
    exported_at: null,
    payload: {
      version: "v1",
      presentation_mode: "standard",
      truth: {
        session: null,
        facility: null
      },
      cards: []
    }
  });
});
