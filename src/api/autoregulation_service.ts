// DEV NOTE: API boundary surface. Autoregulation for self-directed athletes:
// what they actually did last time changes the next prescription for that
// exercise, the way a coach would. Conservative by design - it only ever
// holds an exercise back, never adds load (progression stays with the
// periodised plan):
//
// - Missed reps: at least half the logged sets fell short of the prescribed
//   reps (including a failed set, 0 reps) - 5% of 1RM lighter / 1 RPE lower.
// - Too hard: an RPE of 9.5 or more reported for the exercise - the same.
//
// Only the athlete's most recent session containing the exercise counts, and
// a hold is shown with its reason. Records facts only.

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { heldIntensity, holdFor, type LastTime } from "./autoregulation.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const baseExerciseId = (id: string) => id.replace(/__r[0-9]+$/u, "");

// The athlete's latest earlier session for each exercise: its prescription,
// logged sets and reported RPE.
async function lastTimes(client: QueryClient, athleteUserId: string, exerciseIds: string[]): Promise<Map<string, LastTime>> {
  const sessions = await client.query(
    `SELECT session_id, planned_session FROM sessions
     WHERE beta_subject_user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [athleteUserId]
  );
  const wanted = new Set(exerciseIds);
  const found = new Map<string, LastTime>();
  for (const row of sessions.rows ?? []) {
    const planned = isRecord(row.planned_session) ? row.planned_session : {};
    const exercises = Array.isArray(planned.exercises) ? planned.exercises.filter(isRecord) : [];
    const here = exercises.filter((e: Json) => wanted.has(baseExerciseId(String(e.exercise_id ?? ""))) && !found.has(baseExerciseId(String(e.exercise_id ?? ""))));
    if (!here.length) continue;
    const events = await client.query(
      `SELECT event FROM runtime_events WHERE session_id = $1
       AND event->>'type' IN ('SET_LOG_REPORT', 'RPE_REPORT') ORDER BY seq`,
      [row.session_id]
    );
    // Nothing logged for an exercise: that session tells us nothing about it.
    for (const exercise of here) {
      const id = String(exercise.exercise_id);
      const bySet = new Map<number, number>();
      let rpe: number | null = null;
      for (const { event } of events.rows ?? []) {
        if (!isRecord(event) || event.exercise_id !== id) continue;
        if (event.type === "SET_LOG_REPORT" && Number.isInteger(event.set_index) && Number.isInteger(event.reps)) bySet.set(Number(event.set_index), Number(event.reps));
        if (event.type === "RPE_REPORT" && Number.isFinite(Number(event.rpe_value))) rpe = Number(event.rpe_value);
      }
      if (!bySet.size && rpe === null) continue;
      const reps = Number(exercise.reps ?? (isRecord(exercise.rep_range) ? exercise.rep_range.maximum : NaN));
      found.set(baseExerciseId(id), {
        session_id: String(row.session_id),
        prescribed_reps: Number.isInteger(reps) ? reps : null,
        set_reps: [...bySet.values()],
        rpe
      });
    }
    if (found.size === wanted.size) break;
  }
  return found;
}

// Apply holds to a self-directed session about to be created.
export async function autoregulateSession(athleteUserId: string, exercises: Json[]): Promise<Json[]> {
  const ids = [...new Set(exercises.map((e) => baseExerciseId(String(e.exercise_id ?? ""))).filter(Boolean))];
  if (!ids.length) return exercises;
  const client = await pool.connect();
  let history: Map<string, LastTime>;
  try { history = await lastTimes(client, athleteUserId, ids); }
  finally { client.release(); }
  return exercises.map((exercise) => {
    const hold = holdFor(history.get(baseExerciseId(String(exercise.exercise_id ?? ""))));
    if (!hold || !isRecord(exercise.intensity)) return exercise;
    const intensity = heldIntensity(exercise.intensity);
    if (!intensity) return exercise;
    return { ...exercise, intensity, autoregulation: { ...hold, planned_intensity: exercise.intensity } };
  });
}
