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

  // Split/return decision gate surface (UI should key off these, not infer)
  split_active?: boolean;
  return_decision_required?: boolean;
  return_decision_options?: Array<"RETURN_CONTINUE" | "RETURN_SKIP">;

  // Debug/hardening (engine keeps these in sync)
  remaining_at_split_ids?: string[];

  [k: string]: unknown;
};

/**
 * Apply a sequence of runtime events to a Phase6 session, producing runtime state.
 */
export declare function applyRuntimeEvents(session: unknown, runtimeEvents: RuntimeEvent[]): RuntimeState;