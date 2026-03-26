import test from "node:test";
import assert from "node:assert/strict";

test("facility metrics runtime: derives reproducible occupancy and equipment usage aggregates from explicit facts", async () => {
  const mod = await import(`../dist/src/api/facility_metrics.js?case=facility_metrics_primary`);

  const facilityContext = {
    facility_id: "facility_alpha",
    equipment: [
      { equipment_id: "rack", capacity_units: 2 },
      { equipment_id: "bench", capacity_units: 1 },
      { equipment_id: "rower", capacity_units: 4 }
    ]
  };

  const eventLog = [
    { seq_no: 1, event_type: "CHECK_IN", athlete_id: "ath_1" },
    { seq_no: 2, event_type: "CHECK_IN", athlete_id: "ath_2" },
    { seq_no: 3, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_1", equipment_id: "rack" },
    { seq_no: 4, event_type: "EQUIPMENT_FINISHED", athlete_id: "ath_1", equipment_id: "rack" },
    { seq_no: 5, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_2", equipment_id: "bench" },
    { seq_no: 6, event_type: "CHECK_IN", athlete_id: "ath_3" },
    { seq_no: 7, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_3", equipment_id: "bench" },
    { seq_no: 8, event_type: "CHECK_OUT", athlete_id: "ath_2" },
    { seq_no: 9, event_type: "EQUIPMENT_FINISHED", athlete_id: "ath_3", equipment_id: "bench" },
    { seq_no: 10, event_type: "CHECK_OUT", athlete_id: "ath_1" }
  ];

  const result = mod.buildFacilityMetrics(facilityContext, eventLog);

  assert.deepEqual(result, {
    facility_id: "facility_alpha",
    total_events: 10,
    total_check_ins: 3,
    total_check_outs: 2,
    occupancy_current: 1,
    occupancy_peak: 3,
    equipment_usage: [
      {
        equipment_id: "bench",
        capacity_units: 1,
        usage_event_count: 3,
        started_count: 2,
        finished_count: 1,
        pressure_ratio: 3
      },
      {
        equipment_id: "rack",
        capacity_units: 2,
        usage_event_count: 2,
        started_count: 1,
        finished_count: 1,
        pressure_ratio: 1
      },
      {
        equipment_id: "rower",
        capacity_units: 4,
        usage_event_count: 0,
        started_count: 0,
        finished_count: 0,
        pressure_ratio: 0
      }
    ],
    bottleneck_equipment_ids: ["bench"]
  });
});

test("facility metrics runtime: ties are deterministic and ordered by equipment id", async () => {
  const mod = await import(`../dist/src/api/facility_metrics.js?case=facility_metrics_tie`);

  const facilityContext = {
    facility_id: "facility_tie",
    equipment: [
      { equipment_id: "bench", capacity_units: 1 },
      { equipment_id: "rack", capacity_units: 2 }
    ]
  };

  const eventLog = [
    { seq_no: 1, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_1", equipment_id: "rack" },
    { seq_no: 2, event_type: "EQUIPMENT_FINISHED", athlete_id: "ath_1", equipment_id: "rack" },
    { seq_no: 3, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_2", equipment_id: "bench" }
  ];

  const first = mod.buildFacilityMetrics(facilityContext, eventLog);
  const second = mod.buildFacilityMetrics(facilityContext, eventLog);

  assert.deepEqual(first, second);
  assert.deepEqual(first.bottleneck_equipment_ids, ["bench", "rack"]);
  assert.deepEqual(
    first.equipment_usage.map((x) => x.equipment_id),
    ["bench", "rack"]
  );
});

test("facility metrics runtime: ignores equipment events for undeclared equipment and never invents occupancy", async () => {
  const mod = await import(`../dist/src/api/facility_metrics.js?case=facility_metrics_undeclared`);

  const facilityContext = {
    facility_id: "facility_sparse",
    equipment: [
      { equipment_id: "rack", capacity_units: 3 }
    ]
  };

  const eventLog = [
    { seq_no: 1, event_type: "EQUIPMENT_STARTED", athlete_id: "ath_1", equipment_id: "unknown_machine" },
    { seq_no: 2, event_type: "EQUIPMENT_FINISHED", athlete_id: "ath_1", equipment_id: "unknown_machine" }
  ];

  const result = mod.buildFacilityMetrics(facilityContext, eventLog);

  assert.deepEqual(result, {
    facility_id: "facility_sparse",
    total_events: 2,
    total_check_ins: 0,
    total_check_outs: 0,
    occupancy_current: 0,
    occupancy_peak: 0,
    equipment_usage: [
      {
        equipment_id: "rack",
        capacity_units: 3,
        usage_event_count: 0,
        started_count: 0,
        finished_count: 0,
        pressure_ratio: 0
      }
    ],
    bottleneck_equipment_ids: []
  });
});
