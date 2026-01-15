/**
 * Phase3Constraints — canonical, closed-world constraint contract
 * Ticket 014+
 *
 * Rules:
 * - Keys are final and authoritative end-to-end.
 * - Empty object {} is valid and semantically meaningful (envelope present).
 * - Undefined means "envelope absent".
 * - Arrays must be de-duped + sorted by Phase3 for determinism.
 */
export type Phase3Constraints = {
  avoid_joint_stress_tags?: string[];
  banned_equipment?: string[];
  available_equipment?: string[];
};

export function isEmptyConstraints(c: Phase3Constraints | undefined): boolean {
  if (!c) return true;
  return (
    (!c.avoid_joint_stress_tags || c.avoid_joint_stress_tags.length === 0) &&
    (!c.banned_equipment || c.banned_equipment.length === 0) &&
    (!c.available_equipment || c.available_equipment.length === 0)
  );
}


