// DEV NOTE: The gym session fits around the sport (pure). What a
// self-directed athlete logged outside the gym - practice, matches,
// conditioning, with minutes, effort and jumps - changes today's session the
// way their S&C coach would:
// - after a match yesterday, a big sport day (twice their usual daily sport
//   load and at least 400 load points in the last 24 h), or 200+ jumps in the
//   last 48 h: no reactive jumps today (landing drills stay), and the heavy
//   lower-body lifts are a set shorter and a notch lighter (5 points of %, or
//   1 RPE);
// - otherwise, nothing changes.
// Upper-body work is left as it is. The change is stamped on the session so
// the coach can see why.

type Json = Record<string, unknown>;

export type SportEntry = Readonly<{ date: string; kind: string; minutes: number; srpe: number; jumps?: number | null }>;

export const BIG_DAY_MIN_LOAD = 400;
export const BIG_DAY_FACTOR = 2;
export const JUMPS_48H_LIMIT = 200;

const LOWER_HEAVY = new Set(["squat", "hinge", "single_leg_squat", "single_leg_hinge", "lunge"]);
const LANDING_DRILL = /_to_stick$/u;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function sportLoadToday(entries: readonly SportEntry[], today: string): Json {
  const yesterday = addDays(today, -1);
  const load = (entry: SportEntry) => Math.max(0, entry.minutes) * Math.max(0, entry.srpe);
  const matchYesterday = entries.some((entry) => entry.kind === "match" && (entry.date === yesterday || entry.date === today));
  const last24h = entries.filter((entry) => entry.date === yesterday || entry.date === today).reduce((sum, entry) => sum + load(entry), 0);
  // Their usual: mean daily sport load over the 28 days before yesterday.
  const window = entries.filter((entry) => entry.date >= addDays(today, -29) && entry.date < yesterday);
  const usualDaily = window.reduce((sum, entry) => sum + load(entry), 0) / 28;
  const jumps48h = entries.filter((entry) => entry.date >= addDays(today, -2)).reduce((sum, entry) => sum + (Number(entry.jumps) || 0), 0);
  const bigDay = last24h >= BIG_DAY_MIN_LOAD && last24h >= BIG_DAY_FACTOR * Math.max(usualDaily, 1);
  const reason = matchYesterday ? "match" : bigDay ? "big_sport_day" : jumps48h >= JUMPS_48H_LIMIT ? "jump_load" : null;
  return { reason, last_24h_load: Math.round(last24h), usual_daily_load: Math.round(usualDaily), jumps_48h: jumps48h };
}

export function applySportLoad(exercises: readonly Json[], today: Json, patternOf: (exerciseId: string) => string | undefined): { exercises: Json[]; adjustment: Json | null } {
  if (!today.reason) return { exercises: [...exercises], adjustment: null };
  const removed: string[] = [];
  const lightened: string[] = [];
  const out: Json[] = [];
  for (const exercise of exercises) {
    const id = String(exercise.exercise_id ?? "").replace(/__r[0-9]+$/u, "");
    const pattern = patternOf(id) ?? "";
    const working = !exercise.segment || exercise.segment === "working";
    if (working && /^jump_/u.test(pattern) && !LANDING_DRILL.test(id)) { removed.push(id); continue; }
    if (working && LOWER_HEAVY.has(pattern) && Number(exercise.sets) > 0) {
      const intensity = (exercise.intensity ?? {}) as Json;
      const lighter = intensity.type === "percent_1rm" && Number.isFinite(Number(intensity.value)) ? { ...intensity, value: Math.max(50, Number(intensity.value) - 5) }
        : intensity.type === "rpe" && Number.isFinite(Number(intensity.value)) ? { ...intensity, value: Math.max(5, Number(intensity.value) - 1) }
        : intensity.type === "load" && Number.isFinite(Number(intensity.value)) ? { ...intensity, value: Math.max(2.5, Math.floor((Number(intensity.value) * 0.95) / 2.5) * 2.5) }
        : intensity;
      out.push({ ...exercise, sets: Math.max(1, Number(exercise.sets) - 1), intensity: lighter });
      lightened.push(id);
      continue;
    }
    out.push(exercise);
  }
  if (!removed.length && !lightened.length) return { exercises: [...exercises], adjustment: null };
  return { exercises: out, adjustment: { ...today, removed, lightened } };
}

export function sportLoadNote(adjustment: Json): string {
  const why = adjustment.reason === "match" ? "after your match"
    : adjustment.reason === "big_sport_day" ? `after a big day of training (${adjustment.last_24h_load} load points, against ${adjustment.usual_daily_load} usually)`
    : `after ${adjustment.jumps_48h} jumps in the last two days`;
  const parts = [
    (adjustment.removed as string[]).length ? "no jumps today" : "",
    (adjustment.lightened as string[]).length ? "your heavy leg work a set shorter and a little lighter" : ""
  ].filter(Boolean);
  return `Lighter today ${why}: ${parts.join(", and ")}.`;
}
