import { pickBestSubstitute } from "../substitution/score.js";
import type { ExerciseSignature, SubstitutionConstraints } from "../substitution/types.js";

export type Phase5Adjustment = {
  adjustment_id: string;
  reason: string;
  applied: boolean;
  details?: unknown;
};

export type Phase5Result =
  | {
      ok: true;
      adjustments: Phase5Adjustment[];
      notes: string[];
    }
  | { ok: false; failure_token: string; details?: unknown };

// Minimal optional program shape we can act on (without breaking v0 stubs)
type SubstitutableProgram = {
  exercises: ExerciseSignature[];
  target_exercise_id?: string;
  constraints?: SubstitutionConstraints;
};

function isSubstitutableProgram(program: unknown): program is SubstitutableProgram {
  if (!program || typeof program !== "object") return false;
  const p: any = program;
  return Array.isArray(p.exercises);
}

type Phase1ConstraintsLike = {
  avoid_joint_stress_tags?: unknown;
  banned_equipment_ids?: unknown; // Phase1 envelope name
  available_equipment_ids?: unknown; // accepted by Phase1 schema; not consumed by substitution v0 contract
};

type Phase1CanonicalInputLike = {
  constraints?: Phase1ConstraintsLike;
};

type Phase1WrapperLike = {
  canonical_input?: Phase1CanonicalInputLike;
};

function mergeStringArrays(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  if (!a && !b) return undefined;
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

/**
 * Phase 5 must tolerate multiple canonical input shapes because different engine pipelines
 * may pass either:
 *  - the canonical_input object directly, OR
 *  - a wrapper { canonical_input: ... }
 *
 * This function extracts constraints safely and maps them into the existing SubstitutionConstraints contract.
 *
 * Contract mapping:
 *  - Phase1.constraints.avoid_joint_stress_tags -> SubstitutionConstraints.avoid_joint_stress_tags
 *  - Phase1.constraints.banned_equipment_ids    -> SubstitutionConstraints.banned_equipment (v0 token passthrough)
 *
 * NOTE: Phase1.constraints.available_equipment_ids is accepted by schema but NOT consumed here
 * because SubstitutionConstraints has no availability field yet. That is a future contract extension.
 */
function constraintsFromCanonicalInput(canonicalInput: unknown): SubstitutionConstraints {
  const root = canonicalInput as any;

  // Accept both shapes:
  // 1) wrapper: { canonical_input: { constraints: ... } }
  // 2) direct:  { constraints: ... }
  const canonical: Phase1CanonicalInputLike | undefined =
    (root && typeof root === "object" && "canonical_input" in root ? (root as Phase1WrapperLike).canonical_input : undefined) ??
    (root && typeof root === "object" ? (root as Phase1CanonicalInputLike) : undefined);

  const c = canonical?.constraints;

  const avoid_joint_stress_tags = Array.isArray(c?.avoid_joint_stress_tags) ? (c!.avoid_joint_stress_tags as string[]) : undefined;

  // Substitution contract uses banned_equipment (string tokens), not banned_equipment_ids.
  // v0: forward the Phase1 tokens as-is.
  const banned_equipment = Array.isArray(c?.banned_equipment_ids) ? (c!.banned_equipment_ids as string[]) : undefined;

  const out: SubstitutionConstraints = {};
  if (avoid_joint_stress_tags && avoid_joint_stress_tags.length > 0) out.avoid_joint_stress_tags = avoid_joint_stress_tags;
  if (banned_equipment && banned_equipment.length > 0) out.banned_equipment = banned_equipment;

  return out;
}

/**
 * Merge constraints deterministically.
 * Precedence: program.constraints overrides Phase 1 constraints for scalar fields.
 * Arrays: union-dedup (phase1 then program) so we don't accidentally drop disqualifiers.
 */
function mergeConstraints(fromPhase1: SubstitutionConstraints, fromProgram: SubstitutionConstraints | undefined): SubstitutionConstraints {
  if (!fromProgram) return fromPhase1;

  return {
    ...fromPhase1,
    ...fromProgram,
    avoid_joint_stress_tags: mergeStringArrays(fromPhase1.avoid_joint_stress_tags, fromProgram.avoid_joint_stress_tags),
    banned_equipment: mergeStringArrays(fromPhase1.banned_equipment, fromProgram.banned_equipment)
  };
}

export function phase5ApplySubstitutionAndAdjustment(program: unknown, canonicalInput: unknown): Phase5Result {
  // Default: preserve v0 behaviour
  if (!isSubstitutableProgram(program)) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5_STUB: no substitutable program shape found; no changes applied"]
    };
  }

  const exercises = program.exercises;
  if (exercises.length === 0) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: program has zero exercises; no changes applied"]
    };
  }

  const targetId = program.target_exercise_id ?? exercises[0]?.exercise_id;
  const target = exercises.find(x => x.exercise_id === targetId) ?? exercises[0];

  const phase1Constraints = constraintsFromCanonicalInput(canonicalInput);
  const effectiveConstraints = mergeConstraints(phase1Constraints, program.constraints);

  const pick = pickBestSubstitute(target, exercises, effectiveConstraints);
  if (!pick) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: no eligible substitute found; no changes applied"]
    };
  }

  if (pick.selected_exercise_id === target.exercise_id) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: best substitute equals target; no changes applied"]
    };
  }

  return {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        reason: "substitution_engine_pick",
        details: {
          target_exercise_id: target.exercise_id,
          substitute_exercise_id: pick.selected_exercise_id,
          score: pick.score,
          reasons: pick.reasons,
          constraints: effectiveConstraints
        }
      }
    ],
    notes: ["PHASE_5: substitution applied (guarded minimal shape)"]
  };
}
