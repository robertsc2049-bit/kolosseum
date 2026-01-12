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

export function phase5ApplySubstitutionAndAdjustment(program: unknown, _canonicalInput: unknown): Phase5Result {
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

  const pick = pickBestSubstitute(target, exercises, program.constraints ?? {});
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
          reasons: pick.reasons
        }
      }
    ],
    notes: ["PHASE_5: substitution applied (guarded minimal shape)"]
  };
}
