/* engine/src/phases/phase6.runtime.ts */
import type { Phase6SessionOutput, Phase6SessionExercise } from "./phase6.js";
import { applyRuntimeEvent, makeRuntimeState } from "../runtime/session_runtime.js";
import type { RuntimeEvent } from "../runtime/types.js";

export type Phase6RuntimeTrace = {
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  split_active: boolean;
};

function traceFromRuntimeState(state: any): Phase6RuntimeTrace {
  const remaining_ids = Array.isArray(state?.remaining_ids) ? state.remaining_ids.map(String) : [];
  const completed_ids = Array.from(state?.completed_ids ?? []).map(String);
  const dropped_ids = Array.from(state?.skipped_ids ?? []).map(String);
  const split_active = Boolean(state?.split?.active);

  return { remaining_ids, completed_ids, dropped_ids, split_active };
}

type ExerciseStatus = "pending" | "completed" | "skipped";

function statusForId(id: string, completed: Set<string>, skipped: Set<string>): ExerciseStatus {
  if (completed.has(id)) return "completed";
  if (skipped.has(id)) return "skipped";
  return "pending";
}

function applyStatusToExercises(exercises: Phase6SessionExercise[], state: any): Phase6SessionExercise[] {
  const completed = state?.completed_ids instanceof Set ? (state.completed_ids as Set<string>) : new Set<string>();
  const skipped = state?.skipped_ids instanceof Set ? (state.skipped_ids as Set<string>) : new Set<string>();

  // IMPORTANT:
  // - Preserve original stable order
  // - Keep ALL exercises
  // - Add status field (even if Phase6SessionExercise type does not yet declare it)
  return exercises.map((e) => {
    const id = String((e as any)?.exercise_id ?? "");
    const status = statusForId(id, completed, skipped);
    return { ...(e as any), status } as any;
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
export function phase6ApplyRuntimeEvents(
  session: Phase6SessionOutput,
  events: RuntimeEvent[]
): Phase6SessionOutput {
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
    .filter((e: any) => (e?.status ?? "pending") === "pending")
    .map((e: Phase6SessionExercise) => e.exercise_id);

  if (emittedPendingIds.join("|") !== trace.remaining_ids.join("|")) {
    throw new Error("PHASE6_RUNTIME_TRACE_MISMATCH: trace.remaining_ids must equal emitted pending exercises");
  }

  return { session: nextSession, trace };
}