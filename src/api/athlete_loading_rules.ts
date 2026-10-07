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

// %1RM against effort, from the standard RPE chart (RTS): one step down the
// chart is half an RPE, and one more rep is a whole RPE - a single at RPE 10 is 100%, a single
// at RPE 8 or a double at RPE 9 92.2%, 5 reps at RPE 8 81.1%. Past the chart
// (high reps at low effort) the last few steps carry on.
const RPE_CHART = [
  100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6,
  77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6
];
const LAST = RPE_CHART.length - 1;
const TAIL_STEP = (RPE_CHART[LAST - 5] - RPE_CHART[LAST]) / 5;

function chartPercent(step: number): number {
  if (step <= 0) return 100;
  if (step >= LAST) return RPE_CHART[LAST] - TAIL_STEP * (step - LAST);
  const lo = Math.floor(step);
  return RPE_CHART[lo] + (RPE_CHART[lo + 1] - RPE_CHART[lo]) * (step - lo);
}

function chartStep(percent: number): number {
  if (percent >= 100) return 0;
  for (let i = 0; i < LAST; i++) {
    if (percent >= RPE_CHART[i + 1]) return i + (RPE_CHART[i] - percent) / (RPE_CHART[i] - RPE_CHART[i + 1]);
  }
  return LAST + (RPE_CHART[LAST] - percent) / TAIL_STEP;
}

// An effort target for a % of 1RM prescription: from the chart, to the half
// RPE, no harder than RPE 9. Light work - a deload or the easy end of a wave -
// stays visible as RPE 5 (about 5 reps in the tank) rather than vanishing
// into the same number as moderate work.
export function rpeForPercentage(percent: number, reps: number): number {
  const rpe = 10 - (chartStep(percent) - 2 * (reps - 1)) / 2;
  return Math.min(9, Math.max(5, Math.round(rpe * 2) / 2));
}

// The %1RM for an effort target: the inverse of rpeForPercentage, kept
// between 50% and 90%.
export function percentForRpe(rpe: number, reps: number): number {
  const percent = chartPercent(2 * (reps - 1) + 2 * (10 - rpe));
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
