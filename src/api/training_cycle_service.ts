// DEV NOTE: Loads a self-directed athlete's declared training plan and this
// week's session count, and computes the cycle for their next session. The date
// logic lives in training_cycle.ts; this is the only place "today" enters.

import type { TrainingCycle } from "@kolosseum/engine/phases/phase4.js";
import { pool } from "../db/pool.js";
import { getAthleteTrainingPlan } from "./athlete_onboarding_service.js";
import { computeTrainingCycle, weekStartMs } from "./training_cycle.js";

// The cycle for a self-directed athlete's next session, or null when they have
// not declared a training plan (the engine then serves the single session).
export async function trainingCycleForAthlete(userId: string, now: Date = new Date()): Promise<TrainingCycle | null> {
  const plan = await getAthleteTrainingPlan(userId);
  if (!plan) return null;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sessions WHERE beta_subject_user_id = $1 AND created_at >= $2::timestamptz`,
    [userId, new Date(weekStartMs(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))).toISOString()]
  );
  const sessionsThisWeek = Number(result.rows?.[0]?.n ?? 0);
  return computeTrainingCycle(plan, now, sessionsThisWeek);
}
