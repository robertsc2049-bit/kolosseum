// DEV NOTE: BETA-11 deterministic legal structural enumeration. This module consumes the direct Phase 3 binding output only and does not read canonical input, registries, templates, product state, runtime state, or coach notes.

import { betaCanonicalHash } from "./betaCanonical.js";
import type { Phase3Output } from "./phase3.js";
import type {
  Beta11ActivityId,
  Beta11Phase4EnumerationResult,
  Phase4EnumerationOutput,
  Phase4Result,
  Phase4StructuralCandidate
} from "./phase4/types.js";

const supportedActivities = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
] as const);

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSupportedActivity(value: unknown): value is Beta11ActivityId {
  return typeof value === "string" &&
    (supportedActivities as readonly string[]).includes(value);
}

function fail(
  failure_token:
    | "phase4_binding_mismatch"
    | "empty_solution_space"
    | "unknown_enum_value"
    | "nondeterminism_detected"
): Beta11Phase4EnumerationResult {
  return { ok: false, failure_token };
}

function structuralIdentity(candidate: Phase4StructuralCandidate): string {
  return candidate.activity_id + "\u0000" + candidate.exercise_ids.join("\u0000");
}

export function hasBeta11Phase4Enumeration(phase3: Phase3Output): boolean {
  return isRecord(phase3.allowed_solution_space_descriptor);
}

export function enumerateBeta11Phase4(
  phase3: Phase3Output
): Beta11Phase4EnumerationResult {
  const canonical_input_hash = phase3.canonical_input_hash;
  const constraint_hash = phase3.constraint_hash;
  const descriptor = phase3.allowed_solution_space_descriptor;

  if (
    typeof canonical_input_hash !== "string" ||
    canonical_input_hash.length === 0 ||
    typeof constraint_hash !== "string" ||
    constraint_hash.length === 0 ||
    !isRecord(descriptor)
  ) {
    return fail("phase4_binding_mismatch");
  }

  if (betaCanonicalHash(descriptor) !== constraint_hash) {
    return fail("phase4_binding_mismatch");
  }

  if (!isSupportedActivity(descriptor.activity_id)) {
    return fail("unknown_enum_value");
  }

  if (!Array.isArray(descriptor.exercise_ids)) {
    return fail("unknown_enum_value");
  }

  const exerciseIds: string[] = [];
  for (const value of descriptor.exercise_ids) {
    if (typeof value !== "string" || value.length === 0) {
      return fail("unknown_enum_value");
    }
    exerciseIds.push(value);
  }

  if (exerciseIds.length === 0) {
    return fail("empty_solution_space");
  }

  if (new Set(exerciseIds).size !== exerciseIds.length) {
    return fail("nondeterminism_detected");
  }

  const enumerated_solution_space: Phase4StructuralCandidate[] =
    exerciseIds
      .map((exerciseId) => ({
        activity_id: descriptor.activity_id as Beta11ActivityId,
        exercise_ids: [exerciseId] as [string]
      }))
      .sort((left, right) =>
        ordinal(structuralIdentity(left), structuralIdentity(right))
      );

  const output: Phase4EnumerationOutput = {
    canonical_input_hash,
    constraint_hash,
    enumeration_hash: betaCanonicalHash(enumerated_solution_space),
    enumerated_solution_space
  };

  return { ok: true, phase4: output };
}

export function assembleBeta11Phase4Program(
  phase3: Phase3Output
): Phase4Result {
  const result = enumerateBeta11Phase4(phase3);
  if (result.ok === false) return result;

  return {
    ok: true,
    phase4: result.phase4,
    program: {
      program_id: "BETA_11_PHASE_4_ENUMERATION",
      version: "1.0.0",
      blocks: [],
      planned_items: [],
      planned_exercise_ids: [],
      exercises: [],
      exercise_pool: {},
      target_exercise_id: "",
      canonical_input_hash: result.phase4.canonical_input_hash,
      constraint_hash: result.phase4.constraint_hash,
      enumeration_hash: result.phase4.enumeration_hash,
      enumerated_solution_space: result.phase4.enumerated_solution_space
    },
    notes: []
  };
}
