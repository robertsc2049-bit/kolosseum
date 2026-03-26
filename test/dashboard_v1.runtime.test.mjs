import test from "node:test";
import assert from "node:assert/strict";

test("dashboard v1 runtime: standard and ND compact presentations preserve identical underlying truth", async () => {
  const mod = await import(`../dist/src/api/dashboard_v1.js?case=dashboard_v1_parity`);

  const source = {
    session_aggregation: {
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
    facility_metrics: {
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
  };

  const before = JSON.stringify(source);

  const standard = mod.buildMinimalDashboardV1({
    ...source,
    presentation_mode: "standard"
  });

  const ndCompact = mod.buildMinimalDashboardV1({
    ...source,
    presentation_mode: "nd_compact"
  });

  const after = JSON.stringify(source);

  assert.equal(after, before);
  assert.deepEqual(standard.truth, ndCompact.truth);
  assert.equal(standard.presentation_mode, "standard");
  assert.equal(ndCompact.presentation_mode, "nd_compact");
  assert.notDeepEqual(standard.cards, ndCompact.cards);
  assert.deepEqual(standard.truth, {
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
  });
});

test("dashboard v1 runtime: missing sections stay null and presentation remains stable", async () => {
  const mod = await import(`../dist/src/api/dashboard_v1.js?case=dashboard_v1_sparse`);

  const standard = mod.buildMinimalDashboardV1({});
  const ndCompact = mod.buildMinimalDashboardV1({ presentation_mode: "nd_compact" });

  assert.deepEqual(standard.truth, {
    session: null,
    facility: null
  });
  assert.deepEqual(ndCompact.truth, standard.truth);
  assert.deepEqual(standard.cards, []);
  assert.deepEqual(ndCompact.cards, []);
});

test("dashboard v1 runtime: presenter normalizes hostile input without fabricating extra truth", async () => {
  const mod = await import(`../dist/src/api/dashboard_v1.js?case=dashboard_v1_normalization`);

  const result = mod.buildMinimalDashboardV1({
    session_aggregation: {
      total_events: "bad",
      has_return_decision: "yes",
      last_event_seq: 7.5,
      completed_ids_count: 2,
      dropped_ids_count: null,
      remaining_ids_count: 1,
      execution_status: "unknown"
    },
    facility_metrics: {
      facility_id: "facility_beta",
      total_events: 5,
      occupancy_current: 2,
      occupancy_peak: 3,
      equipment_usage: "bad",
      bottleneck_equipment_ids: ["rack", 123, ""]
    }
  });

  assert.deepEqual(result.truth, {
    session: {
      total_events: 0,
      total_completed_exercises: 0,
      total_dropped_exercises: 0,
      split_count: 0,
      has_return_decision: false,
      last_event_seq: null,
      completed_ids_count: 2,
      dropped_ids_count: 0,
      remaining_ids_count: 1,
      execution_status: null
    },
    facility: {
      facility_id: "facility_beta",
      total_events: 5,
      total_check_ins: 0,
      total_check_outs: 0,
      occupancy_current: 2,
      occupancy_peak: 3,
      equipment_usage_count: 0,
      bottleneck_equipment_ids: ["rack"]
    }
  });
});
