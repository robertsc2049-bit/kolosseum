
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

/// <reference lib="es2022" />

/**
 * Type surface for: @kolosseum/engine/runtime/session_summary.js
 *
 * This is the public contract consumed by the API workspace.
 * Keep it permissive initially; tighten once runtime shapes are locked.
 */

export type WireRuntimeEvent = Record<string, unknown>;
export type SessionTrace = Record<string, unknown>;

export type SessionSummary = {
  started?: boolean;
  [k: string]: unknown;
};

export type NormalizeSummaryResult = {
  summary: SessionSummary;
  needsUpgrade: boolean;
};

/** Validate a wire event (throws or returns structured result at runtime). */
export function validateWireRuntimeEvent(e: unknown): unknown;

/**
 * Normalize a persisted/legacy summary into the canonical shape.
 * API passes (planned, persistedSummary).
 */
export function normalizeSummary(planned: unknown, persistedSummary: unknown): NormalizeSummaryResult;

/**
 * Apply a runtime event to the summary.
 * API passes (summary, event, planned).
 */
export function applyWireEvent(summary: SessionSummary, event: WireRuntimeEvent, planned: unknown): SessionSummary;

/** Derive trace/debug view from a summary (deterministic). */
export function deriveTrace(summary: SessionSummary): SessionTrace;


export type Beta13Phase6CanonicalEvent = {
  event_id: string;
  seq: number;
  event_type: string;
  session_id: string;
  block_id: string | null;
  work_item_id: string | null;
  payload: Record<string, unknown> | null;
};

export const beta13Phase6EventSchemaContract:
  Readonly<Record<string, unknown>>;

export function stableBeta13Phase6EventJson(
  value: unknown
): string;

export function validateBeta13Phase6Session(
  session: unknown
): Readonly<Record<string, unknown>>;

export function validateBeta13Phase6EventInput(
  session: unknown,
  routeSessionId: string,
  raw: unknown
): Readonly<Record<string, unknown>>;

export function materialiseBeta13Phase6Event(
  session: unknown,
  routeSessionId: string,
  raw: unknown,
  seq: number
): Beta13Phase6CanonicalEvent;

export function validateBeta13Phase6CanonicalEvent(
  session: unknown,
  event: unknown
): Beta13Phase6CanonicalEvent;

export function validateBeta13Phase6EventLog(
  session: unknown,
  events: unknown
): readonly Beta13Phase6CanonicalEvent[];

export function appendBeta13Phase6EventLog(
  session: unknown,
  priorEvents: unknown,
  routeSessionId: string,
  raw: unknown
): readonly Beta13Phase6CanonicalEvent[];

export function admitBeta13Phase6EventBeforeReducer(
  session: unknown,
  priorEvents: unknown,
  routeSessionId: string,
  raw: unknown,
  reducerState: unknown,
  reducer: (
    state: unknown,
    event: Beta13Phase6CanonicalEvent
  ) => unknown
): Readonly<{
  event_log:
    readonly Beta13Phase6CanonicalEvent[];
  reducer_state: unknown;
}>;
