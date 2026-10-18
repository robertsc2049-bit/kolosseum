// DEV NOTE: The injury log. A coach - the athlete's own, or a team's head
// coach - records an injury (area, side, type, how and where it happened,
// whether it's stopped training), updates its status as the athlete comes
// back, and marks the return. Kept as the athlete's own account events
// (GDPR erasure covers product_account_events): recorded, updated and
// removed events, never edited, so the history stays honest. Facts only -
// no diagnosis, symptoms or notes - and it never stops sessions by itself:
// a medical stand-down does that (medical_stand_down_service.ts).
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { forgetRecentTeamViews, headCoachTeamMemberCoach } from "./team_analysis_service.js";
import { INJURY_AREAS, INJURY_CONTEXTS, INJURY_MECHANISMS, INJURY_SIDES, INJURY_STATUSES, INJURY_TYPES, type InjuryRecord } from "./injury_metrics.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const short = (value: string) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);

const RECORDED = "athlete_injury_recorded";
const UPDATED = "athlete_injury_updated";
const REMOVED = "athlete_injury_removed";

export class InjuryInputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "InjuryInputError";
    this.status = status;
  }
}

// The athlete's own coach, or the head coach of a team they're in.
export async function requireInjuryAccess(coachUserId: string, athleteUserId: string): Promise<void> {
  try {
    await requireCoachAthleteAccess(coachUserId, athleteUserId);
  }
  catch (error) {
    if ((await headCoachTeamMemberCoach(coachUserId, athleteUserId)) === null) throw error;
  }
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
function pick(body: Json, key: string, allowed: Readonly<Record<string, string>>, fallback?: string): string {
  const value = text(body[key]) || fallback || "";
  if (!(value in allowed)) throw new InjuryInputError(`injury_${key}_invalid`);
  return value;
}
function requestId(body: Json): string {
  const id = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(id)) throw new InjuryInputError("injury_client_request_id_invalid");
  return id;
}
function expectedReturn(body: Json, from: string, today: string): string | null {
  const value = text(body.expected_return);
  if (!value) return null;
  if (!isDate(value) || value < from || value > shift(today, 730)) throw new InjuryInputError("injury_expected_return_invalid");
  return value;
}

export async function recordInjury(coachUserId: string, athleteUserId: string, input: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  await requireInjuryAccess(coachUserId, athleteUserId);
  const body = isRecord(input) ? input : {};
  const occurredOn = text(body.occurred_on) || today;
  if (!isDate(occurredOn) || occurredOn > today || occurredOn < shift(today, -731)) throw new InjuryInputError("injury_occurred_on_invalid");
  const injury = {
    area: pick(body, "area", INJURY_AREAS), side: pick(body, "side", INJURY_SIDES, "none"), type: pick(body, "type", INJURY_TYPES),
    mechanism: pick(body, "mechanism", INJURY_MECHANISMS, "unknown"), context: pick(body, "context", INJURY_CONTEXTS, "training"),
    status: pick(body, "status", { out: "", modified: "" }, "out")
  };
  const id = `inj_${short(`${coachUserId}|${athleteUserId}|${requestId(body)}`)}`;
  const payload = { id, occurred_on: occurredOn, ...injury, expected_return: expectedReturn(body, occurredOn, today), recorded_by: coachUserId };
  const inserted = await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [id, athleteUserId, RECORDED, JSON.stringify(payload)]
  );
  forgetRecentTeamViews();
  return { ok: true, injury: payload, added: inserted.rowCount === 1 };
}

// A status change: out -> modified -> back to full training (with the date).
export async function updateInjury(coachUserId: string, athleteUserId: string, injuryId: string, input: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  await requireInjuryAccess(coachUserId, athleteUserId);
  const body = isRecord(input) ? input : {};
  const injury = (await loadInjuries(athleteUserId)).find((entry) => entry.id === injuryId);
  if (!injury) throw new InjuryInputError("injury_not_found", 404);
  if (injury.returned_on) throw new InjuryInputError("injury_already_returned", 409);
  const status = pick(body, "status", INJURY_STATUSES);
  const on = text(body.on) || today;
  const lastOn = injury.history.at(-1)?.on ?? injury.occurred_on;
  if (!isDate(on) || on > today || on < lastOn) throw new InjuryInputError("injury_update_date_invalid");
  const payload = { id: injuryId, status, on, expected_return: status === "returned" ? null : expectedReturn(body, injury.occurred_on, today), updated_by: coachUserId };
  const eventId = `${injuryId}_u_${short(requestId(body)).slice(0, 16)}`;
  const inserted = await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [eventId, athleteUserId, UPDATED, JSON.stringify(payload)]
  );
  forgetRecentTeamViews();
  return { ok: true, update: payload, added: inserted.rowCount === 1 };
}

export async function removeInjury(coachUserId: string, athleteUserId: string, injuryId: string): Promise<Json> {
  await requireInjuryAccess(coachUserId, athleteUserId);
  if (!(await loadInjuries(athleteUserId)).some((entry) => entry.id === injuryId)) throw new InjuryInputError("injury_not_found", 404);
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [`${injuryId}_removed`, athleteUserId, REMOVED, JSON.stringify({ id: injuryId, removed_by: coachUserId })]
  );
  forgetRecentTeamViews();
  return { ok: true, removed: injuryId };
}

// Every injury still standing, with its status history. No access check: callers check.
export async function loadInjuries(athleteUserId: string): Promise<InjuryRecord[]> {
  const result = await pool.query(
    "SELECT event_type, event_payload FROM product_account_events WHERE user_id = $1 AND event_type IN ($2, $3, $4) ORDER BY occurred_at ASC, event_id ASC",
    [athleteUserId, RECORDED, UPDATED, REMOVED]
  );
  const rows = result.rows.filter((row) => isRecord(row.event_payload));
  const removed = new Set(rows.filter((row) => row.event_type === REMOVED).map((row) => text(row.event_payload.id)));
  return rows
    .filter((row) => row.event_type === RECORDED && !removed.has(text(row.event_payload.id)))
    .map((row) => {
      const p = row.event_payload as Json;
      const id = text(p.id);
      const history: Array<{ on: string; status: string; expected_return?: string | null }> = [{ on: text(p.occurred_on), status: text(p.status) || "out", expected_return: text(p.expected_return) || null }];
      let returnedOn: string | null = null;
      for (const update of rows.filter((entry) => entry.event_type === UPDATED && text(entry.event_payload.id) === id).map((entry) => entry.event_payload as Json).sort((a, b) => text(a.on).localeCompare(text(b.on)))) {
        if (returnedOn) break;
        if (text(update.status) === "returned") returnedOn = text(update.on);
        else history.push({ on: text(update.on), status: text(update.status), expected_return: text(update.expected_return) || null });
      }
      return { id, occurred_on: text(p.occurred_on), area: text(p.area), side: text(p.side), type: text(p.type), mechanism: text(p.mechanism), context: text(p.context), history, returned_on: returnedOn };
    });
}
