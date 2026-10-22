// DEV NOTE: A coach's changes to one athlete's session (pure) - see
// athlete_programme_override_service.ts.
type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export type ProgrammeOverride = Readonly<{
  assignment_id: string; session_index: number; exercise_id: string;
  remove?: boolean; sets?: number; reps?: number; load_kg?: number; rpe?: number; note?: string;
}>;

// Pure: this session's exercises with the coach's changes for this athlete.
export function applyProgrammeOverrides(exercises: readonly Json[], overrides: readonly ProgrammeOverride[], sessionIndex: number): { exercises: Json[]; applied: number } {
  const mine = overrides.filter((entry) => entry.session_index === sessionIndex);
  if (!mine.length) return { exercises: [...exercises], applied: 0 };
  let applied = 0;
  const out: Json[] = [];
  for (const exercise of exercises) {
    const change = mine.find((entry) => entry.exercise_id === String(exercise.exercise_id ?? ""));
    if (!change) { out.push(exercise); continue; }
    applied += 1;
    if (change.remove) continue;
    const next: Json = { ...exercise };
    if (change.sets !== undefined) next.sets = change.sets;
    if (change.reps !== undefined) { next.reps = change.reps; delete next.rep_range; }
    if (change.load_kg !== undefined) { next.intensity = { type: "load", value: change.load_kg, unit: "kg" }; next.resolved_load = { value: change.load_kg, unit: "kg" }; }
    if (change.rpe !== undefined) { next.intensity = { type: "rpe", value: change.rpe }; next.resolved_load = null; }
    if (change.note) next.coaching_notes = [text(exercise.coaching_notes), `Your coach: ${change.note}`].filter(Boolean).join(" ");
    next.coach_override = true;
    out.push(next);
  }
  return { exercises: out, applied };
}
