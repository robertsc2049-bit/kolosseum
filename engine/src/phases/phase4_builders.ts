
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

export type {
  PlannedItemRole,
  PlannedItemIntensity,
  PlannedItem,
  Phase4Program,
  Phase4Result,
  Phase4Options,
  Phase4Template,
  RegistryLoad,
  Beta11ActivityId,
  Phase4StructuralCandidate,
  Phase4EnumerationOutput,
  Beta11Phase4EnumerationResult
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

export {
  assembleBeta11Phase4Program,
  enumerateBeta11Phase4,
  hasBeta11Phase4Enumeration
} from "./beta11Phase4Enumeration.js";
