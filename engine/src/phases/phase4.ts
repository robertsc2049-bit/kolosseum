
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import path from "node:path";
import { loadExerciseEntriesFromPath } from "../registries/loadExerciseEntries.js";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Output } from "./phase3.js";
import {
  assembleBeta11Phase4Program,
  hasBeta11Phase4Enumeration
} from "./beta11Phase4Enumeration.js";

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
  type Phase4Program,
  type Beta11ActivityId,
  type Phase4StructuralCandidate,
  type Phase4EnumerationOutput,
  type Beta11Phase4EnumerationResult
} from "./phase4_builders.js";

export type { Beta11ActivityId, Phase4StructuralCandidate, Phase4EnumerationOutput, Beta11Phase4EnumerationResult, PlannedItemRole, PlannedItemIntensity, PlannedItem, Phase4Program, Phase4Result, Phase4Options };

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

export function phase4AssembleProgram(
  phase3: Phase3Output,
  opts?: Phase4Options
): Phase4Result;
export function phase4AssembleProgram(
  canonicalInput: any,
  phase3: Phase3Output,
  opts?: Phase4Options
): Phase4Result;
export function phase4AssembleProgram(
  canonicalInputOrPhase3: any,
  phase3OrOpts: Phase3Output | Phase4Options = {},
  maybeOpts: Phase4Options = {}
): Phase4Result {
  const directPhase3 =
    canonicalInputOrPhase3 &&
    typeof canonicalInputOrPhase3 === "object" &&
    canonicalInputOrPhase3.constraints_resolved === true
      ? canonicalInputOrPhase3 as Phase3Output
      : null;

  const legacyPhase3 =
    phase3OrOpts &&
    typeof phase3OrOpts === "object" &&
    "constraints_resolved" in phase3OrOpts
      ? phase3OrOpts as Phase3Output
      : null;

  const betaPhase3 =
    directPhase3 && hasBeta11Phase4Enumeration(directPhase3)
      ? directPhase3
      : legacyPhase3 && hasBeta11Phase4Enumeration(legacyPhase3)
        ? legacyPhase3
        : null;

  // BETA-11 runs before canonical input, registry, or template access.
  if (betaPhase3) {
    return assembleBeta11Phase4Program(betaPhase3);
  }

  const canonicalInput = canonicalInputOrPhase3;
  const phase3 = legacyPhase3;
  const opts = legacyPhase3
    ? maybeOpts
    : phase3OrOpts as Phase4Options;

  if (!phase3) {
    return {
      ok: false,
      failure_token: "phase4_binding_mismatch"
    };
  }

  const activity = String(canonicalInput?.activity_id ?? "");

  // Registry source for the unchanged legacy path.
  const registry = loadRegistry(opts);
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
