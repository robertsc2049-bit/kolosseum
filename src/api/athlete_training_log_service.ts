// DEV NOTE: What an athlete tells us about their training load beyond the
// sets they log: how hard a whole gym session was and how long it took
// (session RPE, 0-10, and minutes - rated when they finish it), and training
// outside the app's sessions (team practice, matches, conditioning, another
// sport). Kept as the athlete's own account events (GDPR erasure covers
// product_account_events); the latest rating of a session wins, and other
// training is removed with a removal event rather than a delete, so the
// history stays honest. Analysis turns both into measured load.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { OTHER_TRAINING_KINDS, type CalendarMarker, type OtherTraining, type SessionLoadReport } from "./coach_analysis_metrics.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

const SESSION_LOAD_EVENT = "session_load_report";
const OTHER_TRAINING_EVENT = "other_training_session";
const OTHER_TRAINING_REMOVED_EVENT = "other_training_removed";
const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

export class TrainingLogInputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TrainingLogInputError";
    this.status = status;
  }
}

// Effort 0-10 in half points (CR10); minutes 1-300.
function effort(value: unknown): number {
  const n = num(value);
  if (n === null || n < 0 || n > 10 || Math.round(n * 2) !== n * 2) throw new TrainingLogInputError("training_log_effort_invalid");
  return n;
}
function minutes(value: unknown): number {
  const n = num(value);
  if (n === null || !Number.isInteger(n) || n < 1 || n > 300) throw new TrainingLogInputError("training_log_minutes_invalid");
  return n;
}

// ---------- a gym session, rated when it's finished ----------
export async function recordSessionLoad(athleteUserId: string, input: unknown): Promise<Json> {
  const body = isRecord(input) ? input : {};
  const sessionId = text(body.session_id);
  if (!sessionId) throw new TrainingLogInputError("training_log_session_required");
  const srpe = effort(body.srpe);
  const mins = minutes(body.minutes);
  const session = await pool.query("SELECT status FROM sessions WHERE session_id = $1 AND beta_subject_user_id = $2", [sessionId, athleteUserId]);
  if (!session.rows.length) throw new TrainingLogInputError("training_log_session_not_found", 404);
  if (!["completed", "partial"].includes(text(session.rows[0].status))) throw new TrainingLogInputError("training_log_session_not_finished", 409);
  const reportedAt = new Date().toISOString();
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb)",
    [`slr_${crypto.randomUUID().replaceAll("-", "")}`, athleteUserId, SESSION_LOAD_EVENT, JSON.stringify({ session_id: sessionId, srpe, minutes: mins, reported_at: reportedAt })]
  );
  return { ok: true, session_id: sessionId, srpe, minutes: mins, load: Math.round(srpe * mins) };
}

// The latest rating of each session (since a date, or for one session).
export async function loadSessionReports(athleteUserId: string, since: string): Promise<Record<string, SessionLoadReport>> {
  const result = await pool.query(
    `SELECT DISTINCT ON (event_payload->>'session_id') event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type = $2 AND occurred_at >= $3::date
     ORDER BY event_payload->>'session_id', occurred_at DESC, event_id DESC`,
    [athleteUserId, SESSION_LOAD_EVENT, daysAgo(since, 2)]
  );
  const out: Record<string, SessionLoadReport> = {};
  for (const row of result.rows) {
    const payload = isRecord(row.event_payload) ? row.event_payload : {};
    const srpe = num(payload.srpe);
    const mins = num(payload.minutes);
    if (text(payload.session_id) && srpe !== null && mins !== null) out[text(payload.session_id)] = { srpe, minutes: mins };
  }
  return out;
}

export async function getSessionLoadReport(athleteUserId: string, sessionId: string): Promise<Json> {
  const result = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2 AND event_payload->>'session_id' = $3
     ORDER BY occurred_at DESC, event_id DESC LIMIT 1`,
    [athleteUserId, SESSION_LOAD_EVENT, sessionId]
  );
  const payload = isRecord(result.rows[0]?.event_payload) ? result.rows[0].event_payload : null;
  return { ok: true, report: payload ? { srpe: num(payload.srpe), minutes: num(payload.minutes) } : null };
}

// ---------- training outside the app's sessions ----------
export async function addOtherTraining(athleteUserId: string, input: unknown): Promise<Json> {
  const body = isRecord(input) ? input : {};
  const date = text(body.date);
  const now = today();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > now || date < daysAgo(now, 60)) throw new TrainingLogInputError("training_log_date_invalid");
  const kind = text(body.kind);
  if (!OTHER_TRAINING_KINDS[kind]) throw new TrainingLogInputError("training_log_kind_invalid");
  const note = text(body.note);
  if (note.length > 120) throw new TrainingLogInputError("training_log_note_too_long");
  const clientRequestId = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(clientRequestId)) throw new TrainingLogInputError("training_log_client_request_id_invalid");
  const entry = {
    id: `ot_${crypto.createHash("sha256").update(`${athleteUserId}|${clientRequestId}`).digest("hex").slice(0, 32)}`,
    date, kind, minutes: minutes(body.minutes), srpe: effort(body.srpe), ...(note ? { note } : {})
  };
  // The same request twice adds it once.
  const inserted = await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [entry.id, athleteUserId, OTHER_TRAINING_EVENT, JSON.stringify(entry)]
  );
  return { ok: true, entry, added: inserted.rowCount === 1 };
}

export async function removeOtherTraining(athleteUserId: string, input: unknown): Promise<Json> {
  const id = text(isRecord(input) ? input.id : "");
  const exists = await pool.query("SELECT 1 FROM product_account_events WHERE user_id = $1 AND event_type = $2 AND event_id = $3", [athleteUserId, OTHER_TRAINING_EVENT, id]);
  if (!id || !exists.rows.length) throw new TrainingLogInputError("training_log_entry_not_found", 404);
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [`${id}_removed`, athleteUserId, OTHER_TRAINING_REMOVED_EVENT, JSON.stringify({ id })]
  );
  return { ok: true, removed: id };
}

export async function listOtherTraining(athleteUserId: string, since = daysAgo(today(), 60)): Promise<OtherTraining[]> {
  const result = await pool.query(
    `SELECT event_type, event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3)
     ORDER BY occurred_at ASC, event_id ASC`,
    [athleteUserId, OTHER_TRAINING_EVENT, OTHER_TRAINING_REMOVED_EVENT]
  );
  const removed = new Set(result.rows.filter((row) => row.event_type === OTHER_TRAINING_REMOVED_EVENT).map((row) => text(isRecord(row.event_payload) ? row.event_payload.id : "")));
  return result.rows
    .filter((row) => row.event_type === OTHER_TRAINING_EVENT && isRecord(row.event_payload))
    .map((row) => row.event_payload as Json)
    .filter((entry) => !removed.has(text(entry.id)) && text(entry.date) >= since)
    .map((entry) => ({ id: text(entry.id), date: text(entry.date), kind: text(entry.kind), minutes: num(entry.minutes) ?? 0, srpe: num(entry.srpe) ?? 0, ...(text(entry.note) ? { note: text(entry.note) } : {}) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- dates worth marking on the charts ----------
// The athlete's competition and season dates from their training plan, and
// the deload and peak blocks of the programmes they've trained.
export function planMarkers(plan: Json | null): CalendarMarker[] {
  if (!plan) return [];
  const out: CalendarMarker[] = [];
  if (text(plan.competition_date)) out.push({ date: text(plan.competition_date), kind: "competition", label: "Competition" });
  if (text(plan.season_start_date)) out.push({ date: text(plan.season_start_date), kind: "season", label: "Season starts" });
  if (text(plan.season_end_date)) out.push({ date: text(plan.season_end_date), kind: "season", label: "Season ends" });
  return out;
}

export function blockMarkers(programmes: ReadonlyArray<{ sessions: ReadonlyArray<{ date: string; block_key: string; block_name: string; block_type?: string }> }>): CalendarMarker[] {
  const out: CalendarMarker[] = [];
  for (const programme of programmes) {
    let lastKey = "";
    for (const session of [...programme.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
      if (session.block_key === lastKey) continue;
      lastKey = session.block_key;
      if (session.block_type === "deload") out.push({ date: session.date, kind: "deload", label: `Deload: ${session.block_name}` });
      if (session.block_type === "peak") out.push({ date: session.date, kind: "peak", label: `Peak: ${session.block_name}` });
    }
  }
  return out;
}
