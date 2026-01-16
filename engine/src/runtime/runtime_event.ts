export type RuntimeEvent =
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" };

export function assertRuntimeEvent(e: any): asserts e is RuntimeEvent {
  if (!e || typeof e !== "object") {
    throw new Error("Invalid runtime event: not an object");
  }

  switch (e.type) {
    case "COMPLETE_EXERCISE":
    case "SKIP_EXERCISE":
      if (typeof e.exercise_id !== "string") {
        throw new Error(`Invalid runtime event: ${e.type} requires exercise_id`);
      }
      return;

    case "SPLIT_SESSION":
    case "RETURN_CONTINUE":
    case "RETURN_SKIP":
      return;

    default:
      throw new Error(`Unknown runtime event type: ${String(e.type)}`);
  }
}
