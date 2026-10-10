// DEV NOTE: The warm-up and cool-down for a session the app builds for a
// self-directed athlete - their generated programme, their own week or
// today's picks. The same choice the Kolosseum programmes make
// (shared/session-bookends): dynamic mobility for what the day trains first,
// stretches for it last, bodyweight only. A coach's programme is the coach's
// to write, so coach-assigned sessions are left as the coach wrote them, and
// a session that already has a warm-up or cool-down gets nothing added.

import { sessionBookends } from "../../shared/session-bookends/sessionBookends.mjs";
import { sessionExerciseDisplayNames } from "./athlete_onboarding_service.js";

type SessionExercise = Record<string, unknown> & { exercise_id: string };

const MAX_SESSION_EXERCISES = 12;

type Bookend = { exercise_id: string; segment: "warm_up" | "cool_down"; reps?: number; seconds?: number; note: string };

function toSessionExercise(item: Bookend, index: number, blockId: string, names: Record<string, string>): SessionExercise {
  return {
    exercise_id: item.exercise_id,
    source: "program",
    block_id: blockId,
    item_id: `${item.segment}_${index + 1}`,
    sets: 1,
    reps: item.seconds ? 0 : item.reps ?? 0,
    intensity: { type: "bodyweight" },
    resolved_load: null,
    rest_seconds: 0,
    segment: item.segment,
    coaching_notes: item.note,
    ...(item.seconds ? { duration_seconds: item.seconds } : {}),
    ...(names[item.exercise_id] ? { display_name: names[item.exercise_id] } : {})
  };
}

export function withSessionBookends(
  exercises: readonly SessionExercise[],
  patternOf: (exerciseId: string) => string | undefined
): SessionExercise[] {
  if (!exercises.length) return [...exercises];
  if (exercises.some((e) => e.segment === "warm_up" || e.segment === "cool_down")) return [...exercises];
  const { warm_up, cool_down } = sessionBookends(exercises.map((e) => e.exercise_id), (id: string) => patternOf(id) ?? "", MAX_SESSION_EXERCISES) as { warm_up: Bookend[]; cool_down: Bookend[] };
  const blockId = typeof exercises[0].block_id === "string" ? exercises[0].block_id : "B0";
  const names = sessionExerciseDisplayNames([...warm_up, ...cool_down].map((item) => item.exercise_id), {});
  return [
    ...warm_up.map((item, i) => toSessionExercise(item, i, blockId, names)),
    ...exercises,
    ...cool_down.map((item, i) => toSessionExercise(item, i, blockId, names))
  ];
}
