/**
 * Phase3Constraints — canonical, closed-world constraint contract
 * Ticket 014
 *
 * Rules:
 * - Keys are final and authoritative.
 * - Empty object {} is valid and semantically meaningful.
 * - Undefined means "envelope absent".
 * - Arrays must already be deduplicated + sorted by Phase3.
 */

export type Phase3Constraints = {
  avoid_joint_stress_tags?: string[];
  banned_equipment_ids?: string[];
  available_equipment_ids?: string[];
};

/**
 * Utility guards (Phase3 only)
 */
export function isEmptyConstraints(c: Phase3Constraints | undefined): boolean {
  if (!c) return true;
  return (
    (!c.avoid_joint_stress_tags || c.avoid_joint_stress_tags.length === 0) &&
    (!c.banned_equipment_ids || c.banned_equipment_ids.length === 0) &&
    (!c.available_equipment_ids || c.available_equipment_ids.length === 0)
  );
}
