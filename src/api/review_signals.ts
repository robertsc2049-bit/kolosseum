// DEV NOTE: Pure. What a coach wants to know about a session before opening
// it: one line of what was done, and the things worth a look (pain, reps
// missed, very hard, skipped, not finished). Facts from what the athlete
// logged - no score, and nothing is judged for the coach.

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

export type ReviewSignals = Readonly<{ summary: string; flags: readonly string[] }>;
export type SessionRating = Readonly<{ srpe: number; minutes: number }>;

// A rating this high is worth a look: the top of its scale.
const VERY_HARD: Readonly<Record<string, number>> = { RPE_REPORT: 9.5, CR10_REPORT: 9.5, BORG_REPORT: 19 };
const SCALE: Readonly<Record<string, readonly [string, string]>> = { RPE_REPORT: ["RPE", "rpe_value"], CR10_REPORT: ["CR10", "cr10_value"], BORG_REPORT: ["Borg", "borg_value"] };

// events: in the order they were logged. A re-logged set or rating replaces
// the earlier one.
export function reviewSignals(plannedSession: unknown, events: readonly unknown[], status: string, rating: SessionRating | null = null): ReviewSignals {
  const planned = (isRecord(plannedSession) && Array.isArray(plannedSession.exercises) ? plannedSession.exercises.filter(isRecord) : [])
    .filter((exercise) => !["warm_up", "cool_down"].includes(text(exercise.segment)));
  const nameOf = (exercise: Json) => text(exercise.display_name) || text(exercise.name) || text(exercise.exercise_id).replace(/__r[0-9]+$/u, "").replace(/_/gu, " ").replace(/^./u, (letter) => letter.toUpperCase());
  const list = events.filter(isRecord);
  const sets = new Map<string, Json>();
  const ratings = new Map<string, Json>();
  const skipped = new Set<string>();
  const painAreas = new Set<string>();
  let pain = false;
  for (const event of list) {
    const type = text(event.type);
    const id = text(event.exercise_id);
    if (type === "SET_LOG_REPORT" && id && num(event.set_index) !== null) sets.set(`${id}|${num(event.set_index)}`, event);
    else if (SCALE[type] && id) ratings.set(`${type}|${id}`, event);
    else if (type === "SKIP_EXERCISE" && id) skipped.add(id);
    else if (type === "PAIN_REPORT") { pain = true; if (text(event.pain_area)) painAreas.add(text(event.pain_area).replace(/_/gu, " ")); }
  }

  const flags: string[] = [];
  if (pain) flags.push(painAreas.size ? `Pain reported: ${[...painAreas].join(", ")}` : "Pain reported");
  const missed: string[] = [];
  const hard: string[] = [];
  for (const exercise of planned) {
    const id = text(exercise.exercise_id);
    const range = isRecord(exercise.rep_range) ? num(exercise.rep_range.minimum) : null;
    const targets = Array.isArray(exercise.set_targets) ? exercise.set_targets : [];
    const own = [...sets.entries()].filter(([key]) => key.startsWith(`${id}|`)).map(([, event]) => event);
    const short = own.filter((event) => {
      const target = targets[(num(event.set_index) ?? 1) - 1];
      const reps = isRecord(target) && num(target.reps) !== null ? num(target.reps) : range ?? num(exercise.reps);
      const did = num(event.reps);
      return reps !== null && did !== null && did < reps;
    });
    if (short.length) missed.push(nameOf(exercise));
    for (const [type, [label, key]] of Object.entries(SCALE)) {
      const value = num(ratings.get(`${type}|${id}`)?.[key]);
      if (value !== null && value >= VERY_HARD[type]) hard.push(`${nameOf(exercise)} ${label} ${value}`);
    }
  }
  if (missed.length) flags.push(`Reps missed: ${missed.slice(0, 2).join(", ")}${missed.length > 2 ? ` and ${missed.length - 2} more` : ""}`);
  if (hard.length) flags.push(`Very hard: ${hard.slice(0, 2).join(", ")}${hard.length > 2 ? ` and ${hard.length - 2} more` : ""}`);
  const skippedWork = planned.filter((exercise) => skipped.has(text(exercise.exercise_id)));
  if (skippedWork.length) flags.push(`Skipped: ${skippedWork.slice(0, 2).map(nameOf).join(", ")}${skippedWork.length > 2 ? ` and ${skippedWork.length - 2} more` : ""}`);
  else if (status === "partial") flags.push("Finished early");
  if (rating && rating.srpe >= 9) flags.push(`Session rated ${rating.srpe}/10`);

  const plannedSets = planned.reduce((sum, exercise) => sum + (num(exercise.sets) ?? 0), 0);
  const parts = [
    sets.size > 0 && plannedSets > 0 ? `${Math.min(sets.size, plannedSets)} of ${plannedSets} sets` : "",
    rating ? `rated ${rating.srpe}/10, ${rating.minutes} min` : ""
  ].filter(Boolean);
  return Object.freeze({ summary: parts.join(" · "), flags: Object.freeze(flags) });
}
