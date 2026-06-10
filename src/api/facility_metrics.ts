export type FacilityEquipmentContext = {
  equipment_id: string;
  capacity_units: number;
};

export type FacilityContext = {
  facility_id: string;
  equipment: FacilityEquipmentContext[];
};

export type FacilityEvent =
  | {
      seq_no: number;
      event_type: "CHECK_IN";
      athlete_id: string;
    }
  | {
      seq_no: number;
      event_type: "CHECK_OUT";
      athlete_id: string;
    }
  | {
      seq_no: number;
      event_type: "EQUIPMENT_STARTED";
      athlete_id: string;
      equipment_id: string;
    }
  | {
      seq_no: number;
      event_type: "EQUIPMENT_FINISHED";
      athlete_id: string;
      equipment_id: string;
    };

export type FacilityEquipmentUsageMetric = {
  equipment_id: string;
  capacity_units: number;
  usage_event_count: number;
  started_count: number;
  finished_count: number;
  pressure_ratio: number;
};

export type FacilityMetrics = {
  facility_id: string;
  total_events: number;
  total_check_ins: number;
  total_check_outs: number;
  occupancy_current: number;
  occupancy_peak: number;
  equipment_usage: FacilityEquipmentUsageMetric[];
  bottleneck_equipment_ids: string[];
};

function isSafeSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizeCapacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const n = Math.trunc(value);
  return n > 0 ? n : 1;
}

function stableSortedEvents(eventLog: FacilityEvent[]): FacilityEvent[] {
  return [...eventLog].sort((a, b) => {
    if (a.seq_no !== b.seq_no) return a.seq_no - b.seq_no;
    return a.event_type.localeCompare(b.event_type);
  });
}

export function buildFacilityMetrics(
  facilityContext: FacilityContext,
  eventLog: FacilityEvent[]
): FacilityMetrics {
  const contextEquipment = Array.isArray(facilityContext?.equipment) ? facilityContext.equipment : [];

  const capacityByEquipmentId = new Map<string, number>();
  for (const item of contextEquipment) {
    if (!item || typeof item.equipment_id !== "string" || item.equipment_id.length === 0) continue;
    capacityByEquipmentId.set(item.equipment_id, normalizeCapacity(item.capacity_units));
  }

  const sortedEvents = stableSortedEvents(
    (Array.isArray(eventLog) ? eventLog : []).filter((event): event is FacilityEvent => {
      return !!event && isSafeSeq(event.seq_no) && typeof event.event_type === "string";
    })
  );

  const checkedInAthletes = new Set<string>();
  let occupancyCurrent = 0;
  let occupancyPeak = 0;
  let totalCheckIns = 0;
  let totalCheckOuts = 0;

  const startedCounts = new Map<string, number>();
  const finishedCounts = new Map<string, number>();

  for (const event of sortedEvents) {
    if (event.event_type === "CHECK_IN") {
      if (!checkedInAthletes.has(event.athlete_id)) {
        checkedInAthletes.add(event.athlete_id);
        occupancyCurrent += 1;
        totalCheckIns += 1;
        if (occupancyCurrent > occupancyPeak) {
          occupancyPeak = occupancyCurrent;
        }
      }
      continue;
    }

    if (event.event_type === "CHECK_OUT") {
      if (checkedInAthletes.has(event.athlete_id)) {
        checkedInAthletes.delete(event.athlete_id);
        occupancyCurrent = Math.max(0, occupancyCurrent - 1);
        totalCheckOuts += 1;
      }
      continue;
    }

    if (!("equipment_id" in event)) continue;
    if (!capacityByEquipmentId.has(event.equipment_id)) continue;

    if (event.event_type === "EQUIPMENT_STARTED") {
      startedCounts.set(event.equipment_id, (startedCounts.get(event.equipment_id) ?? 0) + 1);
      continue;
    }

    if (event.event_type === "EQUIPMENT_FINISHED") {
      finishedCounts.set(event.equipment_id, (finishedCounts.get(event.equipment_id) ?? 0) + 1);
    }
  }

  const equipmentUsage: FacilityEquipmentUsageMetric[] = [...capacityByEquipmentId.entries()]
    .map(([equipment_id, capacity_units]) => {
      const started_count = startedCounts.get(equipment_id) ?? 0;
      const finished_count = finishedCounts.get(equipment_id) ?? 0;
      const usage_event_count = started_count + finished_count;
      const pressure_ratio = usage_event_count / capacity_units;

      return {
        equipment_id,
        capacity_units,
        usage_event_count,
        started_count,
        finished_count,
        pressure_ratio
      };
    })
    .sort((a, b) => {
      if (b.pressure_ratio !== a.pressure_ratio) return b.pressure_ratio - a.pressure_ratio;
      return a.equipment_id.localeCompare(b.equipment_id);
    });

  const topPressureRatio = equipmentUsage.length > 0 ? equipmentUsage[0].pressure_ratio : 0;

  const bottleneckEquipmentIds = equipmentUsage
    .filter((item) => item.pressure_ratio === topPressureRatio && item.pressure_ratio > 0)
    .map((item) => item.equipment_id)
    .sort((a, b) => a.localeCompare(b));

  return {
    facility_id: typeof facilityContext?.facility_id === "string" ? facilityContext.facility_id : "",
    total_events: sortedEvents.length,
    total_check_ins: totalCheckIns,
    total_check_outs: totalCheckOuts,
    occupancy_current: occupancyCurrent,
    occupancy_peak: occupancyPeak,
    equipment_usage: equipmentUsage,
    bottleneck_equipment_ids: bottleneckEquipmentIds
  };
}
