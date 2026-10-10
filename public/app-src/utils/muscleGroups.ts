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
