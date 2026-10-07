// DEV NOTE: API boundary surface. An athlete without a coach builds their own
// training: one week - how many days, and on each day the exercises with sets
// and reps - which repeats. Their sessions follow it day by day; the weights
// come from their own way of setting them (athlete_maxes_service.ts: build
// from what they lift, % of their max, or RPE), and every safety step (pain,
// stand-down, readiness, match and competition days, equipment, coming back
// after a break) still applies. An optional lighter week every 4th week takes
// a set off everything.
//
// Kolosseum programmes are for coaches (programme_catalogue_service.ts); this
// is the self-coached athlete's own builder.
//
// The week is an account event (latest wins); saving a changed week starts
// it again at Day 1, week 1.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { getAthleteTrainingProfile } from "./athlete_onboarding_service.js";
import { type TrainingWeek, TrainingWeekError, exerciseOptionsFor, ownTrainingStamp, validateTrainingWeek } from "./athlete_training_week.js";

export { type OwnTrainingStamp, type TrainingWeek, TrainingWeekError, ownTrainingProgram, ownTrainingStamp } from "./athlete_training_week.js";

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const WEEK_EVENT = "athlete_training_week";

export async function getCurrentTrainingWeek(userId: string): Promise<TrainingWeek | null> {
  const result = await pool.query(
    `SELECT event_payload, occurred_at FROM product_account_events WHERE user_id = $1 AND event_type = $2 ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, WEEK_EVENT]
  );
  const row = result.rows?.[0];
  if (!row || !isRecord(row.event_payload) || !Array.isArray(row.event_payload.days)) return null;
  const p = row.event_payload;
  return {
    week_id: text(p.week_id),
    days: (p.days as unknown[]).filter(isRecord).map((d) => ({ items: (Array.isArray(d.items) ? d.items : []).filter(isRecord).map((i) => ({ exercise_id: text(i.exercise_id), sets: Number(i.sets), reps: Number(i.reps) })) })),
    lighter_every_fourth: p.lighter_every_fourth === true,
    saved_at: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : text(row.occurred_at)
  };
}

// Sessions already built from this week (the next one's index).
export async function trainingWeekSessionCount(userId: string, weekId: string): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::integer AS n FROM sessions WHERE beta_subject_user_id = $1 AND planned_session->'own_training'->>'week_id' = $2`,
    [userId, weekId]
  );
  return Number(result.rows?.[0]?.n ?? 0);
}

export async function getAthleteTrainingWeek(userId: string): Promise<Readonly<Json>> {
  const [profile, week] = await Promise.all([getAthleteTrainingProfile(userId), getCurrentTrainingWeek(userId)]);
  const next = week ? ownTrainingStamp(week, await trainingWeekSessionCount(userId, week.week_id)) : null;
  return Object.freeze({ week, next, exercise_options: exerciseOptionsFor(profile.activity_id) });
}

export async function saveAthleteTrainingWeek(userId: string, input: unknown): Promise<Readonly<Json>> {
  const profile = await getAthleteTrainingProfile(userId);
  const valid = validateTrainingWeek(input, profile.activity_id);
  // The same days keep their place in the week (only the lighter-week choice
  // changed); different days start again at Day 1, week 1.
  const current = await getCurrentTrainingWeek(userId);
  const sameDays = !!current && JSON.stringify(current.days) === JSON.stringify(valid.days);
  const weekId = sameDays ? current!.week_id : `training_week_${crypto.randomUUID().replace(/-/gu, "")}`;
  const payload = { week_id: weekId, ...valid, schema_version: "athlete_training_week_v1" };
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at) VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, WEEK_EVENT, JSON.stringify(payload)]
  );
  return getAthleteTrainingWeek(userId);
}
