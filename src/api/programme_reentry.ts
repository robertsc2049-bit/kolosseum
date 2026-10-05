// DEV NOTE: The re-entry week for an athlete running a Kolosseum programme
// (programme_catalogue_service.ts). A generated programme handles a return
// from a break by making that week a deload (training_cycle.ts); a programme
// run follows its author's sessions in order, so the session itself is made
// lighter instead, and the run then picks up where it left off.
//
// Applied after the athlete's weights are worked out, so it lightens what they
// would actually lift:
// - one set fewer on everything (never below one);
// - a worked-out weight 10% lighter, or 20% after a long layoff (28+ days) or
//   a head injury - rounded down to the athlete's plate increment;
// - % of 1RM 10 (or 20) points lower; effort targets 1 (or 2) RPE easier,
//   never below RPE 5;
// - a first session on a lift (choose a technique weight) and bodyweight
//   work only lose the set.

import type { Reentry } from "./training_cycle.js";

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function reentryCut(reentry: Reentry): { percent: number; rpe: number } {
  return reentry.long_layoff || reentry.after_head_injury ? { percent: 20, rpe: 2 } : { percent: 10, rpe: 1 };
}

const floorTo = (value: number, step: number) => Number((Math.floor(value / step + 1e-9) * step).toFixed(3));
const easierRpe = (value: number, by: number) => Math.max(5, value - by);

export function lighterForReentry<T extends Json>(exercises: readonly T[], reentry: Reentry): T[] {
  const cut = reentryCut(reentry);
  return exercises.map((exercise) => {
    const out: Json = { ...exercise, reentry_lighter: true };
    const sets = num(exercise.sets);
    if (sets !== null && Number.isInteger(sets)) out.sets = Math.max(1, sets - 1);

    const intensity = isRecord(exercise.intensity) ? exercise.intensity : null;
    const resolved = isRecord(exercise.resolved_load) ? exercise.resolved_load : null;
    if (intensity?.type === "load" && num(intensity.value) !== null) {
      // Built from what they lifted last time.
      const step = intensity.unit === "lb" ? 5 : 2.5;
      out.intensity = { ...intensity, value: floorTo(Number(intensity.value) * (1 - cut.percent / 100), step) };
    }
    else if (intensity?.type === "percent_1rm" && num(intensity.value) !== null) {
      const percent = Math.max(40, Number(intensity.value) - cut.percent);
      out.intensity = { ...intensity, value: percent };
      if (resolved && num(resolved.value) !== null && num(resolved.percentage)) {
        const step = num(resolved.rounding_increment) ?? (resolved.unit === "lb" ? 5 : 2.5);
        out.resolved_load = { ...resolved, percentage: percent, value: floorTo(Number(resolved.value) * percent / Number(resolved.percentage), step) };
      }
    }
    else if (intensity?.type === "rpe" && num(intensity.value) !== null) {
      out.intensity = { ...intensity, value: easierRpe(Number(intensity.value), cut.rpe) };
    }

    // No max recorded: the effort target they're shown.
    const guidance = isRecord(exercise.load_guidance) ? exercise.load_guidance : null;
    if (guidance?.type === "rpe" && num(guidance.value) !== null) {
      out.load_guidance = { ...guidance, value: easierRpe(Number(guidance.value), cut.rpe) };
    }
    return out as T;
  });
}
