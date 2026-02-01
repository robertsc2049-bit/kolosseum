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

function traceFromRuntimeState(state: any): Phase6RuntimeTrace {
  const remaining_ids = Array.isArray(state?.remaining_ids) ? state.remaining_ids.map(String) : [];
  const completed_ids = Array.from(state?.completed_ids ?? []).map(String);
  const dropped_ids = Array.from(state?.skipped_ids ?? []).map(String);
  const split_active = Boolean(state?.split?.active);

  return { remaining_ids, completed_ids, dropped_ids, split_active };
}

/**
 * Runtime wrapper (legacy signature):
 * - Applies events deterministically
 * - Returns Phase6SessionOutput with remaining exercises only
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

  const remaining = new Set(state.remaining_ids);

  return {
    session_id: session.session_id,
    status: "ready",
    exercises: session.exercises.filter((e) => remaining.has(e.exercise_id))
  };
}

/**
 * Runtime wrapper (new):
 * - Same reducer + determinism
 * - Also returns a trace object derived ONLY from emitted runtime state
 *   (remaining/completed/dropped sets), not from planned_session.
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

  const remaining = new Set(state.remaining_ids);

  const nextSession: Phase6SessionOutput = {
    session_id: session.session_id,
    status: "ready",
    exercises: session.exercises.filter((e) => remaining.has(e.exercise_id))
  };

  // Trace is derived ONLY from reducer state (which itself is derived from emitted ids).
  const trace = traceFromRuntimeState(state);

  // Extra safety: ensure trace.remaining_ids matches emitted exercises exactly (stable order).
  // If mismatch ever occurs, reducer/mapper contract has drifted.
  const emittedRemainingIds = nextSession.exercises.map((e: Phase6SessionExercise) => e.exercise_id);
  if (emittedRemainingIds.join("|") !== trace.remaining_ids.join("|")) {
    // Hard fail: contract violation (should never happen).
    throw new Error("PHASE6_RUNTIME_TRACE_MISMATCH: trace.remaining_ids must equal emitted remaining exercises");
  }

  return { session: nextSession, trace };
}