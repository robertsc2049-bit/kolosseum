// DEV NOTE: API boundary surface (pure). Fighters who compete at a weight
// class: in the 4 weeks before a fight (fight camp) the gym keeps strength
// without building muscle mass - loaded work above 6 reps (the
// muscle-building range) becomes at most 3 sets of 6; heavy, low-rep strength
// work stays as written. Power, timed and distance work is left alone. The product
// never gives weight-cutting, diet or hydration advice; a weight class is a
// declared fact only.

export const COMBAT_ACTIVITIES: ReadonlySet<string> = new Set(["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"]);
export const FIGHT_CAMP_DAYS = 28;
export const CAMP_MAX_REPS = 6;
export const CAMP_MAX_SETS = 3;

const DAY_MS = 86_400_000;
const POWER_PATTERNS = new Set(["jump_vertical", "jump_horizontal", "sprint_acceleration", "sprint_max_velocity", "deceleration", "change_of_direction", "throw_slam"]);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export type WeightClass = { competes_at_weight_class: boolean; weight_class_kg: number | null };
export type FightCamp = { fight_date: string; days_out: number };

export function validateWeightClass(input: unknown): { ok: true; weight_class: WeightClass } | { ok: false; field_errors: Record<string, string> } {
  if (!isRecord(input)) return { ok: false, field_errors: { competes_at_weight_class: "Say whether you compete at a weight class." } };
  const errors: Record<string, string> = {};
  for (const key of Object.keys(input)) if (!["competes_at_weight_class", "weight_class_kg"].includes(key)) errors[key] = "Not part of a weight class.";
  if (typeof input.competes_at_weight_class !== "boolean") errors.competes_at_weight_class = "Say whether you compete at a weight class.";
  const raw = input.weight_class_kg;
  let kg: number | null = null;
  if (raw !== undefined && raw !== null && raw !== "") {
    kg = Number(raw);
    if (!Number.isFinite(kg) || kg < 40 || kg > 160 || Math.round(kg * 10) !== kg * 10) errors.weight_class_kg = "Enter your weight class in kg (40-160).";
  }
  if (Object.keys(errors).length) return { ok: false, field_errors: errors };
  return { ok: true, weight_class: { competes_at_weight_class: input.competes_at_weight_class as boolean, weight_class_kg: input.competes_at_weight_class ? kg : null } };
}

// The nearest fight on or after today within fight camp, or null.
export function fightCampFor(fightDates: readonly string[], today: string): FightCamp | null {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const upcoming = fightDates
    .map((d) => ({ d, days: Math.round((Date.parse(`${d}T00:00:00Z`) - todayMs) / DAY_MS) }))
    .filter(({ days }) => Number.isFinite(days) && days >= 0 && days <= FIGHT_CAMP_DAYS)
    .sort((a, b) => a.days - b.days);
  return upcoming.length ? { fight_date: upcoming[0].d, days_out: upcoming[0].days } : null;
}

// Loaded work in fight camp: no more than 6 reps and 3 sets; each changed
// exercise says what was planned and why.
export function applyFightCamp<T extends Record<string, unknown>>(
  exercises: readonly T[],
  camp: FightCamp,
  patternOf: (exerciseId: string) => string | undefined
): T[] {
  return exercises.map((exercise) => {
    const id = String(exercise.exercise_id ?? "").replace(/__r[0-9]+$/u, "");
    const timed = Number(exercise.duration_seconds ?? 0) > 0 || Number(exercise.distance_m ?? exercise.distance_value ?? 0) > 0;
    const loaded = isRecord(exercise.intensity) && exercise.intensity.type !== "bodyweight";
    const reps = Number(exercise.reps);
    const sets = Number(exercise.sets);
    if (timed || !loaded || POWER_PATTERNS.has(patternOf(id) ?? "") || !Number.isInteger(reps)) return exercise;
    // Heavy, low-rep work keeps strength and stays as written.
    if (reps <= CAMP_MAX_REPS) return exercise;
    return {
      ...exercise,
      reps: Math.min(reps, CAMP_MAX_REPS),
      ...(Number.isInteger(sets) ? { sets: Math.min(sets, CAMP_MAX_SETS) } : {}),
      fight_camp: { fight_date: camp.fight_date, days_out: camp.days_out, planned_sets: sets, planned_reps: reps }
    };
  });
}
