// DEV NOTE: API boundary surface (pure). Workout scores for timed groups
// (AMRAP, EMOM, for time) - the way CrossFit keeps them: the same workout's
// results over time, with Rx and scaled kept apart (a scaled score is never
// compared with, or counted as a best against, an Rx one). Records facts only.

type Json = Record<string, unknown>;

export type WorkoutResult = {
  session_id: string;
  date: string;
  group_type: "amrap" | "emom" | "for_time";
  // The group as prescribed: its members in order and its timing.
  exercises: Array<{ exercise_id: string; reps: number | null; distance_m: number | null; duration_seconds: number | null }>;
  time_cap_seconds: number;
  round_seconds: number;
  total_rounds: number;
  event: Json;
};

export type WorkoutScore = {
  session_id: string;
  date: string;
  scaled: boolean;
  // AMRAP: rounds + reps; EMOM: rounds done / missed; for time: seconds, or capped.
  rounds_completed?: number;
  extra_reps?: number;
  rounds_missed?: number;
  elapsed_seconds?: number;
  hit_time_cap?: boolean;
  label: string;
};

export type WorkoutHistory = {
  workout_key: string;
  group_type: WorkoutResult["group_type"];
  exercises: WorkoutResult["exercises"];
  time_cap_seconds: number;
  round_seconds: number;
  total_rounds: number;
  results: WorkoutScore[];
  best_rx: WorkoutScore | null;
  best_scaled: WorkoutScore | null;
};

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function scoreOf(result: WorkoutResult): WorkoutScore | null {
  const e = result.event;
  const scaled = e.scaled === true;
  const base = { session_id: result.session_id, date: result.date, scaled };
  if (result.group_type === "amrap" && Number.isInteger(e.rounds_completed)) {
    const rounds = Number(e.rounds_completed);
    const reps = Number.isInteger(e.extra_reps) ? Number(e.extra_reps) : 0;
    return { ...base, rounds_completed: rounds, extra_reps: reps, label: `${rounds} rounds + ${reps} reps` };
  }
  if (result.group_type === "emom" && Number.isInteger(e.rounds_completed)) {
    const rounds = Number(e.rounds_completed);
    const missed = Number.isInteger(e.rounds_missed) ? Number(e.rounds_missed) : 0;
    return { ...base, rounds_completed: rounds, rounds_missed: missed, label: `${rounds} rounds, ${missed} missed` };
  }
  if (result.group_type === "for_time" && Number.isInteger(e.elapsed_seconds)) {
    const seconds = Number(e.elapsed_seconds);
    const capped = e.hit_time_cap === true;
    return { ...base, elapsed_seconds: seconds, hit_time_cap: capped, label: capped ? `Time cap (${mmss(seconds)})` : mmss(seconds) };
  }
  return null;
}

// Positive when a beats b.
function compare(type: WorkoutResult["group_type"], a: WorkoutScore, b: WorkoutScore): number {
  if (type === "amrap") return (a.rounds_completed! - b.rounds_completed!) || (a.extra_reps! - b.extra_reps!);
  if (type === "emom") return (a.rounds_completed! - b.rounds_completed!) || (b.rounds_missed! - a.rounds_missed!);
  // For time: finishing beats hitting the cap; then faster is better.
  if (a.hit_time_cap !== b.hit_time_cap) return a.hit_time_cap ? -1 : 1;
  return b.elapsed_seconds! - a.elapsed_seconds!;
}

// The same workout: same format, timing and members (with their doses).
export function workoutKey(result: Pick<WorkoutResult, "group_type" | "exercises" | "time_cap_seconds" | "round_seconds" | "total_rounds">): string {
  const members = result.exercises.map((x) => `${x.exercise_id}:${x.reps ?? ""}:${x.distance_m ?? ""}:${x.duration_seconds ?? ""}`).join(",");
  return `${result.group_type}|${result.time_cap_seconds}|${result.round_seconds}|${result.total_rounds}|${members}`;
}

// Each workout's scores, newest first, with its best Rx and best scaled
// score. Workouts are ordered by their most recent result.
export function workoutHistories(results: readonly WorkoutResult[]): WorkoutHistory[] {
  const byKey = new Map<string, WorkoutHistory>();
  for (const result of results) {
    const score = scoreOf(result);
    if (!score) continue;
    const key = workoutKey(result);
    let history = byKey.get(key);
    if (!history) {
      history = {
        workout_key: key, group_type: result.group_type, exercises: result.exercises,
        time_cap_seconds: result.time_cap_seconds, round_seconds: result.round_seconds, total_rounds: result.total_rounds,
        results: [], best_rx: null, best_scaled: null
      };
      byKey.set(key, history);
    }
    history.results.push(score);
  }
  const out = [...byKey.values()];
  for (const history of out) {
    history.results.sort((a, b) => b.date.localeCompare(a.date));
    for (const score of history.results) {
      const slot = score.scaled ? "best_scaled" : "best_rx";
      const best = history[slot];
      if (!best || compare(history.group_type, score, best) > 0) history[slot] = score;
    }
  }
  return out.sort((a, b) => (b.results[0]?.date ?? "").localeCompare(a.results[0]?.date ?? ""));
}
