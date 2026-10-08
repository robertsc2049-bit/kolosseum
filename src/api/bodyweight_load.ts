// DEV NOTE: How much of the athlete's own bodyweight a bodyweight exercise
// moves, so a logged set's load is the whole system load - bodyweight plus
// any added weight - in e1RM, PRs and what athletes and coaches see. Pure: no
// database (athlete_bodyweight_service.ts loads the bodyweight).

type JsonRecord = Record<string, unknown>;

const LB_PER_KG = 2.2046226218;

// Share of bodyweight lifted. Hanging pulls, dips, muscle-ups and rope climbs
// move the whole body (street lifting ranks weighted pull-ups and dips on
// bodyweight + added load). A push-up moves about 64% of bodyweight in the
// top position, 70% with the feet raised (Ebben et al. 2011). Exercises where
// the share is unknown or meaningless (holds, jumps, single-leg squats) are
// left out rather than guessed.
export const BODYWEIGHT_SHARE: Readonly<Record<string, number>> = Object.freeze({
  pull_up: 1,
  chin_up: 1,
  dip: 1,
  muscle_up: 1,
  rope_climb: 1,
  band_assisted_pull_up: 1,
  push_up: 0.64,
  feet_elevated_push_up: 0.7
});

export function bodyweightShare(exerciseId: string): number {
  return BODYWEIGHT_SHARE[exerciseId] ?? 0;
}

// The system load of one set in kg: the share of bodyweight plus the added
// load (0 when the athlete left the load blank). Null when the exercise isn't
// a bodyweight exercise or the bodyweight isn't known.
export function systemLoadKg(exerciseId: string, addedKg: number | null, bodyweightKg: number | null): number | null {
  const share = bodyweightShare(exerciseId);
  if (!share || !(bodyweightKg !== null && bodyweightKg > 0)) return null;
  return Math.round((share * bodyweightKg + (addedKg ?? 0)) * 10) / 10;
}

export const toKg = (value: number, unit: "kg" | "lb") => (unit === "lb" ? value / LB_PER_KG : value);

// The athlete's current bodyweight in kg: the coach's strength profile, else
// the latest bodyweight they logged.
export function latestBodyweightKg(profilePayload: JsonRecord | null, bodyMetricEntries: readonly JsonRecord[]): number | null {
  const profileBw = Number(profilePayload?.bodyweight);
  if (Number.isFinite(profileBw) && profileBw > 0) {
    return String(profilePayload?.bodyweight_unit ?? "").trim() === "lb" ? profileBw / LB_PER_KG : profileBw;
  }
  const latest = bodyMetricEntries
    .filter((entry) => String(entry.metric_type ?? "").trim() === "body_weight_kg" && Number(entry.value) > 0)
    .sort((a, b) => String(b.effective_date ?? "").localeCompare(String(a.effective_date ?? "")))[0];
  return latest ? Number(latest.value) : null;
}
