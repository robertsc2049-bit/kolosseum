// engine/src/phases/phase6.runtime.ts
import type { Phase6SessionOutput } from "./phase6.js";
import { applyRuntimeEvent, makeRuntimeState } from "../runtime/session_runtime.js";
import type { RuntimeEvent } from "../runtime/types.js";

/**
 * Runtime wrapper:
 * - Converts session exercises -> planned ids
 * - Applies events deterministically
 * - Returns a new Phase6SessionOutput with remaining exercises only
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
