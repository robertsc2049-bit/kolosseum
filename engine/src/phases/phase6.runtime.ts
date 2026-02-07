// engine/src/phases/phase6.runtime.ts
import type { Phase6SessionOutput, Phase6SessionExercise } from "./phase6.js";
import { applyRuntimeEvent, makeRuntimeState } from "../runtime/session_runtime.js";
import type { RuntimeEvent } from "../runtime/types.js";

export type Phase6RuntimeTrace = {
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  split_active: boolean;
};

type ExerciseStatus = "pending" | "completed" | "skipped";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x));
}

function normalizeStringSet(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!(v instanceof Set)) return out;
  for (const x of v.values()) out.add(String(x));
  return out;
}

function traceFromRuntimeState(state: unknown): Phase6RuntimeTrace {
  const remaining_ids = isRecord(state) ? normalizeStringArray(state.remaining_ids) : [];
  const completed_ids = isRecord(state) ? Array.from(normalizeStringSet(state.completed_ids)) : [];
  const dropped_ids = isRecord(state) ? Array.from(normalizeStringSet(state.skipped_ids)) : [];

  const split_active =
    isRecord(state) && isRecord(state.split) ? Boolean((state.split as Record<string, unknown>).active) : false;

  return { remaining_ids, completed_ids, dropped_ids, split_active };
}

function statusForId(id: string, completed: Set<string>, skipped: Set<string>): ExerciseStatus {
  if (completed.has(id)) return "completed";
  if (skipped.has(id)) return "skipped";
  return "pending";
}

function getCompletedAndSkipped(state: unknown): { completed: Set<string>; skipped: Set<string> } {
  if (!isRecord(state)) return { completed: new Set<string>(), skipped: new Set<string>() };
  return {
    completed: normalizeStringSet(state.completed_ids),
    skipped: normalizeStringSet(state.skipped_ids)
  };
}

function applyStatusToExercises(exercises: Phase6SessionExercise[], state: unknown): Phase6SessionExercise[] {
  const { completed, skipped } = getCompletedAndSkipped(state);

  // IMPORTANT:
  // - Preserve original stable order
  // - Keep ALL exercises
  // - Add status field (pending/completed/skipped)
  return exercises.map((e) => {
    const status = statusForId(String(e.exercise_id ?? ""), completed, skipped);
    return { ...e, status };
  });
}

/**
 * Runtime wrapper (legacy signature):
 * - Applies events deterministically
 * - Returns Phase6SessionOutput with ALL exercises preserved
 * - Adds per-exercise status (pending/completed/skipped)
 *
 * Contract: does NOT change session_id; does NOT add notes.
 */
export function phase6ApplyRuntimeEvents(session: Phase6SessionOutput, events: RuntimeEvent[]): Phase6SessionOutput {
  const planned_ids = session.exercises.map((e) => e.exercise_id);
  let state = makeRuntimeState(planned_ids);

  for (const ev of events) {
    state = applyRuntimeEvent(state, ev);
  }

  return {
    session_id: session.session_id,
    status: "ready",
    exercises: applyStatusToExercises(session.exercises, state)
  };
}

/**
 * Runtime wrapper (new):
 * - Same reducer + determinism
 * - Returns:
 *   - session with ALL exercises + per-exercise status
 *   - trace derived ONLY from reducer state (remaining/completed/dropped + split flag)
 */
export function phase6ApplyRuntimeEventsWithTrace(
  session: Phase6SessionOutput,
  events: RuntimeEvent[]
): { session: Phase6SessionOutput; trace: Phase6RuntimeTrace } {
  const planned_ids = session.exercises.map((e) => e.exercise_id);
  let state = makeRuntimeState(planned_ids);

  for (const ev of events) {
    state = applyRuntimeEvent(state, ev);
  }

  const nextSession: Phase6SessionOutput = {
    session_id: session.session_id,
    status: "ready",
    exercises: applyStatusToExercises(session.exercises, state)
  };

  const trace = traceFromRuntimeState(state);

  // Safety: trace.remaining_ids must equal the pending exercises in session (stable order).
  const emittedPendingIds = nextSession.exercises
    .filter((e) => (e.status ?? "pending") === "pending")
    .map((e) => e.exercise_id);

  if (emittedPendingIds.join("|") !== trace.remaining_ids.join("|")) {
    throw new Error("PHASE6_RUNTIME_TRACE_MISMATCH: trace.remaining_ids must equal emitted pending exercises");
  }

  return { session: nextSession, trace };
}