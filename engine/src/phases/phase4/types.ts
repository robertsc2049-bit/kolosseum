import type { ExerciseSignature } from "../../substitution/types.js";
import type { Phase3Constraints, Phase3Output } from "../phase3.js";

export type PlannedItemRole = "primary" | "accessory";

export type PlannedItemIntensity =
  | { type: "percent_1rm"; value: number }
  | { type: "rpe"; value: number }
  | { type: "load"; value: number };

export type PlannedItem = {
  block_id: string;
  item_id: string;
  exercise_id: string;

  // v1 prescription-ready fields (authoritative for Phase6 rendering)
  session_id: string;
  role: PlannedItemRole;
  sets: number;
  reps: number;
  intensity: PlannedItemIntensity;
  rest_seconds: number;
};

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  // Authoritative plan
  planned_items: PlannedItem[];

  // Derived convenience only (do not treat as authoritative)
  planned_exercise_ids: string[];

  // Candidate pool for substitution
  exercises: ExerciseSignature[];
  exercise_pool: Record<string, ExerciseSignature>;

  // Phase5 target selection hint
  target_exercise_id: string;

  // Canonical constraints (Phase3 authoritative)
  constraints?: Phase3Constraints;
};

export type Phase4Result =
  | { ok: true; program: Phase4Program; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

export type Phase4Options = {
  /**
   * Optional injection seam for tests and future callers.
   * If provided, Phase4 will NOT read the registry from disk.
   */
  entries?: Record<string, ExerciseSignature>;
};

export type Phase4Template = {
  program_id: string;
  intent: string[];
};

export type RegistryLoad = {
  entries: Record<string, ExerciseSignature>;
  registry_path: string;
};

export type AssembleSupportedProgramArgs = {
  canonicalInput: any;
  phase3: Phase3Output;
  template: Phase4Template;
  registry: RegistryLoad;
};
