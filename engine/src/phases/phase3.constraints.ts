/**
 * Phase3Constraints — canonical, closed-world constraint contract
 * EB2-1.0.0
 *
 * Rules:
 * - Canonical keys only. No legacy keys. No aliases.
 * - {} is valid (envelope present but empty).
  * - undefined means "envelope absent" (Phase 3 may inject deterministic v0 defaults if permitted).
 * - Arrays must be de-duped + sorted lexicographically for determinism.
 */
export type Phase3Constraints = {
  avoid_joint_stress_tags?: string[];
  banned_equipment?: string[];
  available_equipment?: string[];
};

export function isEmptyConstraints(c: Phase3Constraints | undefined): boolean {
  if (!c) return true;
  const a = c.avoid_joint_stress_tags;
  const b = c.banned_equipment;
  const d = c.available_equipment;
  return (!a || a.length === 0) && (!b || b.length === 0) && (!d || d.length === 0);
}


