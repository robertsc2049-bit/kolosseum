/**
 * Mutators/utilities for registry test shaping.
 * Keep these tiny and boring. This file exists to prevent tests re-implementing
 * subtle “shape normalization” logic in multiple places.
 */

/**
 * Ensure a movement entry has an equipment token list field we can mutate.
 * We intentionally support a couple of plausible field names.
 *
 * Returns: { key, arr }
 * - key: which field name was selected/created
 * - arr: the live array reference on the movement entry
 */
export function ensureMovementEquipmentArray(movementEntry) {
  if (!movementEntry || typeof movementEntry !== "object") {
    return { key: "equipment_tokens", arr: [] };
  }

  // Prefer the field name used by the guard in code/comments.
  if (Array.isArray(movementEntry.equipment_tokens)) {
    return { key: "equipment_tokens", arr: movementEntry.equipment_tokens };
  }

  // Support older/alternate seeds.
  if (Array.isArray(movementEntry.equipment)) {
    return { key: "equipment", arr: movementEntry.equipment };
  }

  // Default: create equipment_tokens.
  movementEntry.equipment_tokens = [];
  return { key: "equipment_tokens", arr: movementEntry.equipment_tokens };
}
