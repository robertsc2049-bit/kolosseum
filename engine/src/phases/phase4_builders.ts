export type {
  PlannedItemRole,
  PlannedItemIntensity,
  PlannedItem,
  Phase4Program,
  Phase4Result,
  Phase4Options,
  Phase4Template,
  RegistryLoad
} from "./phase4/types.js";

export { uniqueStable } from "./phase4/util.js";
export { selectTemplate } from "./phase4/templates.js";

export {
  plannedItemsFromIntent,
  buildPlannedItems,
  derivePlannedExerciseIds,
  deriveTargetExerciseId
} from "./phase4/planned_items.js";

export { readSessionTimeboxMinutes, applyTimeboxDeterministic } from "./phase4/timebox.js";

export { guardPlannedIdsExist, buildExercisePool } from "./phase4/exercise_pool.js";

export { assembleSupportedProgram } from "./phase4/assemble.js";
