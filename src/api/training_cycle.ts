// DEV NOTE: Product-side periodisation (pure: no clock, no database). Turns an athlete's declared training plan
// (days a week, season or competition dates) and today's date into the explicit
// training_cycle the engine consumes. The engine never reads a clock; this is
// the only place "today" enters a self-directed athlete's programme.

import { MACRO_PHASES_BY_MODEL, cycleModelFor, type TrainingCycle } from "@kolosseum/engine/phases/phase4.js";

export type AthleteTrainingPlan = Readonly<{
  activity_id: string;
  training_days_per_week: number;
  season_start_date?: string;
  season_end_date?: string;
  competition_date?: string;
  no_fixed_date?: true;
  // The date the athlete first declared a training plan: their 4-week blocks
  // count from that week, so a new athlete starts on week 1, not a deload.
  plan_started_on?: string;
}>;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
// A Monday: ISO weeks (and so mesocycle weeks) start on Mondays, UTC.
const EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);

function utcDayMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function dateMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
export function weekIndex(dayMs: number): number {
  return Math.floor((dayMs - EPOCH_MONDAY_MS) / WEEK_MS);
}
export function weekStartMs(dayMs: number): number {
  return EPOCH_MONDAY_MS + weekIndex(dayMs) * WEEK_MS;
}

// Calendar weeks (Monday-based) since the athlete's plan started.
export function planWeek(plan: AthleteTrainingPlan, dayMs: number): number {
  const anchor = plan.plan_started_on ? weekIndex(dateMs(plan.plan_started_on)) : 0;
  return Math.max(0, weekIndex(dayMs) - anchor);
}

// With no fixed date, the plan alternates 4-week general and specific blocks
// (off-season/pre-season, accumulation/intensification, base/build), starting
// with a general block.
function rollingPhase(plan: AthleteTrainingPlan, phases: readonly string[], dayMs: number): string {
  return phases[Math.floor(planWeek(plan, dayMs) / 4) % 2 === 0 ? 0 : 1];
}

// Macrocycle phase for today:
// - season: >8 weeks before the season starts is off-season, the last 8 weeks
//   pre-season, the season itself in-season, 3 weeks after it transition, then
//   off-season again until the next season is declared.
// - meet: >8 weeks out accumulation, 8-4 weeks intensification, the final 3
//   weeks (and meet day) peak, 2 weeks after it transition.
// - event: >12 weeks out base, 12-5 weeks build, the final 4 weeks specific,
//   the last 10 days taper, 2 weeks after it transition.
export function macroPhaseFor(plan: AthleteTrainingPlan, today: Date): string {
  const model = cycleModelFor(plan.activity_id);
  if (!model) throw new Error(`training_cycle_unsupported_activity:${plan.activity_id}`);
  const phases = MACRO_PHASES_BY_MODEL[model];
  const day = utcDayMs(today);

  if (model === "season") {
    if (!plan.season_start_date || !plan.season_end_date) return rollingPhase(plan, phases, day);
    const start = dateMs(plan.season_start_date);
    const end = dateMs(plan.season_end_date);
    if (day < start) return Math.ceil((start - day) / WEEK_MS) > 8 ? "off_season" : "pre_season";
    if (day <= end) return "in_season";
    return day - end <= 21 * DAY_MS ? "transition" : "off_season";
  }

  if (!plan.competition_date) return rollingPhase(plan, phases, day);
  const competition = dateMs(plan.competition_date);
  if (day > competition) return day - competition <= 14 * DAY_MS ? "transition" : phases[0];
  const daysTo = (competition - day) / DAY_MS;
  const weeksTo = Math.ceil(daysTo / 7);
  if (model === "meet") {
    if (weeksTo <= 3) return "peak";
    return weeksTo <= 8 ? "intensification" : "accumulation";
  }
  if (daysTo <= 10) return "taper";
  if (weeksTo <= 4) return "specific";
  return weeksTo <= 12 ? "build" : "base";
}

// Mesocycle weeks follow the calendar from the plan's first week (3 loading
// weeks then a deload). A competition-specific phase never deloads - it is
// already short and sharp.
export function mesoWeekFor(plan: AthleteTrainingPlan, macroPhase: string, today: Date): number {
  const week = (planWeek(plan, utcDayMs(today)) % 4) + 1;
  return macroPhase === "peak" || macroPhase === "specific" ? Math.min(week, 3) : week;
}

export function computeTrainingCycle(plan: AthleteTrainingPlan, today: Date, sessionsThisWeek: number): TrainingCycle {
  const macro_phase = macroPhaseFor(plan, today);
  return {
    macro_phase,
    meso_week: mesoWeekFor(plan, macro_phase, today),
    days_per_week: plan.training_days_per_week,
    session_slot: Math.max(0, sessionsThisWeek) % plan.training_days_per_week
  };
}
