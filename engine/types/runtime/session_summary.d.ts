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
