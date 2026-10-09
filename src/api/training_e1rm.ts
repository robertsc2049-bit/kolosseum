// DEV NOTE: Product-side training e1RM (pure: no clock, no database). Turns
// what an athlete actually lifted - prescribed-set logs and extra sets - into
// an estimated one-rep max per exercise per training day, so a coach can see
// the trend from training rather than only from maxes they typed in.

import { bodyweightShare, systemLoadKg } from "./bodyweight_load.js";

type JsonRecord = Record<string, unknown>;

export type LoggedSet = Readonly<{
  exercise_id: string;
  reps: number;
  load_value: number;
  load_unit: "kg" | "lb";
  date: string; // YYYY-MM-DD (the day the set was logged, UTC)
  // The athlete's bodyweight when the set was logged (bodyweight exercises).
  bodyweight_kg?: number | null;
}>;

const LB_PER_KG = 2.2046226218;
// Estimates past 10 reps are too unreliable to trend a max from.
export const E1RM_MAX_REPS = 10;

// Bodyweight lifts are judged on the whole system load - their share of the
// athlete's bodyweight plus any added load (bodyweight_load.ts) - using the
// bodyweight logged with the set, else the athlete's current bodyweight.
export const BODYWEIGHT_PLUS_LOAD_EXERCISES: ReadonlySet<string> = new Set(
  ["pull_up", "chin_up", "dip", "muscle_up", "rope_climb", "band_assisted_pull_up", "push_up", "feet_elevated_push_up"].filter((id) => bodyweightShare(id) > 0)
);

// An estimated max only means something for strength lifts: squat, hinge,
// single-leg and pushing/pulling patterns. Jumps, sprints, throws, carries,
// conditioning, isolation and ballistic work (a loaded extra set of jumps or
// kettlebell swings) never produce an e1RM.
export const E1RM_STRENGTH_PATTERNS: ReadonlySet<string> = new Set([
  "squat", "hinge", "single_leg_squat", "single_leg_hinge",
  "horizontal_push", "incline_push", "decline_push", "vertical_push", "angled_push",
  "horizontal_pull", "vertical_pull"
]);
const E1RM_EXCLUDED_EXERCISES: ReadonlySet<string> = new Set(["kettlebell_swing", "tire_flip"]);

export function isE1rmExercise(exerciseId: string, patternOf: (exerciseId: string) => string | undefined): boolean {
  if (E1RM_EXCLUDED_EXERCISES.has(exerciseId)) return false;
  const pattern = patternOf(exerciseId);
  return pattern !== undefined && E1RM_STRENGTH_PATTERNS.has(pattern);
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const toKg = (value: number, unit: "kg" | "lb") => unit === "lb" ? value / LB_PER_KG : value;
const fromKg = (kg: number, unit: "kg" | "lb") => unit === "lb" ? kg * LB_PER_KG : kg;

// Epley: load x (1 + reps / 30); a single is its own max.
export function epleyE1rm(load: number, reps: number): number {
  return reps === 1 ? load : load * (1 + reps / 30);
}

// The e1RM of one set in kg, or null when the set cannot estimate a max
// (a failed set, more than 10 reps, or a net load of zero or less).
export function setE1rmKg(set: LoggedSet, bodyweightKg: number | null): { e1rm_kg: number; includes_bodyweight: boolean } | null {
  if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > E1RM_MAX_REPS) return null;
  const addedKg = toKg(set.load_value, set.load_unit);
  const bodyweight = set.bodyweight_kg && set.bodyweight_kg > 0 ? set.bodyweight_kg : bodyweightKg;
  const system = systemLoadKg(set.exercise_id, addedKg, bodyweight);
  const includesBodyweight = system !== null;
  const systemKg = system ?? addedKg;
  if (!(systemKg > 0)) return null;
  return { e1rm_kg: epleyE1rm(systemKg, set.reps), includes_bodyweight: includesBodyweight };
}

// Per exercise: the best e1RM on each training day, the latest day's value
// and the change from the nearest day at least windowDays earlier.
export function computeTrainingE1rmTrends(
  sets: readonly LoggedSet[],
  bodyweightKg: number | null,
  displayUnit: "kg" | "lb",
  windowDays: number,
  patternOf: (exerciseId: string) => string | undefined
): JsonRecord[] {
  const byExercise = new Map<string, Map<string, { e1rm_kg: number; includes_bodyweight: boolean }>>();
  for (const logged of sets) {
    // A repeat of an exercise in a session ("back_squat__r2") is that exercise.
    const set = { ...logged, exercise_id: logged.exercise_id.replace(/__r[0-9]+$/, "") };
    if (!isE1rmExercise(set.exercise_id, patternOf)) continue;
    const est = setE1rmKg(set, bodyweightKg);
    if (!est) continue;
    const days = byExercise.get(set.exercise_id) ?? new Map();
    const best = days.get(set.date);
    if (!best || est.e1rm_kg > best.e1rm_kg) days.set(set.date, est);
    byExercise.set(set.exercise_id, days);
  }

  const trends: JsonRecord[] = [];
  for (const exerciseId of [...byExercise.keys()].sort()) {
    const days = [...(byExercise.get(exerciseId) as Map<string, { e1rm_kg: number; includes_bodyweight: boolean }>).entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    const [latestDate, latest] = days[days.length - 1];
    const cutoffMs = Date.parse(`${latestDate}T00:00:00Z`) - windowDays * 86_400_000;
    const prior = [...days].reverse().find(([date]) => Date.parse(`${date}T00:00:00Z`) <= cutoffMs) ?? null;
    const value = (kg: number) => round1(fromKg(kg, displayUnit));
    const current = value(latest.e1rm_kg);
    const priorValue = prior ? value(prior[1].e1rm_kg) : null;
    trends.push(Object.freeze({
      exercise_id: exerciseId,
      unit: displayUnit,
      method: "epley",
      includes_bodyweight: latest.includes_bodyweight,
      current_e1rm: current,
      current_date: latestDate,
      has_prior_value: prior !== null,
      prior_e1rm: priorValue,
      prior_date: prior ? prior[0] : null,
      delta: priorValue !== null ? round1(current - priorValue) : null,
      delta_percentage: priorValue ? round1((100 * (current - priorValue)) / priorValue) : null,
      series: Object.freeze(days.map(([date, est]) => Object.freeze({ date, e1rm: value(est.e1rm_kg) })))
    }));
  }
  return trends;
}
