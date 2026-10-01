// DEV NOTE: API boundary surface. A fighter's declared weight class, stored
// as their own account events, and fight-camp loading applied to a session
// about to be created - see weight_class.ts for the rules. Fight dates are the
// declared competition date and any match-week fixtures.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { getAthleteTrainingPlan } from "./athlete_onboarding_service.js";
import { getMatchWeek } from "./match_week_service.js";
import { exercisePatternOf } from "./medical_stand_down_service.js";
import { COMBAT_ACTIVITIES, applyFightCamp, fightCampFor, validateWeightClass, type FightCamp, type WeightClass } from "./weight_class.js";

type Json = Record<string, unknown>;

const WEIGHT_CLASS_EVENT = "athlete_weight_class_saved";
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export class WeightClassError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export async function getWeightClass(userId: string): Promise<WeightClass> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, WEIGHT_CLASS_EVENT]
  );
  const payload = result.rows?.[0]?.event_payload;
  const validated = validateWeightClass(isRecord(payload) ? { competes_at_weight_class: payload.competes_at_weight_class, weight_class_kg: payload.weight_class_kg } : null);
  return validated.ok ? validated.weight_class : { competes_at_weight_class: false, weight_class_kg: null };
}

export async function saveWeightClass(userId: string, input: unknown): Promise<WeightClass> {
  const plan = await getAthleteTrainingPlan(userId);
  if (!plan || !COMBAT_ACTIVITIES.has(plan.activity_id)) throw new WeightClassError("weight_class_combat_only", 422, { competes_at_weight_class: "Weight classes apply to combat sports." });
  const validated = validateWeightClass(input);
  if (!validated.ok) throw new WeightClassError("weight_class_invalid", 422, validated.field_errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, WEIGHT_CLASS_EVENT,
      JSON.stringify({ ...validated.weight_class, schema_version: "weight_class_v1" })]
  );
  return validated.weight_class;
}

// Fight-camp loading for a self-directed fighter who competes at a weight
// class with a fight in the next 4 weeks; otherwise the session is unchanged.
export async function applyAthleteFightCamp(userId: string, exercises: Json[], today: Date = new Date()): Promise<{ exercises: Json[]; camp: FightCamp | null }> {
  const plan = await getAthleteTrainingPlan(userId);
  if (!plan || !COMBAT_ACTIVITIES.has(plan.activity_id)) return { exercises, camp: null };
  const weightClass = await getWeightClass(userId);
  if (!weightClass.competes_at_weight_class) return { exercises, camp: null };
  const week = await getMatchWeek(userId);
  const dates = [...(plan.competition_date ? [plan.competition_date] : []), ...week.fixtures.map((f) => f.date)];
  const camp = fightCampFor(dates, today.toISOString().slice(0, 10));
  if (!camp) return { exercises, camp: null };
  return { exercises: applyFightCamp(exercises, camp, exercisePatternOf), camp };
}
