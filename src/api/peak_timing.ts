// DEV NOTE: A programme that ends in a taper (a meet, race or fight prep) is
// timed to the competition, not to how many sessions the athlete has done.
// Counting sessions alone, two missed weeks would put a lifter's openers two
// weeks after the meet, and a fighter still in heavy work in fight week.
// Pure rules - no database (see beta18_programme_template_service.ts).

export type TimedSession = { template_week_index_global?: unknown; template_block_type?: unknown };
export type PeakTiming = { index: number; adjustment: "skipped" | "held"; weeks: number; competition_date: string };

const DAY_MS = 86_400_000;
const weekOf = (session: TimedSession | undefined) => Number(session?.template_week_index_global ?? 0);

// The session to do next, given where the athlete would be by count
// (baseIndex) and the competition date:
// - behind (the competition is closer than the weeks left in the programme):
//   skip ahead to the first session of the week that puts the taper in the
//   competition week - the build weeks missed are dropped, never the taper;
// - early (they've reached the taper with more than its length still to go):
//   repeat the last week before the taper until the competition is in range.
// Null when no adjustment applies (on schedule, no date, a date passed or too
// far off to reach, or a programme that doesn't end in a taper).
export function peakTimedIndex(sessions: readonly TimedSession[], baseIndex: number, competitionDate: string | null | undefined, today: string): PeakTiming | null {
  if (!competitionDate || !sessions.length || baseIndex < 0 || baseIndex >= sessions.length) return null;
  if (sessions[sessions.length - 1].template_block_type !== "deload") return null;
  const days = Math.round((Date.parse(`${competitionDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (!Number.isFinite(days) || days < 0) return null;
  const totalWeeks = weekOf(sessions[sessions.length - 1]);
  // Weeks left including the competition week itself.
  const weeksLeft = Math.floor(days / 7) + 1;
  const targetWeek = totalWeeks - weeksLeft + 1;
  const currentWeek = weekOf(sessions[baseIndex]);
  const firstOfWeek = (week: number) => sessions.findIndex((s) => weekOf(s) === week);

  if (targetWeek > currentWeek) {
    const index = firstOfWeek(targetWeek);
    return index > baseIndex ? { index, adjustment: "skipped", weeks: targetWeek - currentWeek, competition_date: competitionDate } : null;
  }

  // The taper is the final block: its first week is the first deload week of
  // the run of deload weeks at the end.
  let taperStart = totalWeeks;
  while (taperStart > 1 && sessions.some((s) => weekOf(s) === taperStart - 1 && s.template_block_type === "deload")) taperStart -= 1;
  const taperWeeks = totalWeeks - taperStart + 1;
  if (currentWeek >= taperStart && weeksLeft > taperWeeks && taperStart > 1) {
    const lastBuildStart = firstOfWeek(taperStart - 1);
    const lastBuildLength = sessions.filter((s) => weekOf(s) === taperStart - 1).length;
    const taperFirst = firstOfWeek(taperStart);
    const index = lastBuildStart + ((baseIndex - taperFirst) % lastBuildLength);
    return { index, adjustment: "held", weeks: weeksLeft - taperWeeks, competition_date: competitionDate };
  }
  return null;
}
