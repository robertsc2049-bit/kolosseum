// DEV NOTE: Pure autoregulation rules (no database): when what an athlete did
// last time should hold an exercise back, and by how much. See
// autoregulation_service.ts for how they are applied.

type Json = Record<string, unknown>;

export const MISSED_REPS_SHARE = 0.5;
export const TOO_HARD_RPE = 9.5;
export const PERCENT_STEP = 5;
export const RPE_STEP = 1;

export type LastTime = {
  session_id: string;
  prescribed_reps: number | null;
  set_reps: number[];
  rpe: number | null;
};

export type Hold = { reason: "missed_reps" | "too_hard"; detail: string; from_session_id: string };

// Why the next prescription for an exercise should be held back, or null.
export function holdFor(last: LastTime | undefined): Hold | null {
  if (!last) return null;
  if (last.prescribed_reps !== null && last.set_reps.length) {
    const short = last.set_reps.filter((reps) => reps < (last.prescribed_reps as number)).length;
    if (short / last.set_reps.length >= MISSED_REPS_SHARE) {
      return { reason: "missed_reps", detail: `${short} of ${last.set_reps.length} sets short of ${last.prescribed_reps} reps last time`, from_session_id: last.session_id };
    }
  }
  if (last.rpe !== null && last.rpe >= TOO_HARD_RPE) {
    return { reason: "too_hard", detail: `RPE ${last.rpe} last time`, from_session_id: last.session_id };
  }
  return null;
}

// Hold one prescription back: lighter % of 1RM or lower RPE target.
export function heldIntensity(intensity: Json): Json | null {
  const value = Number(intensity.value);
  if (!Number.isFinite(value)) return null;
  if (intensity.type === "percent_1rm") return { ...intensity, value: Math.max(40, Number((value - PERCENT_STEP).toFixed(1))) };
  if (intensity.type === "rpe") return { ...intensity, value: Math.max(5, value - RPE_STEP) };
  return null;
}

