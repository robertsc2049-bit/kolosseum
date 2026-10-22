// DEV NOTE: Looking ahead (pure: no clock, no database). The weeks of the
// athlete's programme still to come - working sets, tonnage, how hard - set
// against what they've actually been doing lately, so a coach sees a spike
// before it happens rather than after. And the exponentially weighted
// acute:chronic ratio (EWMA), alongside the rolling 4-week one.

type Json = Record<string, unknown>;
const round = (value: number, places = 0) => Math.round(value * 10 ** places) / 10 ** places;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// One week of the programme still to come (athlete_my_programme_service
// plannedWeeksAhead).
export type PlannedWeek = Readonly<{
  week_number: number; block_name: string; block_type: string; current: boolean;
  sessions: number; working_sets: number; tonnage_kg: number | null;
  // Working sets at 80%+ and 90%+ of max, and the average target RPE, where the plan gives them.
  sets_80: number; sets_90: number; avg_rpe: number | null;
}>;

// Each upcoming week against (a) what they've done on average over their
// last 4 complete weeks and (b) the plan's week before. Over 1.3x their
// recent work is a jump to watch; over 1.5x is a spike.
export function forwardRows(weeks: readonly PlannedWeek[], recent: { sets: number | null; tonnage_kg: number | null }): Json[] {
  return weeks.map((week, index) => {
    const before = index > 0 ? weeks[index - 1] : null;
    const setsVsRecent = finite(recent.sets) && recent.sets > 0 ? round(week.working_sets / recent.sets, 2) : null;
    const tonnageVsRecent = finite(recent.tonnage_kg) && recent.tonnage_kg > 0 && finite(week.tonnage_kg) ? round(week.tonnage_kg / recent.tonnage_kg, 2) : null;
    const setsVsBefore = before && before.working_sets > 0 ? round(week.working_sets / before.working_sets, 2) : null;
    const top = Math.max(setsVsRecent ?? 0, tonnageVsRecent ?? 0);
    const flag = week.block_type === "deload" ? "deload" : top > 1.5 ? "spike" : top > 1.3 ? "jump" : setsVsBefore !== null && setsVsBefore > 1.3 && before?.block_type !== "deload" ? "step_up" : null;
    return { ...week, sets_vs_recent: setsVsRecent, tonnage_vs_recent: tonnageVsRecent, sets_vs_week_before: setsVsBefore, flag };
  });
}

// EWMA acute:chronic (Williams et al. 2017): acute λ = 2/(7+1), chronic
// λ = 2/(28+1), over every day from the first training day, once there are
// 28 days of history. A week's figure is the average of its daily ratios
// (to today in the current week): a single day's ratio swings with the
// weekday - a steady week reads 0.8 on a rest-day Sunday.
export function ewmaRatios(dailyLoad: ReadonlyMap<string, number>, firstDay: string | null, weekEnds: readonly string[]): Array<number | null> {
  if (!firstDay) return weekEnds.map(() => null);
  const acuteLambda = 2 / (7 + 1);
  const chronicLambda = 2 / (28 + 1);
  const daily = new Map<string, number>();
  const last = [...weekEnds].sort().at(-1)!;
  let acute = 0;
  let chronic = 0;
  let count = 0;
  for (let day = firstDay; day <= last; day = shiftDay(day, 1)) {
    const load = dailyLoad.get(day) ?? 0;
    acute = load * acuteLambda + (1 - acuteLambda) * acute;
    chronic = load * chronicLambda + (1 - chronicLambda) * chronic;
    count += 1;
    if (count >= 28 && chronic > 0) daily.set(day, acute / chronic);
  }
  return weekEnds.map((end) => {
    const start = shiftDay(end, -((new Date(`${end}T00:00:00Z`).getUTCDay() + 6) % 7));
    const values: number[] = [];
    for (let day = start; day <= end; day = shiftDay(day, 1)) if (daily.has(day)) values.push(daily.get(day)!);
    return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
  });
}
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function forwardFindings(rows: readonly Json[]): Json[] {
  const upcoming = rows.filter((row) => !row.current).slice(0, 3);
  const spike = upcoming.find((row) => row.flag === "spike");
  const jump = upcoming.find((row) => row.flag === "jump" || row.flag === "step_up");
  const pick = spike ?? jump;
  if (!pick) return [];
  const vs = Math.max(Number(pick.sets_vs_recent ?? 0), Number(pick.tonnage_vs_recent ?? 0));
  const text = pick.flag === "step_up"
    ? `Week ${pick.week_number} of the plan (${pick.block_name}) steps working sets up ${Math.round((Number(pick.sets_vs_week_before) - 1) * 100)}% on the week before.`
    : `Week ${pick.week_number} of the plan (${pick.block_name}) is ${vs}× the work they've done lately.`;
  return [{ id: "forward_load", section: "load", level: spike ? "watch" : "info", text }];
}

export function forwardActionFor(id: string): string | null {
  return id === "forward_load" ? "Check they're ready for it - if they've missed sessions lately, build up over 2 weeks instead or trim the extra sets." : null;
}
