// DEV NOTE: The strength coach's top end (pure: no clock, no database).
// - Prilepin's table: reps per lift per session in each intensity zone
//   against the ranges Prilepin found for weightlifters - a sense-check of
//   heavy sessions, not a rule.
// - Bar speed (velocity-based training): the mean velocity athletes log
//   from a VBT device, per lift - speed at the same weight over time, and
//   how much speed is lost across a session's sets (velocity loss).
// - Meet attempts: openers, seconds and thirds from the projected max for
//   a powerlifter or weightlifter with a competition date. Coach-only.

type Json = Record<string, unknown>;
const round = (value: number, places = 0) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

// Prilepin (1974), as commonly tabulated: % of max -> reps per set, optimal
// total reps per session and the range.
export const PRILEPIN = [
  { zone: "55-69%", from: 55, below: 70, per_set: "3-6", optimal: 24, low: 18, high: 30 },
  { zone: "70-79%", from: 70, below: 80, per_set: "3-6", optimal: 18, low: 12, high: 24 },
  { zone: "80-89%", from: 80, below: 90, per_set: "2-4", optimal: 15, low: 10, high: 20 },
  { zone: "90%+", from: 90, below: Infinity, per_set: "1-2", optimal: 4, low: 1, high: 10 }
] as const;

export type HeavySet = Readonly<{ session_id: string; date: string; exercise_id: string; pct: number; reps: number }>;

// Each session's reps per lift in each zone, checked against Prilepin.
// Only sessions with work at 70%+ are checked (lighter work isn't the point).
export function prilepinCheck(sets: readonly HeavySet[], name: (id: string) => string): Json[] {
  const groups = new Map<string, HeavySet[]>();
  for (const set of sets) {
    if (!(set.pct >= 55) || !(set.reps > 0)) continue;
    const key = `${set.session_id}|${set.exercise_id}`;
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }
  const out: Json[] = [];
  for (const list of groups.values()) {
    const zones = PRILEPIN.map((zone) => ({ ...zone, reps: list.filter((set) => set.pct >= zone.from && set.pct < zone.below).reduce((sum, set) => sum + set.reps, 0) }))
      .filter((zone) => zone.reps > 0);
    const top = zones.at(-1);
    if (!top || top.from < 70) continue;
    out.push({
      date: list[0].date, exercise_id: list[0].exercise_id, name: name(list[0].exercise_id),
      zones: zones.map((zone) => ({ zone: zone.zone, reps: zone.reps, optimal: zone.optimal, range: `${zone.low}-${zone.high}`, verdict: zone.reps > zone.high ? "above" : zone.reps < zone.low ? "below" : "within" }))
    });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// Bar speed: mean velocity (m/s) logged on sets.
export type VelocitySet = Readonly<{ session_id: string; date: string; exercise_id: string; load_kg: number; velocity: number; set_index: number }>;

export function velocitySummary(sets: readonly VelocitySet[], name: (id: string) => string, windowMid: string): Json[] {
  const byLift = new Map<string, VelocitySet[]>();
  for (const set of sets) if (set.velocity > 0) byLift.set(set.exercise_id, [...(byLift.get(set.exercise_id) ?? []), set]);
  return [...byLift.entries()].map(([exerciseId, list]) => {
    // Speed at the same weight: the weight logged most often (to 2.5 kg), its
    // average speed in the first half of the period against the second.
    const counts = new Map<number, number>();
    for (const set of list) { const kg = Math.round(set.load_kg / 2.5) * 2.5; counts.set(kg, (counts.get(kg) ?? 0) + 1); }
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    const atCommon = list.filter((set) => Math.abs(set.load_kg - common) <= 1.25);
    const before = atCommon.filter((set) => set.date < windowMid).map((set) => set.velocity);
    const after = atCommon.filter((set) => set.date >= windowMid).map((set) => set.velocity);
    // Velocity loss: per session, the fastest set against the last set at the same weight.
    const losses: number[] = [];
    const sessions = new Map<string, VelocitySet[]>();
    for (const set of list) sessions.set(set.session_id, [...(sessions.get(set.session_id) ?? []), set]);
    for (const sessionSets of sessions.values()) {
      const top = Math.max(...sessionSets.map((set) => set.load_kg));
      const atTop = sessionSets.filter((set) => set.load_kg === top).sort((a, b) => a.set_index - b.set_index);
      if (atTop.length < 2) continue;
      const fastest = Math.max(...atTop.map((set) => set.velocity));
      losses.push(((fastest - atTop[atTop.length - 1].velocity) / fastest) * 100);
    }
    return {
      exercise_id: exerciseId, name: name(exerciseId), sets: list.length, common_load_kg: common,
      speed_before: before.length ? round(mean(before), 2) : null, speed_after: after.length ? round(mean(after), 2) : null,
      speed_change: before.length && after.length ? round(mean(after) - mean(before), 2) : null,
      velocity_loss_pct: losses.length ? round(mean(losses), 0) : null,
      latest: list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.set_index - a.set_index).slice(0, 1).map((set) => ({ date: set.date, load_kg: set.load_kg, velocity: set.velocity }))[0]
    };
  }).sort((a, b) => b.sets - a.sets);
}

// Meet attempts from the projected max: opener ~91% (a weight they could
// triple on a bad day), second ~96%, third 100-102%. Powerlifting attempts
// go up in 2.5 kg, weightlifting in 1 kg.
const COMPETITION_LIFTS: Readonly<Record<string, readonly string[]>> = {
  powerlifting: ["back_squat", "bench_press", "deadlift", "sumo_deadlift"],
  olympic_weightlifting: ["snatch", "clean_and_jerk"]
};
export function attemptPlan(activityId: string, lifts: ReadonlyArray<{ exercise_id: string; name: string; latest: number; tested_max?: { value_kg: number; date: string } | null }>, competitionDate: string | null, today: string): Json | null {
  const ids = COMPETITION_LIFTS[activityId];
  if (!ids || !competitionDate || competitionDate < today) return null;
  const days = Math.round((Date.parse(`${competitionDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days > 16 * 7) return null;
  const step = activityId === "powerlifting" ? 2.5 : 1;
  const down = (kg: number) => Math.floor(kg / step) * step;
  const rows = ids.map((id) => lifts.find((lift) => lift.exercise_id === id)).filter((lift): lift is NonNullable<typeof lift> => Boolean(lift)).map((lift) => {
    // The projected max: the recent estimate, or a tested max if it's higher and recent enough to trust.
    const projected = Math.max(lift.latest, lift.tested_max && lift.tested_max.date >= new Date(Date.parse(`${today}T00:00:00Z`) - 120 * 86_400_000).toISOString().slice(0, 10) ? lift.tested_max.value_kg : 0);
    return { exercise_id: lift.exercise_id, name: lift.name, projected_max: round(projected, 1), opener: down(projected * 0.91), second: down(projected * 0.96), third: down(projected * 1.0), third_good_day: down(projected * 1.02) };
  });
  return rows.length ? { competition_date: competitionDate, days_out: days, step_kg: step, rows } : null;
}
