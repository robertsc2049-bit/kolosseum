// DEV NOTE: HYROX race standards (pure). A HYROX athlete's division decides
// the weights they race with, so their station work shows the race weight
// for their division next to the exercise. HYROX sets these per season and
// they can change: the figures below are the 2025/26 singles standards as
// published by HYROX and consistent across independent summaries in Oct 2026
// (sled weights include the sled; farmers carry is per hand). Repetition
// counts and wall-ball target heights vary by season and source, so they are
// not stated - the athlete is told to check their event's rulebook.

type Json = Record<string, unknown>;

export const HYROX_STANDARDS_SEASON = "2025/26";
export const HYROX_DIVISIONS = ["women_open", "men_open", "women_pro", "men_pro"] as const;
export type HyroxDivision = typeof HYROX_DIVISIONS[number];

const LABEL: Readonly<Record<HyroxDivision, string>> = {
  women_open: "Women's Open", men_open: "Men's Open", women_pro: "Women's Pro", men_pro: "Men's Pro"
};
// kg: sled push and sled pull include the sled; farmers carry is per hand.
const KG: Readonly<Record<HyroxDivision, { sled_push: number; sled_pull: number; farmers: number; sandbag: number; wall_ball: number }>> = {
  women_open: { sled_push: 102, sled_pull: 78, farmers: 16, sandbag: 10, wall_ball: 4 },
  men_open: { sled_push: 152, sled_pull: 103, farmers: 24, sandbag: 20, wall_ball: 6 },
  women_pro: { sled_push: 152, sled_pull: 103, farmers: 24, sandbag: 20, wall_ball: 6 },
  men_pro: { sled_push: 202, sled_pull: 153, farmers: 32, sandbag: 30, wall_ball: 9 }
};

export const isHyroxDivision = (value: unknown): value is HyroxDivision => typeof value === "string" && (HYROX_DIVISIONS as readonly string[]).includes(value);

// The race weight line for a station exercise in this division, or null.
export function raceStandardFor(exerciseId: string, division: HyroxDivision): string | null {
  const kg = KG[division];
  const id = exerciseId.replace(/__r[0-9]+$/u, "");
  const what = id === "sled_push" ? `${kg.sled_push} kg sled (including the sled)`
    : id === "sled_drag" || id === "sled_pull" ? `${kg.sled_pull} kg sled pull (including the sled)`
    : id === "farmers_carry" ? `2 x ${kg.farmers} kg`
    : id === "sandbag_lunge" ? `${kg.sandbag} kg sandbag`
    : id === "wall_ball" ? `${kg.wall_ball} kg ball`
    : null;
  return what ? `Race weight, ${LABEL[division]} (${HYROX_STANDARDS_SEASON}): ${what}. Check your event's rulebook.` : null;
}

// Each station exercise in the session gains its race weight line.
export function applyHyroxRaceStandards(exercises: readonly Json[], division: HyroxDivision): Json[] {
  return exercises.map((exercise) => {
    const line = raceStandardFor(String(exercise.exercise_id ?? ""), division);
    return line ? { ...exercise, race_standard: line } : exercise;
  });
}
