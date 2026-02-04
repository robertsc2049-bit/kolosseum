import type { PlannedItem } from "./types.js";

/**
 * Read timebox minutes with hardening:
 * - prefer Phase3 canonical constraints over raw input.
 */
export function readSessionTimeboxMinutes(canonicalInput: any, phase3Constraints?: any): number {
  const tb =
    phase3Constraints?.schedule?.session_timebox_minutes ??
    canonicalInput?.constraints?.schedule?.session_timebox_minutes ??
    NaN;

  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return n;
}

/**
 * Timebox pruning (deterministic):
 * - If no timebox: unchanged
 * - Always keep all primaries
 * - tb < 30: drop all accessories
 * - tb < 45: keep at most 1 accessory (stable order)
 */
export function applyTimeboxDeterministic(items: PlannedItem[], timeboxMinutes: number): PlannedItem[] {
  if (!Number.isFinite(timeboxMinutes)) return items;

  if (timeboxMinutes < 30) return items.filter((it) => it.role === "primary");

  if (timeboxMinutes < 45) {
    const primaries = items.filter((it) => it.role === "primary");
    const accessories = items.filter((it) => it.role === "accessory");
    return [...primaries, ...accessories.slice(0, 1)];
  }

  return items;
}
