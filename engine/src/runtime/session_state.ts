import type { Phase6SessionExercise } from "../phases/phase6.js";

export type SessionState = {
  remaining_exercises: Phase6SessionExercise[];
  completed_exercises: Phase6SessionExercise[];
  dropped_exercises: Phase6SessionExercise[];
  event_log: ReadonlyArray<unknown>;
};

export function initialSessionState(
  session: { exercises: Phase6SessionExercise[] }
): SessionState {
  return {
    remaining_exercises: [...session.exercises],
    completed_exercises: [],
    dropped_exercises: [],
    event_log: []
  };
}
