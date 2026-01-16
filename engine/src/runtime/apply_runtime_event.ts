import type { Phase6SessionExercise } from "../phases/phase6.js";
import type { RuntimeEvent } from "./runtime_event.js";
import { assertRuntimeEvent } from "./runtime_event.js";
import { initialSessionState, type SessionState } from "./session_state.js";

function removeById(
  list: Phase6SessionExercise[],
  exercise_id: string
): [Phase6SessionExercise | undefined, Phase6SessionExercise[]] {
  const idx = list.findIndex(e => e.exercise_id === exercise_id);
  if (idx === -1) return [undefined, list];
  const found = list[idx];
  return [found, [...list.slice(0, idx), ...list.slice(idx + 1)]];
}

export function applyRuntimeEvents(
  session: { exercises: Phase6SessionExercise[] },
  events: unknown[]
): SessionState {
  let state = initialSessionState(session);

  for (const raw of events) {
    assertRuntimeEvent(raw);
    const e = raw as RuntimeEvent;

    switch (e.type) {
      case "COMPLETE_EXERCISE": {
        const [ex, remaining] = removeById(
          state.remaining_exercises,
          e.exercise_id
        );
        if (ex) {
          state = {
            ...state,
            remaining_exercises: remaining,
            completed_exercises: [...state.completed_exercises, ex],
            event_log: [...state.event_log, e]
          };
        }
        break;
      }

      case "SKIP_EXERCISE": {
        const [ex, remaining] = removeById(
          state.remaining_exercises,
          e.exercise_id
        );
        if (ex) {
          state = {
            ...state,
            remaining_exercises: remaining,
            dropped_exercises: [...state.dropped_exercises, ex],
            event_log: [...state.event_log, e]
          };
        }
        break;
      }

      case "SPLIT_SESSION": {
        state = {
          ...state,
          event_log: [...state.event_log, e]
        };
        break;
      }

      case "RETURN_CONTINUE": {
        state = {
          ...state,
          event_log: [...state.event_log, e]
        };
        break;
      }

      case "RETURN_SKIP": {
        state = {
          remaining_exercises: [],
          completed_exercises: state.completed_exercises,
          dropped_exercises: [
            ...state.dropped_exercises,
            ...state.remaining_exercises
          ],
          event_log: [...state.event_log, e]
        };
        break;
      }
    }
  }

  return state;
}
