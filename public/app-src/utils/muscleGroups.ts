// The muscle groups exercise pickers filter by. Each exercise option from the
// server lists the groups it's filed under (muscle_groups), from
// src/api/exercise_muscles.ts, whose MUSCLE_GROUPS this list mirrors.

export const MUSCLE_GROUPS: readonly { id: string; label: string }[] = [
  { id: "neck", label: "Neck" },
  { id: "shoulders", label: "Shoulders" },
  { id: "rotator_cuff", label: "Rotator cuff" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back and lats" },
  { id: "traps", label: "Traps" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms_grip", label: "Forearms and grip" },
  { id: "abs_obliques", label: "Abs and obliques" },
  { id: "lower_back", label: "Lower back" },
  { id: "glutes", label: "Glutes and hips" },
  { id: "hip_flexors", label: "Hip flexors" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "adductors", label: "Adductors" },
  { id: "calves_shins", label: "Calves and shins" },
  { id: "conditioning", label: "Conditioning" }
];

// Whether an exercise option is filed under a muscle group ("" is every group).
export function inMuscleGroup(option: { muscle_groups?: unknown }, group: string): boolean {
  return !group || (Array.isArray(option.muscle_groups) && option.muscle_groups.includes(group));
}

// "Targets quadriceps and glute max; also adductors" - what an exercise trains.
export function musclesText(option: { target_muscles?: unknown; secondary_muscles?: unknown } | undefined): string {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  const target = list(option?.target_muscles);
  const secondary = list(option?.secondary_muscles);
  if (!target.length) return "";
  return `Targets: ${target.join(", ")}${secondary.length ? ` · Also works: ${secondary.join(", ")}` : ""}`;
}

// Gym shorthand a coach or athlete might type for an exercise.
const SEARCH_ALIASES: Readonly<Record<string, string>> = {
  rdl: "romanian deadlift", sldl: "stiff leg deadlift", db: "dumbbell", bb: "barbell", kb: "kettlebell",
  ohp: "overhead press", bss: "bulgarian split squat", ghr: "glute ham raise", hspu: "handstand push",
  trx: "suspension", ssb: "safety bar", tke: "terminal knee", bw: "bodyweight"
};

const normalise = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

// Whether an exercise matches what was typed. Every word must start a word of
// its name ("rdl" finds Romanian deadlifts by shorthand, never "hurdle"), or
// the whole search must start the name of a muscle it targets ("glutes",
// "chest"). An empty search matches everything.
export function matchesExerciseSearch(name: string, option: { target_muscles?: unknown }, query: string): boolean {
  const search = normalise(query);
  if (!search) return true;
  const nameWords = normalise(name).split(" ");
  const nameText = ` ${nameWords.join(" ")} `;
  const startsAWord = (word: string) => nameWords.some((w) => w.startsWith(word));
  const singular = (word: string) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
  const byName = search.split(" ").every((word) => {
    const expanded = SEARCH_ALIASES[word];
    return startsAWord(word) || startsAWord(singular(word)) || (!!expanded && nameText.includes(` ${expanded}`));
  });
  if (byName) return true;
  const muscles = Array.isArray(option.target_muscles) ? option.target_muscles.map((m) => normalise(String(m))) : [];
  return muscles.some((muscle) => muscle.startsWith(search) || muscle.startsWith(singular(search)));
}

// A week's hard sets per muscle group, the way coaches count volume: every set
// of a working strength exercise counts in full for each group it targets and
// as half a set for each group only its secondary muscles reach. Warm-up and
// cool-down items, power and plyometric work (jumps, sprints, throws, Olympic
// lifts), carries, conditioning, mobility and exercises with no muscles (an
// athlete's own) don't count.
export type VolumeItem = { exercise_id: string; planned_sets: number; segment?: string };
export type MuscleOption = { muscle_groups?: unknown; secondary_muscle_groups?: unknown; volume_counted?: unknown };
export type GroupVolume = { group: string; label: string; sets: number };

export const MAJOR_MUSCLE_GROUPS: readonly string[] = ["chest", "back", "shoulders", "quads", "hamstrings", "glutes"];
// Above this, a week's sets for one group is a lot to recover from.
export const HIGH_WEEKLY_SETS = 25;
// Groups a sport trains on purpose, never flagged as very high (mirrors
// SPORT_FOCUS_GROUPS in src/api/exercise_muscles.ts).
export const SPORT_FOCUS_GROUPS: Readonly<Record<string, readonly string[]>> = { grip_sport: ["forearms_grip"], olympic_weightlifting: ["quads", "glutes"] };

export function weeklyMuscleVolume(items: readonly VolumeItem[], exercises: ReadonlyMap<string, MuscleOption>): GroupVolume[] {
  const sets = new Map<string, number>();
  const add = (group: string, n: number) => { if (group !== "conditioning") sets.set(group, (sets.get(group) ?? 0) + n); };
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  for (const item of items) {
    if (item.segment === "warm_up" || item.segment === "cool_down") continue;
    const n = Number(item.planned_sets);
    if (!Number.isFinite(n) || n <= 0) continue;
    const option = exercises.get(item.exercise_id.replace(/__r[0-9]+$/u, ""));
    // Power, plyometric, carry, conditioning and mobility work isn't hard sets.
    if (!option || option.volume_counted === false) continue;
    for (const group of list(option.muscle_groups)) add(group, n);
    for (const group of list(option.secondary_muscle_groups)) add(group, n / 2);
  }
  return MUSCLE_GROUPS.filter((g) => (sets.get(g.id) ?? 0) > 0).map((g) => ({ group: g.id, label: g.label, sets: sets.get(g.id) ?? 0 }));
}

// "12" or "7.5".
export const formatSets = (sets: number) => (Number.isInteger(sets) ? String(sets) : sets.toFixed(1));
