/* engine/src/runtime/session_summary.d.ts
 * Type declarations for session_summary.js (TS consumers).
 * Keep intentionally permissive: semantics are enforced by runtime reducer + tests.
 */

export type JsonRecord = Record<string, unknown>;

export type PlannedExercise = { exercise_id: string; source: "program" };
export type PlannedSession = { exercises: PlannedExercise[]; notes?: unknown[] };

export type RuntimeStateJson = {
  remaining_ids: string[];
  completed_ids: string[];
  skipped_ids: string[];
  split?: { active: boolean; remaining_at_split: string[] };
};

export type SessionSummaryV3 = {
  version: 3;
  started: boolean;
  runtime: RuntimeStateJson;
  last_seq: number;
};

export type SplitSnapshotV2 = { active: boolean; remaining_at_split_ids: string[] };

export type SessionSummaryV2 = {
  version: 2;
  started: boolean;
  remaining_exercises: PlannedExercise[];
  completed_exercises: PlannedExercise[];
  dropped_exercises: PlannedExercise[];
  split?: SplitSnapshotV2;
  last_seq: number;
};

export type LegacySessionSummaryV1 = {
  started: boolean;
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  last_seq: number;
};

export type WireRuntimeEvent =
  | { type: "START_SESSION" }
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" }
  | ({ type: string } & JsonRecord);

export function uniqStable(ids: unknown): string[];
export function plannedIds(planned: PlannedSession): string[];

export function fromEngineState(state: any): RuntimeStateJson;

export function scopeRuntimeJsonToPlan(planned_ids: string[], rt: RuntimeStateJson): RuntimeStateJson;

export function engineStateFromV3Snapshot(planned_ids: string[], raw: unknown): any;

export function isV3Summary(v: unknown): v is SessionSummaryV3;
export function isV2Summary(v: unknown): v is SessionSummaryV2;
export function isV1Summary(v: unknown): v is LegacySessionSummaryV1;

export function summaryFromPlanned(planned: PlannedSession): SessionSummaryV3;

export function summaryV3FromLegacy(
  planned: PlannedSession,
  legacy: LegacySessionSummaryV1 | SessionSummaryV2
): SessionSummaryV3;

export function normalizeSummary(
  planned: PlannedSession,
  raw: unknown
): { summary: SessionSummaryV3; needsUpgrade: boolean };

export function deriveTrace(summary: SessionSummaryV3): {
  started: boolean;
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  split_active: boolean;
  remaining_at_split_ids: string[];
};

export function validateWireRuntimeEvent(v: unknown): WireRuntimeEvent | null;

export function toEngineEvent(w: WireRuntimeEvent): any | null;

export function applyWireEvent(summary: SessionSummaryV3, ev: WireRuntimeEvent, planned: PlannedSession): SessionSummaryV3;