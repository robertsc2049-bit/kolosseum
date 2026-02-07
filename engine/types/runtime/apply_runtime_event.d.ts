export type RuntimeEvent =
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" };

export type RuntimeExerciseRef = { exercise_id: string };

export type RuntimeState = {
  completed_exercises: RuntimeExerciseRef[];
  remaining_exercises: RuntimeExerciseRef[];
  dropped_exercises: RuntimeExerciseRef[];
  [k: string]: unknown;
};

/**
 * Apply a sequence of runtime events to a Phase6 session, producing runtime state.
 */
export declare function applyRuntimeEvents(session: unknown, runtimeEvents: RuntimeEvent[]): RuntimeState;
