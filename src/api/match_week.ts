// DEV NOTE: Pure match-week rules (no database, no clock of its own): where
// today sits relative to the athlete's matches, races or key sessions, and
// how a strength session changes around them - the way a head of S&C plans a
// match-day microcycle:
//
// - Match day and the day before (MD, MD-1): a short primer only - no heavy
//   lower-body work (squats, hinges, single-leg, hamstring/quad isolation,
//   heavy carries, sleds); jumps/sprints/throws kept at 2 sets; upper-body
//   work a notch lighter.
// - Day after (MD+1): recovery - half the sets, easy effort, no jumps or
//   sprints.
// - Other days: unchanged.
//
// Match days are the athlete's usual weekly days plus one-off fixtures.

type Json = Record<string, unknown>;

export const WEEKDAYS = Object.freeze(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const);
export type Weekday = (typeof WEEKDAYS)[number];
export type Fixture = { date: string; label: string };
export type MatchWeek = { match_days: Weekday[]; fixtures: Fixture[] };
export type MatchDayRole = "match_day" | "day_before" | "day_after";
export type MatchContext = { role: MatchDayRole; match_date: string; label: string };

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const weekdayOf = (ms: number): Weekday => WEEKDAYS[(new Date(ms).getUTCDay() + 6) % 7];

const LOWER_BODY_STRENGTH: ReadonlySet<string> = new Set([
  "squat", "hinge", "single_leg_squat", "single_leg_hinge", "hip_extension_isolation", "knee_flexion_isolation",
  "knee_extension_isolation", "carry_bilateral", "carry_unilateral", "conditioning_sled", "calf_raise"
]);
const FAST: ReadonlySet<string> = new Set([
  "jump_vertical", "jump_horizontal", "throw_slam", "sprint_acceleration", "sprint_max_velocity", "deceleration", "change_of_direction"
]);

function matchOn(week: MatchWeek, dayMs: number): Fixture | null {
  const date = isoDay(dayMs);
  const fixture = week.fixtures.find((f) => f.date === date);
  if (fixture) return fixture;
  return week.match_days.includes(weekdayOf(dayMs)) ? { date, label: "Match day" } : null;
}

// Today's role in the match week, nearest first: match day, then the day
// before a match, then the day after one.
export function matchContextFor(week: MatchWeek, today: Date): MatchContext | null {
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const on = matchOn(week, day);
  if (on) return { role: "match_day", match_date: on.date, label: on.label };
  const tomorrow = matchOn(week, day + DAY_MS);
  if (tomorrow) return { role: "day_before", match_date: tomorrow.date, label: tomorrow.label };
  const yesterday = matchOn(week, day - DAY_MS);
  if (yesterday) return { role: "day_after", match_date: yesterday.date, label: yesterday.label };
  return null;
}

function lighter(intensity: Json | undefined, percentStep: number, rpeStep: number, rpeCap: number): Json | undefined {
  if (!intensity) return intensity;
  const value = Number(intensity.value);
  if (!Number.isFinite(value)) return intensity;
  if (intensity.type === "percent_1rm") return { ...intensity, value: Math.max(40, Number((value - percentStep).toFixed(1))) };
  if (intensity.type === "rpe") return { ...intensity, value: Math.min(rpeCap, Math.max(5, value - rpeStep)) };
  return intensity;
}

// Adjust a session's exercises for today's match-week role. patternOf gives
// each exercise's movement pattern from the registry.
export function applyMatchWeek(exercises: Json[], context: MatchContext | null, patternOf: (id: string) => string | undefined): Json[] {
  if (!context) return exercises;
  const out: Json[] = [];
  for (const exercise of exercises) {
    const pattern = patternOf(String(exercise.exercise_id ?? "").replace(/__r[0-9]+$/u, "")) ?? "";
    const sets = Number(exercise.sets);
    const intensity = exercise.intensity as Json | undefined;
    if (context.role === "day_after") {
      if (FAST.has(pattern)) continue;
      out.push({ ...exercise, sets: Number.isInteger(sets) ? Math.max(1, Math.ceil(sets / 2)) : exercise.sets, intensity: lighter(intensity, 15, 3, 5), match_week: context });
      continue;
    }
    if (LOWER_BODY_STRENGTH.has(pattern)) continue;
    if (FAST.has(pattern)) {
      out.push({ ...exercise, sets: Number.isInteger(sets) ? Math.min(sets, 2) : exercise.sets, match_week: context });
      continue;
    }
    out.push({ ...exercise, sets: Number.isInteger(sets) ? Math.max(1, sets - 1) : exercise.sets, intensity: lighter(intensity, 5, 1, 7), match_week: context });
  }
  return out;
}

// Validate a match week as saved by the athlete. Fixtures more than a week
// old are dropped; at most 60 are kept.
export function validateMatchWeek(input: unknown, today: Date): { ok: true; week: MatchWeek } | { ok: false; field_errors: Json } {
  const errors: Json = {};
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Json) : null;
  if (!record) return { ok: false, field_errors: { match_week: "Send your match days and fixtures." } };
  for (const key of Object.keys(record)) if (key !== "match_days" && key !== "fixtures") errors[key] = "Not part of your match week.";
  const days = Array.isArray(record.match_days) ? record.match_days : [];
  if (!Array.isArray(record.match_days) || days.some((d) => !(WEEKDAYS as readonly string[]).includes(String(d)))) {
    errors.match_days = "Choose match days from Monday to Sunday.";
  }
  const cutoff = isoDay(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 7 * DAY_MS);
  const fixtures: Fixture[] = [];
  for (const [index, raw] of (Array.isArray(record.fixtures) ? record.fixtures : []).entries()) {
    const f = raw && typeof raw === "object" ? (raw as Json) : {};
    const date = typeof f.date === "string" ? f.date.trim() : "";
    const label = typeof f.label === "string" ? f.label.trim().replace(/\s+/gu, " ") : "";
    const parsed = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) { errors[`fixtures.${index}`] = "Enter the fixture's date."; continue; }
    if (label.length > 60) { errors[`fixtures.${index}`] = "Keep the fixture name to 60 characters."; continue; }
    if (date < cutoff) continue;
    if (!fixtures.some((existing) => existing.date === date)) fixtures.push({ date, label: label || "Fixture" });
  }
  if (!Array.isArray(record.fixtures) && record.fixtures !== undefined) errors.fixtures = "Fixtures must be a list.";
  if (Object.keys(errors).length) return { ok: false, field_errors: errors };
  return {
    ok: true,
    week: {
      match_days: WEEKDAYS.filter((d) => days.includes(d)),
      fixtures: fixtures.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60)
    }
  };
}
