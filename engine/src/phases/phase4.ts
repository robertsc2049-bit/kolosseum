import path from "node:path";
import { loadExerciseEntriesFromPath } from "../registries/loadExerciseEntries.js";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Output } from "./phase3.js";

import {
  assembleSupportedProgram,
  selectTemplate,
  type Phase4Options,
  type Phase4Result,
  type RegistryLoad,

  // re-exported public types
  type PlannedItem,
  type PlannedItemIntensity,
  type PlannedItemRole,
  type Phase4Program
} from "./phase4_builders.js";

export type { PlannedItemRole, PlannedItemIntensity, PlannedItem, Phase4Program, Phase4Result, Phase4Options };

function repoRoot(): string {
  return process.cwd();
}

function loadEntriesFromDisk(): RegistryLoad {
  const regPath = path.join(repoRoot(), "registries", "exercise", "exercise.registry.json");
  const entries = loadExerciseEntriesFromPath(regPath);
  return { entries, registry_path: regPath };
}

function loadRegistry(opts: Phase4Options): RegistryLoad {
  return opts.entries
    ? { entries: opts.entries as Record<string, ExerciseSignature>, registry_path: "INJECTED_ENTRIES" }
    : loadEntriesFromDisk();
}

export function phase4AssembleProgram(canonicalInput: any, phase3: Phase3Output, opts: Phase4Options = {}): Phase4Result {
  const activity = String(canonicalInput?.activity_id ?? "");

  // Registry source (disk by default; injectable for tests/future)
  const registry = loadRegistry(opts);

  /**
   * Phase4 contract (v1):
   * - Emits a MULTI-exercise plan for supported activities (>=2 planned items).
   * - planned_items are authoritative and prescription-ready.
   * - planned_exercise_ids are derived convenience ONLY.
   * - Carries Phase3 canonical constraints forward on program.constraints (authoritative).
   * - Provides deterministic exercise_pool for Phase5 scoring and substitution.
   * - Sets target_exercise_id to derived planned_exercise_ids[0].
   * - Applies deterministic timebox pruning via constraints.schedule.session_timebox_minutes.
   * - Hardening: FAIL HARD if any planned exercise_id is missing from registry.
   */

  const template = selectTemplate(activity);

  if (!template) {
    return {
      ok: true,
      program: {
        program_id: "PROGRAM_STUB",
        version: "1.0.0",
        blocks: [],
        planned_items: [],
        planned_exercise_ids: [],
        exercises: [],
        exercise_pool: {},
        target_exercise_id: "",
        constraints: phase3.constraints
      },
      notes: ["PHASE_4_STUB"]
    };
  }

  return assembleSupportedProgram({
    canonicalInput,
    phase3,
    template,
    registry
  });
}

export default phase4AssembleProgram;