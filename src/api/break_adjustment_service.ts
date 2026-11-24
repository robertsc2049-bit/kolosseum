// DEV NOTE: API boundary surface. "Adjust for breaks": a lighter first week
// back after 10+ days without a session, only where someone chose it - the
// coach on their programme, or a self-coached athlete for their own training.
// Every change of either tick is logged as an account event (who, what, when),
// kept with the account, so the GDPR export and erasure cover it.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { adjustsForReturn, breakAdjustmentOn, type BreakAdjustmentChoice } from "./break_adjustment.js";
import type { Reentry } from "./training_cycle.js";

type Json = Record<string, unknown>;

const OWN_EVENT = "break_adjustment_set";
const PROGRAMME_EVENT = "programme_break_adjustment_set";

export class BreakAdjustmentError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

async function append(userId: string, type: string, payload: Json): Promise<void> {
  await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, now())`,
    [`account_event_${crypto.randomUUID().replace(/-/gu, "")}`, userId, type, JSON.stringify(payload)]
  );
}

async function ownChoices(userId: string): Promise<{ choices: BreakAdjustmentChoice[]; createdAt: string }> {
  const [events, account] = await Promise.all([
    pool.query(`SELECT event_payload, occurred_at FROM product_account_events WHERE user_id = $1 AND event_type = $2 ORDER BY occurred_at, event_id`, [userId, OWN_EVENT]),
    pool.query("SELECT created_at FROM product_accounts WHERE user_id = $1", [userId])
  ]);
  return {
    choices: (events.rows ?? []).map((row: { event_payload?: Json; occurred_at: Date | string }) => ({ enabled: row.event_payload?.enabled === true, at: new Date(row.occurred_at).toISOString() })),
    createdAt: account.rows?.[0]?.created_at ? new Date(account.rows[0].created_at).toISOString() : new Date().toISOString()
  };
}

// The athlete's tick, and when they last changed it (null: never).
export async function describeBreakAdjustment(userId: string): Promise<Readonly<Json>> {
  const { choices, createdAt } = await ownChoices(userId);
  return Object.freeze({ enabled: breakAdjustmentOn(choices, createdAt, new Date().toISOString()), changed_at: choices.at(-1)?.at ?? null });
}

export async function setBreakAdjustment(userId: string, input: unknown): Promise<Readonly<Json>> {
  const enabled = input && typeof input === "object" ? (input as Json).enabled : undefined;
  if (typeof enabled !== "boolean") throw new BreakAdjustmentError("break_adjustment_invalid", 422, { enabled: "Choose on or off." });
  const before = await describeBreakAdjustment(userId);
  if (before.enabled !== enabled) await append(userId, OWN_EVENT, { enabled, previous: before.enabled, set_by: "athlete", schema_version: "break_adjustment_v1" });
  return describeBreakAdjustment(userId);
}

// A self-coached athlete's return from a break, only where their tick covers it.
export async function ownReentry(userId: string, reentry: Reentry | null, now: Date): Promise<Reentry | null> {
  if (!reentry) return null;
  const { choices, createdAt } = await ownChoices(userId);
  return adjustsForReturn(reentry, choices, createdAt, now) ? reentry : null;
}

// A coach turning it on or off on a programme (or starting one with it on).
export async function logProgrammeBreakAdjustment(coachUserId: string, template: Readonly<{ template_id: string; template_family_id: string; template_version: number }>, enabled: boolean, previous: boolean | null): Promise<void> {
  if (previous === null ? !enabled : previous === enabled) return;
  await append(coachUserId, PROGRAMME_EVENT, { ...template, enabled, previous, set_by: "coach", schema_version: "break_adjustment_v1" });
}
