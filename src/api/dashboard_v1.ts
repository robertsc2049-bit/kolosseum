export type MinimalDashboardMetricCard = {
  id: string;
  label: string;
  value: number | string | boolean | null;
};

export type MinimalDashboardTruth = {
  session: {
    total_events: number;
    total_completed_exercises: number;
    total_dropped_exercises: number;
    split_count: number;
    has_return_decision: boolean;
    last_event_seq: number | null;
    completed_ids_count: number;
    dropped_ids_count: number;
    remaining_ids_count: number;
    execution_status: "ready" | "in_progress" | "completed" | "partial" | null;
  } | null;
  facility: {
    facility_id: string;
    total_events: number;
    total_check_ins: number;
    total_check_outs: number;
    occupancy_current: number;
    occupancy_peak: number;
    equipment_usage_count: number;
    bottleneck_equipment_ids: string[];
  } | null;
};

export type MinimalDashboardV1 = {
  version: "v1";
  presentation_mode: "standard" | "nd_compact";
  truth: MinimalDashboardTruth;
  cards: MinimalDashboardMetricCard[];
};

function toSafeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toSafeNullableInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function toSafeBoolean(value: unknown): boolean {
  return value === true;
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string" && x.length > 0)
    .map((x) => x);
}

function normalizeSessionAggregation(input: any): MinimalDashboardTruth["session"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  return {
    total_events: toSafeNumber(input.total_events),
    total_completed_exercises: toSafeNumber(input.total_completed_exercises),
    total_dropped_exercises: toSafeNumber(input.total_dropped_exercises),
    split_count: toSafeNumber(input.split_count),
    has_return_decision: toSafeBoolean(input.has_return_decision),
    last_event_seq: toSafeNullableInt(input.last_event_seq),
    completed_ids_count: toSafeNumber(input.completed_ids_count),
    dropped_ids_count: toSafeNumber(input.dropped_ids_count),
    remaining_ids_count: toSafeNumber(input.remaining_ids_count),
    execution_status:
      input.execution_status === "ready" ||
      input.execution_status === "in_progress" ||
      input.execution_status === "completed" ||
      input.execution_status === "partial"
        ? input.execution_status
        : null
  };
}

function normalizeFacilityMetrics(input: any): MinimalDashboardTruth["facility"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const equipmentUsageCount = Array.isArray(input.equipment_usage) ? input.equipment_usage.length : 0;

  return {
    facility_id: typeof input.facility_id === "string" ? input.facility_id : "",
    total_events: toSafeNumber(input.total_events),
    total_check_ins: toSafeNumber(input.total_check_ins),
    total_check_outs: toSafeNumber(input.total_check_outs),
    occupancy_current: toSafeNumber(input.occupancy_current),
    occupancy_peak: toSafeNumber(input.occupancy_peak),
    equipment_usage_count: equipmentUsageCount,
    bottleneck_equipment_ids: toSafeStringArray(input.bottleneck_equipment_ids)
  };
}

function buildStandardCards(truth: MinimalDashboardTruth): MinimalDashboardMetricCard[] {
  const cards: MinimalDashboardMetricCard[] = [];

  if (truth.session) {
    cards.push(
      { id: "session_total_events", label: "Session events", value: truth.session.total_events },
      { id: "session_execution_status", label: "Session status", value: truth.session.execution_status },
      { id: "session_completed_ids_count", label: "Completed exercises", value: truth.session.completed_ids_count },
      { id: "session_remaining_ids_count", label: "Remaining exercises", value: truth.session.remaining_ids_count },
      { id: "session_split_count", label: "Split count", value: truth.session.split_count },
      { id: "session_has_return_decision", label: "Return decision required", value: truth.session.has_return_decision }
    );
  }

  if (truth.facility) {
    cards.push(
      { id: "facility_total_events", label: "Facility events", value: truth.facility.total_events },
      { id: "facility_occupancy_current", label: "Current occupancy", value: truth.facility.occupancy_current },
      { id: "facility_occupancy_peak", label: "Peak occupancy", value: truth.facility.occupancy_peak },
      { id: "facility_equipment_usage_count", label: "Tracked equipment types", value: truth.facility.equipment_usage_count },
      { id: "facility_bottleneck_equipment_ids", label: "Observed bottleneck equipment", value: truth.facility.bottleneck_equipment_ids.join(", ") }
    );
  }

  return cards;
}

function buildNdCompactCards(truth: MinimalDashboardTruth): MinimalDashboardMetricCard[] {
  const cards: MinimalDashboardMetricCard[] = [];

  if (truth.session) {
    cards.push(
      { id: "session_execution_status", label: "Session", value: truth.session.execution_status },
      { id: "session_completed_ids_count", label: "Done", value: truth.session.completed_ids_count },
      { id: "session_remaining_ids_count", label: "Left", value: truth.session.remaining_ids_count },
      { id: "session_has_return_decision", label: "Decision needed", value: truth.session.has_return_decision }
    );
  }

  if (truth.facility) {
    cards.push(
      { id: "facility_occupancy_current", label: "In facility", value: truth.facility.occupancy_current },
      { id: "facility_occupancy_peak", label: "Peak", value: truth.facility.occupancy_peak },
      { id: "facility_bottleneck_equipment_ids", label: "Busy equipment", value: truth.facility.bottleneck_equipment_ids.join(", ") }
    );
  }

  return cards;
}

export function buildMinimalDashboardV1(source: {
  session_aggregation?: unknown;
  facility_metrics?: unknown;
  presentation_mode?: unknown;
}): MinimalDashboardV1 {
  const truth: MinimalDashboardTruth = {
    session: normalizeSessionAggregation(source?.session_aggregation),
    facility: normalizeFacilityMetrics(source?.facility_metrics)
  };

  const presentation_mode = source?.presentation_mode === "nd_compact" ? "nd_compact" : "standard";

  const cards =
    presentation_mode === "nd_compact"
      ? buildNdCompactCards(truth)
      : buildStandardCards(truth);

  return {
    version: "v1",
    presentation_mode,
    truth,
    cards
  };
}
