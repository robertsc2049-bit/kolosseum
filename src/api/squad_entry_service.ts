// DEV NOTE: Getting a squad's data in, the way elite staff do it - one
// screen for everyone, not one athlete at a time:
// - a squad session: the team practice or match each athlete did, with each
//   one's effort (0-10), recorded as their own "other training" (marked as
//   recorded by the coach);
// - a test day: one test, many athletes' results;
// - GPS / heart-rate imports: rows from a GPS or HR system's export, already
//   matched to athletes on the coach's screen, kept as each athlete's
//   external load (distance, high-speed running, sprint, player load, HR).
// Who can record for whom: a coach for their own athletes; a team's head
// coach also for the team's athletes (sessions and GPS - load data). Tests
// stay with each athlete's own coach. Every entry is idempotent.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { addOtherTraining, TrainingLogInputError } from "./athlete_training_log_service.js";
import { recordTestResult, AthleteTestInputError } from "./athlete_tests_service.js";
import { forgetRecentTeamViews, headCoachTeamMemberCoach } from "./team_analysis_service.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const short = (value: string) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
const EXTERNAL_EVENT = "external_load_session";
const MAX_ROWS = 500;

export class SquadEntryError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SquadEntryError";
    this.status = status;
  }
}

function requestId(body: Json): string {
  const id = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,60}$/u.test(id)) throw new SquadEntryError("squad_entry_client_request_id_invalid");
  return id;
}

// May this coach record load for this athlete? Their own, or - as a team's
// head coach - the team's.
async function canRecordLoadFor(coachUserId: string, athleteUserId: string): Promise<boolean> {
  try {
    await requireCoachAthleteAccess(coachUserId, athleteUserId);
    return true;
  }
  catch {
    return (await headCoachTeamMemberCoach(coachUserId, athleteUserId)) !== null;
  }
}

// ---------- a squad session ----------
export async function recordSquadSession(coachUserId: string, input: unknown): Promise<Json> {
  const body = isRecord(input) ? input : {};
  const id = requestId(body);
  const entries = Array.isArray(body.entries) ? body.entries.filter(isRecord) : [];
  if (!entries.length || entries.length > 100) throw new SquadEntryError("squad_entry_athletes_invalid");
  const added: string[] = [];
  const skipped: Json[] = [];
  for (const entry of entries) {
    const athleteUserId = text(entry.athlete_user_id);
    if (!athleteUserId || !(await canRecordLoadFor(coachUserId, athleteUserId))) { skipped.push({ athlete_user_id: athleteUserId, reason: "not_your_athlete" }); continue; }
    try {
      const result = await addOtherTraining(athleteUserId, {
        date: body.date, kind: body.kind, note: body.note,
        minutes: entry.minutes ?? body.minutes, srpe: entry.srpe,
        client_request_id: `sq_${id}_${short(athleteUserId)}`
      }, coachUserId);
      if (result.added) added.push(athleteUserId);
    }
    catch (error) {
      if (error instanceof TrainingLogInputError) { skipped.push({ athlete_user_id: athleteUserId, reason: error.message }); continue; }
      throw error;
    }
  }
  forgetRecentTeamViews();
  return { ok: true, added: added.length, skipped };
}

// ---------- a test day ----------
export async function recordTestDay(coachUserId: string, input: unknown): Promise<Json> {
  const body = isRecord(input) ? input : {};
  const id = requestId(body);
  const entries = Array.isArray(body.entries) ? body.entries.filter(isRecord) : [];
  if (!entries.length || entries.length > 100) throw new SquadEntryError("squad_entry_athletes_invalid");
  let added = 0;
  const skipped: Json[] = [];
  for (const entry of entries) {
    const athleteUserId = text(entry.athlete_user_id);
    if (num(entry.value) === null) continue;
    try {
      const result = await recordTestResult(coachUserId, athleteUserId, { test_id: body.test_id, date: body.date, value: entry.value, client_request_id: `td_${id}_${short(athleteUserId)}` });
      if (result.added) added += 1;
    }
    catch (error) {
      if (error instanceof AthleteTestInputError) { skipped.push({ athlete_user_id: athleteUserId, reason: error.message }); continue; }
      skipped.push({ athlete_user_id: athleteUserId, reason: "not_your_athlete" });
    }
  }
  forgetRecentTeamViews();
  return { ok: true, added, skipped };
}

// ---------- GPS / heart-rate imports ----------
const RANGES: Readonly<Record<string, readonly [number, number]>> = {
  duration_min: [1, 300], total_distance_m: [0, 30_000], hsr_m: [0, 10_000], sprint_m: [0, 5_000],
  player_load: [0, 3_000], avg_hr: [30, 230], max_hr: [30, 240]
};

export async function importExternalLoad(coachUserId: string, input: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const body = isRecord(input) ? input : {};
  requestId(body);
  const source = text(body.source).slice(0, 40) || "import";
  const rows = Array.isArray(body.rows) ? body.rows.filter(isRecord) : [];
  if (!rows.length || rows.length > MAX_ROWS) throw new SquadEntryError("external_load_rows_invalid");
  const twoYearsAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 731 * 86_400_000).toISOString().slice(0, 10);
  const allowed = new Map<string, boolean>();
  let added = 0;
  const skipped: Json[] = [];
  for (const [index, row] of rows.entries()) {
    const athleteUserId = text(row.athlete_user_id);
    const date = text(row.date);
    if (!allowed.has(athleteUserId)) allowed.set(athleteUserId, Boolean(athleteUserId) && (await canRecordLoadFor(coachUserId, athleteUserId)));
    if (!allowed.get(athleteUserId)) { skipped.push({ row: index, reason: "not_your_athlete" }); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > today || date < twoYearsAgo) { skipped.push({ row: index, reason: "date_invalid" }); continue; }
    const values: Json = {};
    let bad = false;
    for (const [key, [low, high]] of Object.entries(RANGES)) {
      const value = num(row[key]);
      if (value === null) continue;
      if (value < low || value > high) { bad = true; break; }
      values[key] = Math.round(value * 10) / 10;
    }
    if (bad || !Object.keys(values).length) { skipped.push({ row: index, reason: "values_invalid" }); continue; }
    // The same session from the same source is imported once.
    const id = `xl_${short(`${athleteUserId}|${date}|${source}|${JSON.stringify(values)}`)}${short(source)}`;
    const inserted = await pool.query(
      "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
      [id, athleteUserId, EXTERNAL_EVENT, JSON.stringify({ id, date, source, ...values, imported_by: coachUserId })]
    );
    if (inserted.rowCount) added += 1;
  }
  forgetRecentTeamViews();
  return { ok: true, added, skipped, rows: rows.length };
}

