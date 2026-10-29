// DEV NOTE: A coach's programme arrives with its weights already worked out
// from the athlete's maxes (resolved_load). When a later step makes an
// exercise lighter by its % of max - the day before or after a match, after a
// big sport day - the weight must follow, or the athlete would see "70%" and
// still be told to lift the old 80% weight. Pure.

type Json = Record<string, unknown>;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function rescaleResolvedLoads(exercises: readonly Json[], increment = 2.5): Json[] {
  return exercises.map((exercise) => {
    const intensity = exercise.intensity as Json | undefined;
    const resolved = exercise.resolved_load as Json | null | undefined;
    if (!intensity || intensity.type !== "percent_1rm" || !resolved || typeof resolved !== "object") return exercise;
    const pct = Number(intensity.value);
    const was = Number(resolved.percentage);
    const max = Number(resolved.calculation_one_rep_max ?? resolved.one_rep_max);
    if (!finite(pct) || !finite(was) || !finite(max) || max <= 0 || pct === was) return exercise;
    const value = Math.round(((max * pct) / 100) / increment) * increment;
    // Set by set: every set lightened by the same share.
    const targets = Array.isArray(exercise.set_targets)
      ? (exercise.set_targets as Json[]).map((target) => {
          const at = target.intensity as Json | undefined;
          if (!at || at.type !== "percent_1rm" || !finite(Number(at.value))) return target;
          const percent = Math.round(Number(at.value) * (pct / was) * 2) / 2;
          return {
            ...target,
            intensity: { ...at, value: percent },
            ...(target.resolved_load && typeof target.resolved_load === "object"
              ? { resolved_load: { ...(target.resolved_load as Json), percentage: percent, value: Math.round(((max * percent) / 100) / increment) * increment } }
              : {})
          };
        })
      : null;
    return { ...exercise, resolved_load: { ...resolved, value, percentage: pct }, ...(targets ? { set_targets: targets } : {}) };
  });
}
