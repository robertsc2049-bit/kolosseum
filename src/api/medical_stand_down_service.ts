// DEV NOTE: API boundary surface. Medical stand-down: after a head injury
// (concussion) or any medical instruction not to train, the athlete or their
// coach records a stand-down with the date training may resume, taken from
// the athlete's medical professional. While it is in force no session is
// created or started - the product never overrides a stand-down, never gives
// medical advice and prescribes nothing about the return.
//
// - A head injury ends only when a medical professional has cleared the
//   athlete (the athlete, their coach or the team's medical lead confirms it);
//   its date passing ends nothing. Another medical reason also ends on its
//   "no training until" date (stand_down_rules.ts).
// - Records facts only: a reason category (head injury / other medical), who
//   recorded it and the dates. No symptoms, diagnosis or notes are stored.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { medicalLeadTeamMemberCoach } from "./team_analysis_service.js";
import { standDownInForce } from "./stand_down_rules.js";

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
  schema_version?: string;
};

// Every stand-down in force (recorded, not ended, see stand_down_rules.ts),
// oldest first.
async function standDownsInForce(athleteUserId: string, onDate: string): Promise<StandDown[]> {
  const result = await pool.query(
    `SELECT event_type, event_payload, occurred_at FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3) ORDER BY occurred_at, event_id`,
    [athleteUserId, RECORDED, ENDED]
  );
  const ended = new Set((result.rows ?? []).filter((r: Json) => r.event_type === ENDED).map((r: Json) => text((r.event_payload as Json)?.stand_down_id)));
  const active = (result.rows ?? [])
    .filter((r: Json) => r.event_type === RECORDED && isRecord(r.event_payload))
    .map((r: Json) => ({ ...(r.event_payload as Json), recorded_at: new Date(String(r.occurred_at)).toISOString() }) as unknown as StandDown)
    .filter((s: StandDown) => !ended.has(s.stand_down_id));
  if (!active.length) return [];
  const last = await pool.query("SELECT MAX(created_at) AS at FROM sessions WHERE beta_subject_user_id = $1", [athleteUserId]);
  const lastSessionDate = last.rows?.[0]?.at ? new Date(last.rows[0].at).toISOString().slice(0, 10) : null;
  return active.filter((s: StandDown) => standDownInForce(s, onDate, lastSessionDate));
}

// The athlete's stand-down in force, or null. One that only clearance ends
// comes before one that ends on its date.
export async function activeStandDown(athleteUserId: string, onDate = today()): Promise<StandDown | null> {
  const active = await standDownsInForce(athleteUserId, onDate);
  return active.filter((s) => s.reason === "head_injury").at(-1) ?? active.at(-1) ?? null;
}

// Movement pattern per exercise, from the exercise registry (read once).
let patterns: Map<string, string> | null = null;
export function exercisePatternOf(exerciseId: string): string | undefined {
  if (!patterns) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    patterns = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {})
      .filter(isRecord).map((e: Json) => [text(e.exercise_id), text(e.movement_pattern_id)] as [string, string]));
  }
  return patterns.get(exerciseId);
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
  await append(athleteUserId, RECORDED, { stand_down_id: `stand_down_${crypto.randomUUID().replace(/-/gu, "")}`, ...standDown, schema_version: "stand_down_v2" });
  return describeStandDown(athleteUserId);
}

// End the stand-down: only once a medical professional has cleared the athlete
// to train. Clearance covers every stand-down in force, so one recorded again
// with a later date doesn't leave the earlier one behind.
export async function endStandDown(athleteUserId: string, input: unknown, endedBy: "athlete" | "coach" = "athlete"): Promise<Readonly<Json>> {
  if (!isRecord(input) || input.cleared_by_medical_professional !== true) {
    throw new StandDownError("stand_down_clearance_required", 422, { cleared_by_medical_professional: "Confirm a medical professional has cleared you to train." });
  }
  const active = await standDownsInForce(athleteUserId, today());
  if (!active.length) throw new StandDownError("stand_down_not_active", 404);
  for (const standDown of active) await append(athleteUserId, ENDED, { stand_down_id: standDown.stand_down_id, ended_by: endedBy, cleared_by_medical_professional: true, schema_version: "stand_down_v1" });
  return describeStandDown(athleteUserId);
}

// The athlete's own coach, or the medical lead of a team they're on.
async function requireCoach(coachUserId: string, athleteUserId: string) {
  try { await requireCoachAthleteAccess(coachUserId, athleteUserId); }
  catch {
    if ((await medicalLeadTeamMemberCoach(coachUserId, athleteUserId).catch(() => null)) !== null) return;
    throw new StandDownError("relationship_access_denied", 403);
  }
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
