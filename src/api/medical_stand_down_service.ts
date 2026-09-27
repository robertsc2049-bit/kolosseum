// DEV NOTE: API boundary surface. Medical stand-down: after a head injury
// (concussion) or any medical instruction not to train, the athlete or their
// coach records a stand-down with the date training may resume, taken from
// the athlete's medical professional. Until then no session is created - the
// product never overrides a stand-down and never gives medical advice.
//
// - It ends on its "no training until" date, or earlier only when a medical
//   professional has cleared the athlete (the athlete confirms that, or their
//   coach ends it).
// - Records facts only: a reason category (head injury / other medical), who
//   recorded it and the dates. No symptoms, diagnosis or notes are stored.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type Json = Record<string, unknown>;

const RECORDED = "athlete_stand_down_recorded";
const ENDED = "athlete_stand_down_ended";
const REASONS = new Set(["head_injury", "medical"]);
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const today = () => new Date().toISOString().slice(0, 10);

export class StandDownError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export type StandDown = {
  stand_down_id: string;
  reason: "head_injury" | "medical";
  from_date: string;
  until_date: string;
  recorded_by: "athlete" | "coach";
  recorded_at: string;
};

// The athlete's active stand-down (recorded, not ended, and today is on or
// before its "no training until" date), or null.
export async function activeStandDown(athleteUserId: string, onDate = today()): Promise<StandDown | null> {
  const result = await pool.query(
    `SELECT event_type, event_payload, occurred_at FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3) ORDER BY occurred_at, event_id`,
    [athleteUserId, RECORDED, ENDED]
  );
  const ended = new Set((result.rows ?? []).filter((r: Json) => r.event_type === ENDED).map((r: Json) => text((r.event_payload as Json)?.stand_down_id)));
  const active = (result.rows ?? [])
    .filter((r: Json) => r.event_type === RECORDED && isRecord(r.event_payload))
    .map((r: Json) => ({ ...(r.event_payload as Json), recorded_at: new Date(String(r.occurred_at)).toISOString() }) as unknown as StandDown)
    .filter((s: StandDown) => !ended.has(s.stand_down_id) && s.from_date <= onDate && onDate <= s.until_date);
  return active.length ? active[active.length - 1] : null;
}

function validate(input: unknown, recordedBy: "athlete" | "coach"): Omit<StandDown, "stand_down_id" | "recorded_at"> {
  if (!isRecord(input)) throw new StandDownError("stand_down_invalid", 422);
  const errors: Json = {};
  for (const key of Object.keys(input)) if (!["reason", "until_date"].includes(key)) errors[key] = "Not part of a stand-down.";
  const reason = text(input.reason);
  if (!REASONS.has(reason)) errors.reason = "Choose head injury or another medical reason.";
  const until = text(input.until_date);
  const parsed = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(until) ? new Date(`${until}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== until) errors.until_date = "Enter the date your medical professional says you can train again.";
  else if (until < today()) errors.until_date = "That date has passed.";
  if (Object.keys(errors).length) throw new StandDownError("stand_down_invalid", 422, errors);
  return { reason: reason as StandDown["reason"], from_date: today(), until_date: until, recorded_by: recordedBy };
}

async function append(userId: string, type: string, payload: Json) {
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, type, JSON.stringify(payload)]
  );
}

export async function describeStandDown(athleteUserId: string): Promise<Readonly<Json>> {
  return Object.freeze({ stand_down: await activeStandDown(athleteUserId) });
}

export async function recordStandDown(athleteUserId: string, input: unknown, recordedBy: "athlete" | "coach" = "athlete"): Promise<Readonly<Json>> {
  const standDown = validate(input, recordedBy);
  await append(athleteUserId, RECORDED, { stand_down_id: `stand_down_${crypto.randomUUID().replace(/-/gu, "")}`, ...standDown, schema_version: "stand_down_v1" });
  return describeStandDown(athleteUserId);
}

// End the active stand-down early: only once a medical professional has
// cleared the athlete to train.
export async function endStandDown(athleteUserId: string, input: unknown, endedBy: "athlete" | "coach" = "athlete"): Promise<Readonly<Json>> {
  if (!isRecord(input) || input.cleared_by_medical_professional !== true) {
    throw new StandDownError("stand_down_clearance_required", 422, { cleared_by_medical_professional: "Confirm a medical professional has cleared you to train." });
  }
  const active = await activeStandDown(athleteUserId);
  if (!active) throw new StandDownError("stand_down_not_active", 404);
  await append(athleteUserId, ENDED, { stand_down_id: active.stand_down_id, ended_by: endedBy, cleared_by_medical_professional: true, schema_version: "stand_down_v1" });
  return describeStandDown(athleteUserId);
}

async function requireCoach(coachUserId: string, athleteUserId: string) {
  try { await requireCoachAthleteAccess(coachUserId, athleteUserId); }
  catch { throw new StandDownError("relationship_access_denied", 403); }
}

export async function describeStandDownForCoach(coachUserId: string, athleteUserId: string) {
  await requireCoach(coachUserId, athleteUserId);
  return describeStandDown(athleteUserId);
}
export async function recordStandDownForCoach(coachUserId: string, athleteUserId: string, input: unknown) {
  await requireCoach(coachUserId, athleteUserId);
  return recordStandDown(athleteUserId, input, "coach");
}
export async function endStandDownForCoach(coachUserId: string, athleteUserId: string, input: unknown) {
  await requireCoach(coachUserId, athleteUserId);
  return endStandDown(athleteUserId, input, "coach");
}
