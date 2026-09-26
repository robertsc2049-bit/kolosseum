
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import { loadRegistryBundle } from "../registries/loadRegistryBundle.js";
import { applySelectionsToDay, listProgrammeSlots, type ExerciseSelections, type SlotConstraints, type SlotContext, type SlotListing } from "./phase4/exercise_slots.js";
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
  templateForCycle,
  programmeDays,
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
    "constraints" in phase3OrOpts
      ? phase3OrOpts as Phase3Output
      : null;

  const betaPhase3 =
    directPhase3 && hasBeta11Phase4Enumeration(directPhase3)
      ? directPhase3
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
  const level = typeof canonicalInput?.experience_level === "string" ? canonicalInput.experience_level : undefined;
  const event = typeof canonicalInput?.competition_event === "string" ? canonicalInput.competition_event : undefined;
  const selected = selectTemplate(activity, level, event);
  const cycle = canonicalInput?.training_cycle;
  const fastExecution = (exerciseId: string) => (registry.entries[exerciseId] as { fast_execution?: unknown } | undefined)?.fast_execution === true;
  const cycled = selected && cycle ? templateForCycle(selected, activity, cycle, level, fastExecution) : selected;

  // A caller that declares exercise choices gets the athlete's own exercises
  // in every open slot - and a refusal, never a default, for an empty one.
  let template = cycled;
  const selections = canonicalInput?.exercise_selections;
  if (cycled && selections && typeof selections === "object") {
    const applied = applySelectionsToDay(cycled.day_id ?? "base", cycled.intent, cycled.prescriptions, selections,
      slotContext(activity, level, registry.entries, phase3?.constraints));
    if (!applied.ok) return { ok: false, failure_token: applied.failure_token, details: applied.details };
    template = { ...cycled, intent: applied.intent };
  }

  if (!template) {
    return {
      ok: false,
      failure_token: "phase4_unsupported_activity"
    };
  }

  return assembleSupportedProgram({
    canonicalInput,
    phase3,
    template,
    registry
  });
}

// The slot context: the exercise registry, the sport's training applicability,
// the athlete's level and their declared constraints.
function slotContext(activity: string, level: string | undefined, exercises: Record<string, unknown>, constraints: unknown): SlotContext {
  const bundle = loadRegistryBundle() as { registries?: Record<string, { entries?: Record<string, unknown> }> };
  const applicability = (bundle?.registries?.["exercise_activity_applicability"]?.entries ?? {}) as SlotContext["applicability"];
  return { activity, level, exercises: exercises as SlotContext["exercises"], applicability, constraints: (constraints ?? {}) as SlotConstraints };
}

// Every day of an athlete's programme with its fixed exercises and open slots
// (and the exercises recommended for each), so they can choose before
// training; with their saved choices, whether each is a recommended one.
export function describeProgrammeSlots(input: {
  activity_id: string;
  experience_level?: string;
  competition_event?: string;
  days_per_week?: number;
  constraints?: SlotConstraints;
  selections?: ExerciseSelections;
}): SlotListing[] | null {
  const template = selectTemplate(input.activity_id, input.experience_level, input.competition_event);
  if (!template) return null;
  const registry = loadEntriesFromDisk();
  return listProgrammeSlots(programmeDays(template, input.days_per_week),
    slotContext(input.activity_id, input.experience_level, registry.entries, input.constraints), input.selections);
}

export default phase4AssembleProgram;

// Periodisation vocabulary for callers that declare an athlete's training cycle.
export { ALL_MACRO_PHASES, MACRO_PHASES_BY_MODEL, cycleModelFor, sessionsPerWeek } from "./phase4/periodisation.js";
export type { CycleModel, TrainingCycle, TrainingCycleOutput } from "./phase4/periodisation.js";
export { recommendedExercisesForSlot, slotFitIssue, slotIdsForDay } from "./phase4/exercise_slots.js";
export type { ExerciseSelections, SlotListing } from "./phase4/exercise_slots.js";
