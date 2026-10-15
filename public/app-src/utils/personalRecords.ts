// A set is flagged is_pr when it is heavier than anything the athlete had
// logged for that exercise before it - including earlier sets of the same
// session (session_state_write_service.ts computeIsPersonalRecord), which is
// right for the live "PR!" while logging. Looking back at a session, though,
// a normal ramp (102.5, 105, 107.5, 110) then reads as four PRs and the badge
// stops meaning anything. History shows one per exercise per session: the
// heaviest of the flagged sets.
type LoggedSet = { is_pr?: unknown; load_value?: unknown; load_unit?: unknown };

function loadKg(entry: LoggedSet): number {
  const value = Number(entry.load_value);
  if (!Number.isFinite(value)) return -Infinity;
  return entry.load_unit === "lb" ? value * 0.45359237 : value;
}

// The one entry that keeps its PR badge, or null.
export function topPersonalRecord<T extends LoggedSet>(entries: readonly T[]): T | null {
  let best: T | null = null;
  for (const entry of entries) {
    if (entry.is_pr !== true) continue;
    if (best === null || loadKg(entry) > loadKg(best)) best = entry;
  }
  return best;
}
