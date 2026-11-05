// DEV NOTE: API boundary surface. Stores an athlete's daily readiness
// check-in (their own account events) and, only where someone has chosen
// the rule, applies today's to a session about to be created - see
// readiness.ts for the rules. Days are UTC calendar days.
//
// Who chooses: a coached athlete's coach, for that athlete; a self-directed
// athlete, for themselves. Off by default. Each choice is an account event on
// the athlete's account (GDPR export and erasure cover it): the latest one
// per chooser wins, and nothing is ever edited.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { applyReadiness, isLowReadiness, validateReadiness, type LighteningRule, type ReadinessCheckIn } from "./readiness.js";

type Json = Record<string, unknown>;

const READINESS_EVENT = "athlete_readiness_check_in";
const LIGHTENING_EVENT = "readiness_lightening_set";
const today = () => new Date().toISOString().slice(0, 10);

export class ReadinessError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export async function todaysReadiness(userId: string, date = today()): Promise<ReadinessCheckIn | null> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type = $2 AND event_payload->>'date' = $3
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [userId, READINESS_EVENT, date]
  );
  const payload = result.rows?.[0]?.event_payload as Json | undefined;
  if (!payload) return null;
  const extra = (key: string) => (typeof payload[key] === "number" ? { [key]: payload[key] as number } : {});
  return { date, sleep: Number(payload.sleep), soreness: Number(payload.soreness), stress: Number(payload.stress), ...extra("fatigue"), ...extra("mood"), ...extra("resting_hr"), ...extra("hrv_ms") };
}

const newEventId = () => `account_event_${crypto.randomUUID().replace(/-/gu, "")}`;

// The latest choice by one chooser: the athlete themselves, or one coach.
async function latestLightening(athleteUserId: string, coachUserId: string | null): Promise<boolean> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type = $2 AND event_payload->>'set_by' = $3 AND COALESCE(event_payload->>'coach_user_id', '') = $4
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [athleteUserId, LIGHTENING_EVENT, coachUserId ? "coach" : "athlete", coachUserId ?? ""]
  );
  return result.rows?.[0]?.event_payload?.enabled === true;
}

// Coaches whose latest choice for this athlete is "on" and who still coach them.
async function coachesWithLighteningOn(athleteUserId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (event_payload->>'coach_user_id') event_payload
     FROM product_account_events
     WHERE user_id = $1 AND event_type = $2 AND event_payload->>'set_by' = 'coach'
     ORDER BY event_payload->>'coach_user_id', occurred_at DESC, event_id DESC`,
    [athleteUserId, LIGHTENING_EVENT]
  );
  const on: string[] = [];
  for (const row of result.rows ?? []) {
    const coach = typeof row.event_payload?.coach_user_id === "string" ? row.event_payload.coach_user_id : "";
    if (row.event_payload?.enabled !== true || !coach) continue;
    try { await requireCoachAthleteAccess(coach, athleteUserId); on.push(coach); } catch { /* no longer their coach */ }
  }
  return on;
}

function enabledFrom(input: unknown): boolean {
  const enabled = input && typeof input === "object" && !Array.isArray(input) ? (input as Json).enabled : undefined;
  if (typeof enabled !== "boolean") throw new ReadinessError("readiness_lightening_invalid", 422, { enabled: "Choose on or off." });
  return enabled;
}

async function recordLightening(athleteUserId: string, enabled: boolean, coachUserId: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [newEventId(), athleteUserId, LIGHTENING_EVENT, JSON.stringify({ enabled, set_by: coachUserId ? "coach" : "athlete", ...(coachUserId ? { coach_user_id: coachUserId } : {}), schema_version: "readiness_lightening_v1" })]
  );
}

export async function describeReadiness(userId: string): Promise<Readonly<Json>> {
  const check = await todaysReadiness(userId);
  const [own, coaches] = await Promise.all([latestLightening(userId, null), coachesWithLighteningOn(userId)]);
  return Object.freeze({
    today: check,
    low: check ? isLowReadiness(check) : false,
    // own: a self-directed athlete's own choice; coach_on: a coach of theirs
    // has the rule on for them (it applies to that coach's sessions).
    lightening: { own, coach_on: coaches.length > 0 }
  });
}

// A self-directed athlete turning the rule on or off for themselves.
export async function setOwnLightening(userId: string, input: unknown): Promise<Readonly<Json>> {
  await recordLightening(userId, enabledFrom(input), null);
  return describeReadiness(userId);
}

// A coach's choice for one of their athletes.
export async function coachLightening(coachUserId: string, athleteUserId: string): Promise<Readonly<Json>> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  return Object.freeze({ athlete_user_id: athleteUserId, enabled: await latestLightening(athleteUserId, coachUserId) });
}

export async function setCoachLightening(coachUserId: string, athleteUserId: string, input: unknown): Promise<Readonly<Json>> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  await recordLightening(athleteUserId, enabledFrom(input), coachUserId);
  return coachLightening(coachUserId, athleteUserId);
}

export async function saveReadiness(userId: string, input: unknown): Promise<Readonly<Json>> {
  const validated = validateReadiness(input, today());
  if (!validated.ok) throw new ReadinessError("readiness_invalid", 422, validated.field_errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [newEventId(), userId, READINESS_EVENT, JSON.stringify({ ...validated.check, schema_version: "readiness_v1" })]
  );
  return describeReadiness(userId);
}

// Applied to a session about to be created, only if its chooser turned the
// rule on: the coach whose programme it is (coachUserId), or the
// self-directed athlete themselves (coachUserId null).
export async function applyTodaysReadiness(userId: string, exercises: Json[], coachUserId: string | null = null): Promise<Json[]> {
  if (!(await latestLightening(userId, coachUserId))) return exercises;
  const rule: LighteningRule = coachUserId ? "coach" : "athlete";
  return applyReadiness(exercises, await todaysReadiness(userId), rule);
}
