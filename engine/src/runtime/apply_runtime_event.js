import { applyRuntimeEvent, makeRuntimeState } from "./session_runtime.js";

function isRecord(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function die(msg) {
  throw new Error(String(msg));
}

function validateRuntimeEvent(ev) {
  if (!isRecord(ev)) die("runtime event must be an object");
  if (typeof ev.type !== "string" || ev.type.length === 0) die("runtime event missing string 'type'");

  // This file defines the canonical Phase6 runtime event vocabulary for now.
  // If/when you add new runtime events, update this switch + tests in lockstep.
  switch (ev.type) {
    case "COMPLETE_EXERCISE":
    case "SKIP_EXERCISE": {
      if (typeof ev.exercise_id !== "string" || ev.exercise_id.length === 0) {
        die(`${ev.type}: missing string exercise_id`);
      }
      return;
    }

    case "SPLIT_SESSION":
    case "RETURN_CONTINUE":
    case "RETURN_SKIP": {
      // no required fields
      return;
    }

    default:
      die(`unknown runtime event type: ${ev.type}`);
  }
}

/**
 * Apply a sequence of runtime events to a Phase6 session, producing runtime state.
 * This is the canonical wrapper used by E2E/runtime tests and API callers.
 *
 * Contract (per tests):
 * - returns an object with:
 *   - completed_exercises: array
 *   - remaining_exercises: array
 *   - dropped_exercises: array
 * - unknown event types hard-fail
 * - deterministic for identical inputs + events
 */
export function applyRuntimeEvents(session, runtimeEvents) {
  const events = Array.isArray(runtimeEvents) ? runtimeEvents : [];
  let state = makeRuntimeState(session);

  for (const ev of events) {
    validateRuntimeEvent(ev);

    // Support either functional or mutating reducer style.
    const next = applyRuntimeEvent(state, ev);
    if (typeof next !== "undefined") state = next;
  }

  return state;
}
