// engine/src/runtime/types.ts
export type RuntimeEvent =
  | { type: "complete_exercise"; exercise_id: string }
  | { type: "skip_exercise"; exercise_id: string }
  | { type: "split_start" }
  | { type: "split_return_continue" }
  | { type: "split_return_skip" };

export type RuntimeState = {
  // Linear ordered list of exercise_ids (the current remaining plan)
  remaining_ids: string[];

  // Terminal sets for invariants
  completed_ids: Set<string>;
  skipped_ids: Set<string>;

  // When split is active, snapshot remaining at split time
  split?: {
    active: boolean;
    remaining_at_split: string[];
  };
};
