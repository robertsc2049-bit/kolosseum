// DEV NOTE: API boundary surface. Stores an athlete's daily readiness
// check-in (their own account events) and applies today's to a self-directed
// session about to be created - see readiness.ts for the rules. Days are UTC
// calendar days.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { applyReadiness, isLowReadiness, validateReadiness, type ReadinessCheckIn } from "./readiness.js";

type Json = Record<string, unknown>;

const READINESS_EVENT = "athlete_readiness_check_in";
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
  return payload ? { date, sleep: Number(payload.sleep), soreness: Number(payload.soreness), stress: Number(payload.stress) } : null;
}

export async function describeReadiness(userId: string): Promise<Readonly<Json>> {
  const check = await todaysReadiness(userId);
  return Object.freeze({ today: check, low: check ? isLowReadiness(check) : false });
}

export async function saveReadiness(userId: string, input: unknown): Promise<Readonly<Json>> {
  const validated = validateReadiness(input, today());
  if (!validated.ok) throw new ReadinessError("readiness_invalid", 422, validated.field_errors);
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, READINESS_EVENT, JSON.stringify({ ...validated.check, schema_version: "readiness_v1" })]
  );
  return describeReadiness(userId);
}

export async function applyTodaysReadiness(userId: string, exercises: Json[]): Promise<Json[]> {
  return applyReadiness(exercises, await todaysReadiness(userId));
}
