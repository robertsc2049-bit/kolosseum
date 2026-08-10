// DEV NOTE: FULL-UI-30 - read-only exercise reference-media lookup. Reads
// registries/exercise/exercise.registry.json directly (the same file the
// engine's compile-time loader reads) and never imports any engine-truth
// module - this is ordinary product-facing infrastructure, not a registry
// runtime path.
// S-REG-34 added the optional reference_media field to the exercise
// schema but gave it no value on any of the 19 live entries, so every
// response from this service is {reference_media: null} until a later
// slice adds real content.

import fs from "node:fs";
import path from "node:path";

const EXERCISE_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "exercise",
  "exercise.registry.json"
);

export class ExerciseReferenceMediaError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export type ExerciseReferenceMedia = Readonly<{
  video_url: string;
  thumbnail_url?: string;
  source: "coach_entered" | "admin_entered";
}>;

export type ExerciseReferenceMediaResult = Readonly<{
  exercise_id: string;
  reference_media: ExerciseReferenceMedia | null;
}>;

function loadExerciseRegistryEntries(): Record<string, { reference_media?: ExerciseReferenceMedia }> {
  const raw = fs.readFileSync(EXERCISE_REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return (parsed?.entries ?? {}) as Record<string, { reference_media?: ExerciseReferenceMedia }>;
}

export async function getExerciseReferenceMedia(exerciseId: string): Promise<ExerciseReferenceMediaResult> {
  const trimmedId = exerciseId.trim();
  if (!trimmedId) {
    throw new ExerciseReferenceMediaError(400, "exercise_id_required");
  }

  const entries = loadExerciseRegistryEntries();
  const entry = entries[trimmedId];
  if (!entry) {
    throw new ExerciseReferenceMediaError(404, "exercise_not_found");
  }

  return Object.freeze({
    exercise_id: trimmedId,
    reference_media: entry.reference_media ?? null
  });
}
