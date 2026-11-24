// DEV NOTE: API boundary surface (pure). Whether a self-coached athlete's own
// "Adjust for breaks" tick is on at a moment, and whether a return from a
// break is adjusted for. See break_adjustment_service.ts.

// Accounts made before the tick existed keep the adjustment they always had
// until they choose; newer ones have none unless they tick it.
export const BREAK_ADJUSTMENT_SINCE = "2026-11-24T00:00:00.000Z";

export type BreakAdjustmentChoice = Readonly<{ enabled: boolean; at: string }>;

const DAY_MS = 86_400_000;

// choices: oldest first.
export function breakAdjustmentOn(choices: readonly BreakAdjustmentChoice[], accountCreatedAt: string, at: string): boolean {
  const latest = choices.filter((choice) => choice.at <= at).at(-1);
  return latest ? latest.enabled : accountCreatedAt < BREAK_ADJUSTMENT_SINCE;
}

// The week they're back follows the tick as it is now. A return already behind
// them keeps what the tick was by the end of that week, so changing it later
// never moves the training blocks that followed.
export function adjustsForReturn(
  reentry: Readonly<{ returned_on: string; reentry_week: boolean }>,
  choices: readonly BreakAdjustmentChoice[],
  accountCreatedAt: string,
  now: Date
): boolean {
  if (reentry.reentry_week) return breakAdjustmentOn(choices, accountCreatedAt, now.toISOString());
  const returned = Date.parse(`${reentry.returned_on}T00:00:00Z`);
  const daysToSunday = (7 - new Date(returned).getUTCDay()) % 7;
  return breakAdjustmentOn(choices, accountCreatedAt, new Date(returned + (daysToSunday + 1) * DAY_MS - 1).toISOString());
}
