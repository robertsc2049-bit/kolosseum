export type ExportEnvelopeV1 = {
  version: "v1";
  export_type: "session_aggregation";
  exported_at: string | null;
  payload: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toSafeIsoStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

/**
 * DEV NOTE:
 * Purpose: Build the v0-admitted session aggregation envelope.
 * Boundary: Only session aggregation is admitted here; all other product envelopes are refused.
 * Determinism: Payload shape is closed and sorted by literal construction order.
 * Failure: Unknown export_type values must resolve to session_aggregation rather than activating other surfaces.
 */
export function buildExportEnvelopeV1(source: {
  export_type?: unknown;
  exported_at?: unknown;
  payload?: unknown;
}): ExportEnvelopeV1 {
  return {
    version: "v1",
    export_type: "session_aggregation",
    exported_at: toSafeIsoStringOrNull(source?.exported_at),
    payload: exportSessionAggregationPayload(source?.payload)
  };
}