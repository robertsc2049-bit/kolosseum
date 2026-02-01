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

/**
 * Phase 5 only needs a minimal program shape.
 * Contract:
 * - program.constraints is the canonical constraint contract produced by Phase 3 and carried through Phase 4.
 * - Phase 5 MUST NOT re-parse constraints from canonicalInput.
 * - canonicalInput is accepted for signature stability (engine/CLI callers) but is not consumed.
 */
type Phase5ProgramLike = {
  exercises?: ExerciseSignature[];
  planned_exercise_ids?: string[];
  exercise_pool?: Record<string, ExerciseSignature>;
  target_exercise_id?: string;

  // Canonical constraint keys only:
  // - avoid_joint_stress_tags
  // - banned_equipment
  // - available_equipment
  constraints?: SubstitutionConstraints;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isPhase5ProgramLike(program: unknown): program is Phase5ProgramLike {
  return isRecord(program);
}

function isNonEmptyStringArray(xs: unknown): xs is string[] {
  return Array.isArray(xs) && xs.every(v => typeof v === "string");
}

/**
 * Canonical constraint normalization:
 * - only canonical keys
 * - drop empty arrays
 * - dedupe
 * - no legacy aliases, no fallbacks
 */
function normalizeConstraints(raw: unknown): SubstitutionConstraints {
  const c = (isRecord(raw) ? (raw as any) : {}) as any;

  const avoid = isNonEmptyStringArray(c.avoid_joint_stress_tags)
    ? (c.avoid_joint_stress_tags as string[]).filter((s: string) => s.length > 0)
    : [];

  const banned = isNonEmptyStringArray(c.banned_equipment)
    ? (c.banned_equipment as string[]).filter((s: string) => s.length > 0)
    : [];

  const available = isNonEmptyStringArray(c.available_equipment)
    ? (c.available_equipment as string[]).filter((s: string) => s.length > 0)
    : [];

  const out: SubstitutionConstraints = {};
  if (avoid.length > 0) out.avoid_joint_stress_tags = Array.from(new Set(avoid));
  if (banned.length > 0) out.banned_equipment = Array.from(new Set(banned));
  if (available.length > 0) out.available_equipment = Array.from(new Set(available));
  return out;
}

function isEmptyConstraints(c: SubstitutionConstraints): boolean {
  const a = c.avoid_joint_stress_tags;
  const b = c.banned_equipment;
  const d = c.available_equipment;
  return (!a || a.length === 0) && (!b || b.length === 0) && (!d || d.length === 0);
}

function buildCandidateList(program: Phase5ProgramLike): ExerciseSignature[] {
  // Prefer exercise_pool because it can be made deterministic by key sort.
  if (isRecord(program.exercise_pool)) {
    const vals = Object.values(program.exercise_pool);
    const filtered = vals.filter((x: unknown) => isRecord(x) && typeof (x as any).exercise_id === "string") as ExerciseSignature[];
    filtered.sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
    return filtered;
  }

  if (Array.isArray(program.exercises)) return program.exercises;
  return [];
}

function resolveTargetId(program: Phase5ProgramLike, candidates: ExerciseSignature[]): string | null {
  const explicit =
    typeof program.target_exercise_id === "string" && program.target_exercise_id.length > 0
      ? program.target_exercise_id
      : null;
  if (explicit) return explicit;

  if (Array.isArray(program.planned_exercise_ids) && program.planned_exercise_ids.length > 0) {
    const first = String(program.planned_exercise_ids[0] ?? "");
    if (first) return first;
  }

  const firstCandidate = candidates[0]?.exercise_id;
  return typeof firstCandidate === "string" && firstCandidate.length > 0 ? firstCandidate : null;
}

function findById(candidates: ExerciseSignature[], id: string): ExerciseSignature | null {
  for (const c of candidates) {
    if (c.exercise_id === id) return c;
  }
  return null;
}

/**
 * Ticket 011 rule:
 * - If target is eligible under constraints => NO substitution (no-op).
 * - Only substitute when constraints disqualify the target (or target is missing).
 *
 * Hardened invariant:
 * - If constraints are empty, target is eligible by definition (no surprise substitutions).
 */
function isTargetEligible(target: ExerciseSignature, constraints: SubstitutionConstraints): boolean {
  if (isEmptyConstraints(constraints)) return true;

  // If target survives the scoring gate under its own constraints, it is eligible.
  const probe = pickBestSubstitute(target, [target], constraints);
  return !!probe && probe.selected_exercise_id === target.exercise_id;
}

export function phase5ApplySubstitutionAndAdjustment(program: unknown, _canonicalInput: unknown): Phase5Result {
  if (!isPhase5ProgramLike(program)) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5_STUB: program is not an object; no changes applied"]
    };
  }

  const candidates = buildCandidateList(program);
  if (candidates.length === 0) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: no candidates available (no exercises/exercise_pool); no changes applied"]
    };
  }

  const targetId = resolveTargetId(program, candidates);
  const target = targetId ? findById(candidates, targetId) : null;

  const constraints = normalizeConstraints(program.constraints);

  // Target missing => pick against fallback target
  if (!target) {
    const fallbackTarget = candidates[0];
    const pick = pickBestSubstitute(fallbackTarget, candidates, constraints);

    if (!pick) {
      return {
        ok: true,
        adjustments: [],
        notes: ["PHASE_5: target missing and no eligible substitute found; no changes applied"]
      };
    }

    if (pick.selected_exercise_id === fallbackTarget.exercise_id) {
      return {
        ok: true,
        adjustments: [],
        notes: ["PHASE_5: target missing; best candidate equals fallback; no changes applied"]
      };
    }

    return {
      ok: true,
      adjustments: [
        {
          adjustment_id: "SUBSTITUTE_EXERCISE",
          applied: true,
          reason: "substitution_engine_pick_target_missing",
          details: {
            target_exercise_id: fallbackTarget.exercise_id,
            substitute_exercise_id: pick.selected_exercise_id,
            score: pick.score,
            reasons: pick.reasons,
            constraints
          }
        }
      ],
      notes: ["PHASE_5: substitution applied (target missing)"]
    };
  }

  // Ticket 011: eligible => no-op
  if (isTargetEligible(target, constraints)) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: target eligible under constraints; no substitution (Ticket 011 rule)"]
    };
  }

  const pick = pickBestSubstitute(target, candidates, constraints);
  if (!pick) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: target disqualified but no eligible substitute found; no changes applied"]
    };
  }

  if (pick.selected_exercise_id === target.exercise_id) {
    return {
      ok: true,
      adjustments: [],
      notes: ["PHASE_5: scorer returned target despite ineligible signal; no changes applied"]
    };
  }

  return {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        reason: "substitution_engine_pick_target_disqualified",
        details: {
          target_exercise_id: target.exercise_id,
          substitute_exercise_id: pick.selected_exercise_id,
          score: pick.score,
          reasons: pick.reasons,
          constraints
        }
      }
    ],
    notes: ["PHASE_5: substitution applied (target disqualified by constraints)"]
  };
}


