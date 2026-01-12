export type Phase5Adjustment = {
  adjustment_id: string;
  reason: string;
  applied: boolean;
};

export type Phase5Result =
  | {
      ok: true;
      adjustments: Phase5Adjustment[];
      notes: string[];
    }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 5 (v0 stub)
 * - No substitution logic yet
 * - No registry-driven edits yet
 * - Deterministic empty adjustments
 */
export function phase5ApplySubstitutionAndAdjustment(_program: unknown, _canonicalInput: unknown): Phase5Result {
  return {
    ok: true,
    adjustments: [],
    notes: ["PHASE_5_STUB: substitution/adjustment not yet implemented"]
  };
}
