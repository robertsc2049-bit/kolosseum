// DEV NOTE: Whether a Kolosseum programme fits the athlete choosing it
// (programme_catalogue_service.ts), so they're told before they start:
// - training days: a 4-day programme for someone who said they train 3 days
//   stretches 12 weeks into 16;
// - competition timing: a programme that ends in a taper (meet prep, fight
//   camp, contest or race week) peaks on the day only if it's started its
//   length before the athlete's declared competition.
// Pure: the template's sessions, the athlete's plan and today come in.

type Json = Record<string, unknown>;

export type ProgrammeShape = { weeks_total: number; ends_with_taper: boolean };
export type ProgrammeFit = {
  weeks_total: number;
  ends_with_taper: boolean;
  days: { programme: number; athlete: number } | null;
  competition: { date: string; weeks_away: number; start_on: string; timing: "too_late" | "on_time" | "too_early" } | null;
};

const DAY_MS = 86_400_000;
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Weeks in the programme and whether its last block is a taper, from its
// sessions in order (each carries its block and week).
export function programmeShape(sessions: readonly Readonly<Json>[]): ProgrammeShape {
  const weeks = Math.max(0, ...sessions.map((s) => Number(s.template_week_index_global) || 0));
  const last = sessions.at(-1);
  return { weeks_total: weeks, ends_with_taper: String(last?.template_block_type ?? "") === "deload" };
}

export function programmeFit(
  shape: ProgrammeShape,
  programmeDays: number,
  plan: { training_days_per_week?: number; competition_date?: string } | null,
  today: string
): ProgrammeFit {
  const athleteDays = Number(plan?.training_days_per_week) || 0;
  // More days than they train stretches the programme; fewer leaves days for their sport.
  const days = athleteDays > 0 && programmeDays > athleteDays ? { programme: programmeDays, athlete: athleteDays } : null;
  let competition: ProgrammeFit["competition"] = null;
  const date = plan?.competition_date;
  if (shape.ends_with_taper && shape.weeks_total > 0 && date && dayMs(date) > dayMs(today)) {
    const daysAway = Math.round((dayMs(date) - dayMs(today)) / DAY_MS);
    const startOn = dayMs(date) - shape.weeks_total * 7 * DAY_MS;
    // A few days late still lands the taper; more than a week early, start later.
    const timing = startOn < dayMs(today) - 3 * DAY_MS ? "too_late" : startOn > dayMs(today) + 7 * DAY_MS ? "too_early" : "on_time";
    competition = { date, weeks_away: Math.floor(daysAway / 7), start_on: isoDay(startOn), timing };
  }
  return { ...shape, days, competition };
}
