// DEV NOTE: FULL-UI-35 - read-only exercise coaching-content lookup. Reads
// registries/exercise/exercise.registry.json directly (the same file the
// engine's compile-time loader reads) and never imports any engine-truth
// module - this is ordinary product-facing infrastructure, not a registry
// runtime path. Mirrors exercise_reference_media_service.ts's shape, but
// surfaces the written instruction/coaching_cues/common_faults fields
// instead of the (still-empty) reference_media field.

import fs from "node:fs";
import path from "node:path";

const EXERCISE_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "exercise",
  "exercise.registry.json"
);

export class ExerciseContentError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export type ExerciseInstruction = Readonly<{
  short: string;
  detailed?: readonly string[];
}>;

export type ExerciseContentResult = Readonly<{
  exercise_id: string;
  instruction: ExerciseInstruction;
  coaching_cues: readonly string[];
  common_faults: readonly string[];
}>;

function loadExerciseRegistryEntries(): Record<
  string,
  {
    instruction_short_text?: string;
    instruction_detail_text?: readonly string[];
    coaching_cues?: readonly string[];
    common_faults?: readonly string[];
  }
> {
  const raw = fs.readFileSync(EXERCISE_REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return (parsed?.entries ?? {}) as Record<
    string,
    {
      instruction_short_text?: string;
      instruction_detail_text?: readonly string[];
      coaching_cues?: readonly string[];
      common_faults?: readonly string[];
    }
  >;
}

export async function getExerciseContent(exerciseId: string): Promise<ExerciseContentResult> {
  const trimmedId = exerciseId.trim();
  if (!trimmedId) {
    throw new ExerciseContentError(400, "exercise_id_required");
  }

  const entries = loadExerciseRegistryEntries();
  const entry = entries[trimmedId];
  if (!entry) {
    throw new ExerciseContentError(404, "exercise_not_found");
  }

  return Object.freeze({
    exercise_id: trimmedId,
    instruction: Object.freeze({
      short: entry.instruction_short_text ?? "",
      detailed: Array.isArray(entry.instruction_detail_text) ? entry.instruction_detail_text : []
    }),
    coaching_cues: entry.coaching_cues ?? [],
    common_faults: entry.common_faults ?? []
  });
}
