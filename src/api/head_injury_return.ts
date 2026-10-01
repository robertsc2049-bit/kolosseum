// DEV NOTE: API boundary surface (pure). The first week back after a head
// injury (concussion) stand-down ends: whatever the athlete's session gap,
// it is a lighter re-entry week, and exercises that jar the head or load the
// neck - jumps, sprints, cutting and decelerations, neck isometrics - are held
// back. Records facts only; the product gives no medical advice and the
// return date always comes from the athlete's medical professional.

export const HEAD_INJURY_RETURN_DAYS = 7;
export const HELD_BACK_PATTERNS: ReadonlySet<string> = new Set([
  "jump_vertical", "jump_horizontal", "sprint_acceleration", "sprint_max_velocity",
  "deceleration", "change_of_direction", "neck_isometric"
]);

const DAY_MS = 86_400_000;
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type HeadInjuryStandDown = {
  reason: string;
  from_date: string;
  until_date: string;
  // The day it was ended early on clearance, when it was.
  ended_on?: string | null;
};

export type HeadInjuryReturn = { returned_on: string; stood_down_days: number };

// The day training resumed after a head-injury stand-down: the day it was
// ended on clearance, else the day after its "no training until" date.
export function returnedOn(standDown: HeadInjuryStandDown): string {
  return standDown.ended_on ?? isoDay(dayMs(standDown.until_date) + DAY_MS);
}

// The athlete's most recent head-injury return still within its first week
// on `today`, or null.
export function headInjuryReturnFor(standDowns: readonly HeadInjuryStandDown[], today: string): HeadInjuryReturn | null {
  const returns = standDowns
    .filter((s) => s.reason === "head_injury")
    .map((s) => ({ s, on: returnedOn(s) }))
    .filter(({ on }) => on <= today && dayMs(today) < dayMs(on) + HEAD_INJURY_RETURN_DAYS * DAY_MS)
    .sort((a, b) => b.on.localeCompare(a.on));
  if (!returns.length) return null;
  const { s, on } = returns[0];
  return { returned_on: on, stood_down_days: Math.max(0, Math.round((dayMs(on) - dayMs(s.from_date)) / DAY_MS)) };
}

// Today's session without the exercises held back in the return week. An
// empty result means every exercise is held back - the caller refuses the
// session rather than serve it.
export function holdBackAfterHeadInjury<T extends { exercise_id?: unknown }>(
  exercises: readonly T[],
  patternOf: (exerciseId: string) => string | undefined
): { exercises: T[]; held_back: string[] } {
  const base = (id: string) => id.replace(/__r[0-9]+$/u, "");
  const held = exercises.filter((e) => HELD_BACK_PATTERNS.has(patternOf(base(String(e.exercise_id ?? ""))) ?? ""));
  return { exercises: exercises.filter((e) => !held.includes(e)), held_back: held.map((e) => String(e.exercise_id)) };
}
