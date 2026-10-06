// DEV NOTE: How a self-directed athlete's weights are set - pure rules, no
// database (see athlete_maxes_service.ts for where they're applied).

export type LoadingMethod = "progression" | "percent_1rm" | "rpe";
export const LOADING_METHODS: ReadonlySet<string> = new Set(["progression", "percent_1rm", "rpe"]);

export function defaultLoadingMethod(level: string | undefined): LoadingMethod {
  return level === "beginner" ? "progression" : "percent_1rm";
}

// How much a lift goes up after a session where every rep was made: lower
// body (squat, hinge, single-leg, carries) 2.5 kg / 5 lb, everything else
// 1.25 kg / 2.5 lb.
export function progressionIncrement(movementPattern: string, unit: "kg" | "lb"): number {
  const lower = /^(squat|hinge|single_leg_|carry_)/u.test(movementPattern);
  return unit === "lb" ? (lower ? 5 : 2.5) : (lower ? 2.5 : 1.25);
}

// An effort target for a % of 1RM prescription when no max is recorded:
// reps in reserve from a standard RPE chart (about 3.2% of 1RM per rep),
// kept between RPE 6 and 9.
export function rpeForPercentage(percent: number, reps: number): number {
  const repsInReserve = (100 - percent) / 3.2 + 1 - reps;
  const rpe = 10 - repsInReserve;
  return Math.min(9, Math.max(6, Math.round(rpe * 2) / 2));
}

// The %1RM for an effort target: the inverse of rpeForPercentage.
export function percentForRpe(rpe: number, reps: number): number {
  const percent = 100 - 3.2 * ((10 - rpe) + reps - 1);
  return Math.min(90, Math.max(50, Math.round(percent * 2) / 2));
}

// The effort target for an athlete with no max for a lift: the one the
// programme wrote, if it wrote one. Converting it to a % and back drifts at
// high reps (15 reps at RPE 6 would come back as RPE 8.5).
export function effortWithoutMax(intensity: { type?: unknown; value?: unknown }, percent: number, reps: number): number {
  return intensity.type === "rpe" ? Number(intensity.value) : rpeForPercentage(percent, reps);
}

export type LiftSession = { sets: { reps: number; load: number; unit: "kg" | "lb" }[] };
export type ProgressionPrescription =
  | { basis: "first_time" }
  | { basis: "progress" | "repeat" | "deload"; value: number; unit: "kg" | "lb"; previous: number; increment: number };

const toUnit = (value: number, from: "kg" | "lb", to: "kg" | "lb") => (from === to ? value : to === "kg" ? value / 2.20462 : value * 2.20462);
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

function sessionOutcome(session: LiftSession, target: number, unit: "kg" | "lb"): { top: number; madeEveryRep: boolean } | null {
  const loaded = session.sets.filter((set) => set.load > 0);
  if (loaded.length === 0) return null;
  const top = Math.max(...loaded.map((set) => toUnit(set.load, set.unit, unit)));
  const atTop = loaded.filter((set) => Math.abs(toUnit(set.load, set.unit, unit) - top) < 0.01);
  return { top, madeEveryRep: atTop.every((set) => set.reps >= target) };
}

// Where to start on an exercise the programme set by effort (a row at RPE 8)
// for an athlete on % of their max: the heaviest weight they used on it last
// time, or - before they've logged it - the weight their max gives at that
// effort. The effort target stays the prescription, so the weight moves with
// them; a fixed % of an old max would hold it still for the whole programme.
export type StartingLoad = { value: number; unit: "kg" | "lb"; basis: "last_session" | "max" };
export function startingLoadForEffort(history: LiftSession[], fromMax: { value: number; unit: "kg" | "lb" } | null, unit: "kg" | "lb"): StartingLoad | null {
  const last = history.length ? sessionOutcome(history[0], 0, unit) : null;
  if (last) return { value: roundTo(last.top, unit === "lb" ? 5 : 2.5), unit, basis: "last_session" };
  return fromMax ? { value: fromMax.value, unit: fromMax.unit, basis: "max" } : null;
}

// The next weight for a lift from its last two sessions (newest first):
// every rep made at the top weight - add the increment; short of the reps -
// the same weight; short at the same weight twice running - 10% off,
// rounded down to the plate step.
export function progressionPrescription(history: LiftSession[], targetReps: number, increment: number, unit: "kg" | "lb"): ProgressionPrescription {
  const last = history[0] ? sessionOutcome(history[0], targetReps, unit) : null;
  if (!last) return { basis: "first_time" };
  const step = increment;
  if (last.madeEveryRep) return { basis: "progress", value: roundTo(last.top + increment, step / 2), unit, previous: roundTo(last.top, step / 2), increment };
  const before = history[1] ? sessionOutcome(history[1], targetReps, unit) : null;
  if (before && !before.madeEveryRep && Math.abs(before.top - last.top) < 0.01) {
    return { basis: "deload", value: Math.floor((last.top * 0.9) / step + 1e-9) * step, unit, previous: roundTo(last.top, step / 2), increment };
  }
  return { basis: "repeat", value: roundTo(last.top, step / 2), unit, previous: roundTo(last.top, step / 2), increment };
}
