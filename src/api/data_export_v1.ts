export type ExportEnvelopeV1 = {
  version: "v1";
  export_type: "session_aggregation" | "facility_metrics" | "dashboard";
  exported_at: string | null;
  payload: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toSafeIsoStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function exportSessionAggregationPayload(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};

  return {
    total_events: typeof input.total_events === "number" ? input.total_events : 0,
    total_completed_exercises: typeof input.total_completed_exercises === "number" ? input.total_completed_exercises : 0,
    total_dropped_exercises: typeof input.total_dropped_exercises === "number" ? input.total_dropped_exercises : 0,
    split_count: typeof input.split_count === "number" ? input.split_count : 0,
    has_return_decision: input.has_return_decision === true,
    last_event_seq: Number.isSafeInteger(input.last_event_seq) ? input.last_event_seq : null,
    completed_ids_count: typeof input.completed_ids_count === "number" ? input.completed_ids_count : 0,
    dropped_ids_count: typeof input.dropped_ids_count === "number" ? input.dropped_ids_count : 0,
    remaining_ids_count: typeof input.remaining_ids_count === "number" ? input.remaining_ids_count : 0,
    execution_status:
      input.execution_status === "ready" ||
      input.execution_status === "in_progress" ||
      input.execution_status === "completed" ||
      input.execution_status === "partial"
        ? input.execution_status
        : null
  };
}

function exportFacilityMetricsPayload(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};

  return {
    facility_id: typeof input.facility_id === "string" ? input.facility_id : "",
    total_events: typeof input.total_events === "number" ? input.total_events : 0,
    total_check_ins: typeof input.total_check_ins === "number" ? input.total_check_ins : 0,
    total_check_outs: typeof input.total_check_outs === "number" ? input.total_check_outs : 0,
    occupancy_current: typeof input.occupancy_current === "number" ? input.occupancy_current : 0,
    occupancy_peak: typeof input.occupancy_peak === "number" ? input.occupancy_peak : 0,
    equipment_usage: Array.isArray(input.equipment_usage) ? cloneJsonValue(input.equipment_usage) : [],
    bottleneck_equipment_ids: Array.isArray(input.bottleneck_equipment_ids)
      ? input.bottleneck_equipment_ids.filter((x) => typeof x === "string")
      : []
  };
}

function exportDashboardPayload(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};

  return {
    version: input.version === "v1" ? "v1" : "v1",
    presentation_mode: input.presentation_mode === "nd_compact" ? "nd_compact" : "standard",
    truth: isPlainObject(input.truth) ? cloneJsonValue(input.truth) : { session: null, facility: null },
    cards: Array.isArray(input.cards) ? cloneJsonValue(input.cards) : []
  };
}

export function buildExportEnvelopeV1(source: {
  export_type?: unknown;
  exported_at?: unknown;
  payload?: unknown;
}): ExportEnvelopeV1 {
  const exportType =
    source?.export_type === "session_aggregation" ||
    source?.export_type === "facility_metrics" ||
    source?.export_type === "dashboard"
      ? source.export_type
      : "session_aggregation";

  const payload =
    exportType === "session_aggregation"
      ? exportSessionAggregationPayload(source?.payload)
      : exportType === "facility_metrics"
        ? exportFacilityMetricsPayload(source?.payload)
        : exportDashboardPayload(source?.payload);

  return {
    version: "v1",
    export_type: exportType,
    exported_at: toSafeIsoStringOrNull(source?.exported_at),
    payload
  };
}
