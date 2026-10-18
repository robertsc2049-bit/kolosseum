// DEV NOTE: Pure readiness rules (no database). An athlete's optional
// pre-session check-in - sleep, soreness and stress, each 1 (poor) to 5
// (great) - trims that day's session when readiness is low, the way a coach
// would on a bad day. It never adds work.
//
// Low: any answer is 1, or the three total 7 or less. Then every exercise
// loses a set (never below 1) and is a notch lighter (5% of 1RM / 1 RPE).

type Json = Record<string, unknown>;

export type ReadinessCheckIn = { date: string; sleep: number; soreness: number; stress: number; fatigue?: number; mood?: number; resting_hr?: number; hrv_ms?: number };
export const READINESS_ITEMS = Object.freeze(["sleep", "soreness", "stress"] as const);
// Optional extras the athlete can add: fatigue and mood (1-5), resting heart
// rate (bpm) and HRV (ms, rMSSD) from a watch or strap. They never change the
// session - only the three questions above do - but the coach sees them.
export const OPTIONAL_ITEMS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({ fatigue: [1, 5], mood: [1, 5], resting_hr: [30, 120], hrv_ms: [5, 300] });
export const LOW_TOTAL = 7;

export function isLowReadiness(check: ReadinessCheckIn): boolean {
  const scores = [check.sleep, check.soreness, check.stress];
  return scores.some((s) => s === 1) || scores.reduce((a, b) => a + b, 0) <= LOW_TOTAL;
}

export function validateReadiness(input: unknown, today: string): { ok: true; check: ReadinessCheckIn } | { ok: false; field_errors: Json } {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Json) : null;
  if (!record) return { ok: false, field_errors: { readiness: "Answer the three questions." } };
  const errors: Json = {};
  for (const key of Object.keys(record)) if (!(READINESS_ITEMS as readonly string[]).includes(key) && !OPTIONAL_ITEMS[key]) errors[key] = "Not part of a readiness check-in.";
  const extras: Record<string, number> = {};
  for (const [key, [low, high]] of Object.entries(OPTIONAL_ITEMS)) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    if (!Number.isInteger(value) || (value as number) < low || (value as number) > high) errors[key] = `Choose ${low} to ${high}.`;
    else extras[key] = value as number;
  }
  for (const item of READINESS_ITEMS) {
    const value = record[item];
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) errors[item] = "Choose 1 to 5.";
  }
  if (Object.keys(errors).length) return { ok: false, field_errors: errors };
  return { ok: true, check: { date: today, sleep: record.sleep as number, soreness: record.soreness as number, stress: record.stress as number, ...extras } };
}

function lighter(intensity: Json | undefined): Json | undefined {
  if (!intensity) return intensity;
  const value = Number(intensity.value);
  if (!Number.isFinite(value)) return intensity;
  if (intensity.type === "percent_1rm") return { ...intensity, value: Math.max(40, Number((value - 5).toFixed(1))) };
  if (intensity.type === "rpe") return { ...intensity, value: Math.max(5, value - 1) };
  return intensity;
}

// Trim a session for a low-readiness day; unchanged otherwise.
export function applyReadiness(exercises: Json[], check: ReadinessCheckIn | null): Json[] {
  if (!check || !isLowReadiness(check)) return exercises;
  const readiness = { sleep: check.sleep, soreness: check.soreness, stress: check.stress, low: true };
  return exercises.map((exercise) => {
    const sets = Number(exercise.sets);
    return {
      ...exercise,
      sets: Number.isInteger(sets) ? Math.max(1, sets - 1) : exercise.sets,
      intensity: lighter(exercise.intensity as Json | undefined),
      readiness
    };
  });
}
