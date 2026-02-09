// engine/src/phases/phase6.runtime.ts
import type { Phase6SessionOutput, Phase6SessionExercise } from "./phase6.js";
import { applyRuntimeEvent, makeRuntimeState } from "../runtime/session_runtime.js";
import type { RuntimeEvent } from "../runtime/types.js";

export type Phase6RuntimeTrace = {
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];

  // Canonical split semantics from reducer state:
  // - split_active: are we currently in a split state
  // - remaining_at_split_ids: authoritative snapshot captured at split time
  split_active: boolean;
  remaining_at_split_ids: string[];

  // Convenience for UI: if true, client should force a return decision gate.
  // (You can render "Continue where I left off" vs "Skip and move on".)
  return_gate_required: boolean;
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

// Back-compat reader: accept either canonical reducer fields OR legacy nested split shape.
function readSplitActive(state: unknown): boolean {
  if (!isRecord(state)) return false;

  if (typeof (state as Record<string, unknown>).split_active === "boolean") {
    return (state as Record<string, unknown>).split_active === true;
  }

  const split = (state as Record<string, unknown>).split;
  if (isRecord(split) && typeof (split as Record<string, unknown>).active === "boolean") {
    return (split as Record<string, unknown>).active === true;
  }

  return false;
}

function readRemainingAtSplitIds(state: unknown): string[] {
  if (!isRecord(state)) return [];

  const a = (state as Record<string, unknown>).remaining_at_split_ids;
  if (Array.isArray(a)) return a.map((x) => String(x));

  const split = (state as Record<string, unknown>).split;
  if (isRecord(split)) {
    const b = (split as Record<string, unknown>).remaining_at_split;
    if (Array.isArray(b)) return b.map((x) => String(x));
  }

  // Some older callers use remaining_at_split_ids under different keys; keep this tight for now.
  return [];
}

function traceFromRuntimeState(state: unknown): Phase6RuntimeTrace {
  const remaining_ids = isRecord(state) ? normalizeStringArray(state.remaining_ids) : [];
  const completed_ids = isRecord(state) ? Array.from(normalizeStringSet(state.completed_ids)) : [];
  const dropped_ids = isRecord(state) ? Array.from(normalizeStringSet(state.skipped_ids)) : [];

  const split_active = readSplitActive(state);
  const remaining_at_split_ids = readRemainingAtSplitIds(state);

  // Gate should be required when split is active AND there is anything that was remaining at split time.
  // (If remaining_at_split_ids is empty, it's effectively a no-op split.)
  const return_gate_required = split_active === true && remaining_at_split_ids.length > 0;

  return {
    remaining_ids,
    completed_ids,
    dropped_ids,
    split_active,
    remaining_at_split_ids,
    return_gate_required
  };
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
 *   - trace derived ONLY from reducer state (remaining/completed/dropped + split semantics)
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
