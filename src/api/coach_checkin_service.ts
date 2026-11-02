// DEV NOTE: Check-in calls. A coach saves how their athletes reach them for
// a call - a WhatsApp number and/or a Teams meeting link (Kolosseum doesn't
// create meetings; it links to the coach's own WhatsApp number or Teams meeting) -
// and books check-ins with an athlete they coach: one-off, or a weekly or
// fortnightly run, one row per call sharing a series_id. The athlete
// confirms or asks to move it with a short message; the coach moves or
// cancels it. Only an athlete the coach currently coaches can be booked, and
// only that coach and athlete see a check-in.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { coachBusinessName } from "./coach_branding_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export class CoachCheckinError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "CoachCheckinError";
  }
}

const DURATIONS = new Set([15, 30, 45, 60]);
const METHODS = new Set(["whatsapp", "teams", "in_person"]);
const REPEATS: Record<string, number> = { none: 0, weekly: 7, fortnightly: 14 };
const MAX_OCCURRENCES = 12;
const DAY_MS = 86400000;

// --- How athletes reach the coach -----------------------------------------

// "+44 7700 900123" -> "447700900123": international format, country code
// first, as wa.me links need.
export function normaliseWhatsappNumber(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const digits = raw.replace(/^00/, "").replace(/[\s()+.-]/g, "");
  if (!/^[0-9]{7,15}$/.test(digits) || digits.startsWith("0")) {
    throw new CoachCheckinError("checkin_whatsapp_number_invalid", 422, { whatsapp_number: "Your number with country code, e.g. +44 7700 900123." });
  }
  return digits;
}

// A Teams meeting link the coach made in Teams (teams.microsoft.com or
// teams.live.com), nothing else.
export function normaliseTeamsLink(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  }
  catch {
    throw new CoachCheckinError("checkin_teams_link_invalid", 422, { teams_link: "Paste the meeting link from Teams." });
  }
  const host = url.hostname.toLowerCase();
  const teamsHost = host === "teams.microsoft.com" || host.endsWith(".teams.microsoft.com") || host === "teams.live.com";
  if (url.protocol !== "https:" || !teamsHost || raw.length > 500) {
    throw new CoachCheckinError("checkin_teams_link_invalid", 422, { teams_link: "Paste the meeting link from Teams." });
  }
  return url.toString();
}

async function callSettings(coachUserId: string): Promise<{ whatsapp_number: string | null; teams_link: string | null }> {
  const result = await pool.query(`SELECT whatsapp_number, teams_link FROM product_coach_call_settings WHERE coach_user_id = $1`, [coachUserId]);
  return { whatsapp_number: text(result.rows[0]?.whatsapp_number) || null, teams_link: text(result.rows[0]?.teams_link) || null };
}

export async function getCoachCallSettings(coachUserId: string): Promise<Json> {
  return { ok: true, call_settings: await callSettings(coachUserId) };
}

export async function saveCoachCallSettings(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachCheckinError("checkin_call_settings_invalid", 422);
  const whatsapp = normaliseWhatsappNumber(input.whatsapp_number);
  const teams = normaliseTeamsLink(input.teams_link);
  await pool.query(
    `INSERT INTO product_coach_call_settings (coach_user_id, whatsapp_number, teams_link)
     VALUES ($1, $2, $3)
     ON CONFLICT (coach_user_id) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number, teams_link = EXCLUDED.teams_link, updated_at = now()`,
    [coachUserId, whatsapp, teams]
  );
  return getCoachCallSettings(coachUserId);
}

// --- Booking ---------------------------------------------------------------

async function assertCoachesAthlete(coachUserId: string, athleteUserId: string): Promise<void> {
  const result = await pool.query(
    `SELECT record_payload->>'relationship_state' AS state FROM beta_product_records
     WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = $1 AND subject_user_id = $2
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [coachUserId, athleteUserId]
  );
  if (text(result.rows[0]?.state) !== "accepted") throw new CoachCheckinError("checkin_athlete_not_coached", 404);
}

function joinDetails(method: string, settings: { whatsapp_number: string | null; teams_link: string | null }): Json {
  if (method === "whatsapp" && settings.whatsapp_number) return { whatsapp_url: `https://wa.me/${settings.whatsapp_number}` };
  if (method === "teams" && settings.teams_link) return { teams_link: settings.teams_link };
  return {};
}

function checkinView(row: Json, settings: { whatsapp_number: string | null; teams_link: string | null }): Json {
  const method = String(row.call_method);
  return {
    checkin_id: String(row.checkin_id),
    series_id: row.series_id ? String(row.series_id) : null,
    starts_at: new Date(String(row.starts_at)).toISOString(),
    duration_minutes: Number(row.duration_minutes),
    call_method: method,
    note: text(row.note) || null,
    status: String(row.checkin_status),
    athlete_message: text(row.athlete_message) || null,
    ...joinDetails(method, settings)
  };
}

function parseStart(value: unknown): Date {
  const date = new Date(text(value));
  const now = Date.now();
  if (Number.isNaN(date.getTime()) || date.getTime() < now - 5 * 60000 || date.getTime() > now + 366 * DAY_MS) {
    throw new CoachCheckinError("checkin_start_invalid", 422, { starts_at: "Pick a time in the next year." });
  }
  return date;
}

export async function scheduleCheckin(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachCheckinError("checkin_invalid", 422);
  const athleteUserId = text(input.athlete_user_id);
  await assertCoachesAthlete(coachUserId, athleteUserId);
  const start = parseStart(input.starts_at);
  const duration = Number(input.duration_minutes ?? 30);
  if (!DURATIONS.has(duration)) throw new CoachCheckinError("checkin_invalid", 422, { duration_minutes: "15, 30, 45 or 60 minutes." });
  const method = text(input.call_method);
  if (!METHODS.has(method)) throw new CoachCheckinError("checkin_invalid", 422, { call_method: "WhatsApp, Teams or in person." });
  const settings = await callSettings(coachUserId);
  if (method === "whatsapp" && !settings.whatsapp_number) throw new CoachCheckinError("checkin_whatsapp_number_missing", 409);
  if (method === "teams" && !settings.teams_link) throw new CoachCheckinError("checkin_teams_link_missing", 409);
  const note = text(input.note);
  if (note.length > 300) throw new CoachCheckinError("checkin_invalid", 422, { note: "Up to 300 characters." });
  const repeat = text(input.repeat) || "none";
  if (!(repeat in REPEATS)) throw new CoachCheckinError("checkin_invalid", 422, { repeat: "Once, weekly or fortnightly." });
  const occurrences = repeat === "none" ? 1 : Number(input.occurrences ?? 6);
  if (repeat !== "none" && (!Number.isInteger(occurrences) || occurrences < 2 || occurrences > MAX_OCCURRENCES)) {
    throw new CoachCheckinError("checkin_invalid", 422, { occurrences: `2 to ${MAX_OCCURRENCES} calls.` });
  }
  const seriesId = repeat === "none" ? null : `cser_${crypto.randomUUID().replaceAll("-", "")}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let n = 0; n < occurrences; n += 1) {
      await client.query(
        `INSERT INTO product_coach_checkins (checkin_id, series_id, coach_user_id, athlete_user_id, starts_at, duration_minutes, call_method, note, checkin_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')`,
        [`chk_${crypto.randomUUID().replaceAll("-", "")}`, seriesId, coachUserId, athleteUserId, new Date(start.getTime() + n * REPEATS[repeat] * DAY_MS), duration, method, note || null]
      );
    }
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
  return listCoachCheckinsForAthlete(coachUserId, athleteUserId);
}

// The coach's upcoming check-ins with one athlete (from an hour ago on).
export async function listCoachCheckinsForAthlete(coachUserId: string, athleteUserIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  await assertCoachesAthlete(coachUserId, athleteUserId);
  const [rows, settings] = await Promise.all([
    pool.query(
      `SELECT * FROM product_coach_checkins
       WHERE coach_user_id = $1 AND athlete_user_id = $2 AND checkin_status <> 'cancelled' AND starts_at > now() - interval '1 hour'
       ORDER BY starts_at LIMIT 30`,
      [coachUserId, athleteUserId]
    ),
    callSettings(coachUserId)
  ]);
  return { ok: true, call_settings: settings, checkins: rows.rows.map((row) => checkinView(row, settings)) };
}

async function ownCheckin(coachUserId: string, checkinId: string): Promise<Json> {
  const result = await pool.query(
    `SELECT * FROM product_coach_checkins WHERE checkin_id = $1 AND coach_user_id = $2 AND checkin_status <> 'cancelled'`,
    [checkinId, coachUserId]
  );
  if (!result.rows.length) throw new CoachCheckinError("checkin_not_found", 404);
  return result.rows[0] as Json;
}

// Cancel one call, or this one and every later one in its run.
export async function cancelCheckin(coachUserId: string, checkinId: string, input: unknown): Promise<Json> {
  const row = await ownCheckin(coachUserId, checkinId);
  const wholeRun = isRecord(input) && input.and_later === true && row.series_id;
  await pool.query(
    wholeRun
      ? `UPDATE product_coach_checkins SET checkin_status = 'cancelled', cancelled_at = now(), updated_at = now()
         WHERE series_id = $1 AND coach_user_id = $2 AND starts_at >= $3 AND checkin_status <> 'cancelled'`
      : `UPDATE product_coach_checkins SET checkin_status = 'cancelled', cancelled_at = now(), updated_at = now()
         WHERE checkin_id = $1 AND coach_user_id = $2`,
    wholeRun ? [row.series_id, coachUserId, row.starts_at] : [checkinId, coachUserId]
  );
  return listCoachCheckinsForAthlete(coachUserId, row.athlete_user_id);
}

// The coach moves a call (often after the athlete asked): it's booked again
// and waits for the athlete to confirm.
export async function moveCheckin(coachUserId: string, checkinId: string, input: unknown): Promise<Json> {
  const row = await ownCheckin(coachUserId, checkinId);
  const start = parseStart(isRecord(input) ? input.starts_at : null);
  await pool.query(
    `UPDATE product_coach_checkins
     SET starts_at = $3, checkin_status = 'scheduled', athlete_message = NULL, responded_at = NULL, booked_at = now(), updated_at = now()
     WHERE checkin_id = $1 AND coach_user_id = $2`,
    [checkinId, coachUserId, start]
  );
  return listCoachCheckinsForAthlete(coachUserId, row.athlete_user_id);
}

// --- The athlete's side ----------------------------------------------------

export async function listAthleteCheckins(athleteUserId: string): Promise<Json> {
  const rows = await pool.query(
    `SELECT c.*, a.display_name AS coach_display_name FROM product_coach_checkins c
     JOIN product_accounts a ON a.user_id = c.coach_user_id
     WHERE c.athlete_user_id = $1 AND c.checkin_status <> 'cancelled' AND c.starts_at > now() - interval '1 hour'
       AND (SELECT p.record_payload->>'relationship_state' FROM beta_product_records p
            WHERE p.record_type = 'beta17_coach_relationship' AND p.actor_user_id = c.coach_user_id AND p.subject_user_id = c.athlete_user_id
            ORDER BY p.effective_at DESC, p.created_at DESC LIMIT 1) = 'accepted'
     ORDER BY c.starts_at LIMIT 20`,
    [athleteUserId]
  );
  const settingsByCoach = new Map<string, { whatsapp_number: string | null; teams_link: string | null }>();
  const businessByCoach = new Map<string, string | null>();
  const checkins = [];
  for (const row of rows.rows) {
    const coachUserId = String(row.coach_user_id);
    if (!settingsByCoach.has(coachUserId)) {
      settingsByCoach.set(coachUserId, await callSettings(coachUserId));
      businessByCoach.set(coachUserId, await coachBusinessName(coachUserId));
    }
    checkins.push({
      ...checkinView(row, settingsByCoach.get(coachUserId)!),
      coach_user_id: coachUserId,
      coach_display_name: text(row.coach_display_name) || "Your coach",
      coach_business_name: businessByCoach.get(coachUserId) ?? null
    });
  }
  return { ok: true, checkins };
}

// The athlete confirms the call, or asks to move it with a short message.
export async function respondToCheckin(athleteUserId: string, checkinId: string, input: unknown): Promise<Json> {
  const response = text(isRecord(input) ? input.response : "");
  if (response !== "confirm" && response !== "move") {
    throw new CoachCheckinError("checkin_response_invalid", 422, { response: "Confirm or ask to move." });
  }
  const message = text(isRecord(input) ? input.message : "");
  if (message.length > 300) throw new CoachCheckinError("checkin_response_invalid", 422, { message: "Up to 300 characters." });
  if (response === "move" && !message) throw new CoachCheckinError("checkin_response_invalid", 422, { message: "Say when suits you better." });
  const updated = await pool.query(
    `UPDATE product_coach_checkins c
     SET checkin_status = $3, athlete_message = $4, responded_at = now(), updated_at = now()
     WHERE c.checkin_id = $1 AND c.athlete_user_id = $2 AND c.checkin_status <> 'cancelled' AND c.starts_at > now() - interval '1 hour'
       AND (SELECT p.record_payload->>'relationship_state' FROM beta_product_records p
            WHERE p.record_type = 'beta17_coach_relationship' AND p.actor_user_id = c.coach_user_id AND p.subject_user_id = c.athlete_user_id
            ORDER BY p.effective_at DESC, p.created_at DESC LIMIT 1) = 'accepted'
     RETURNING checkin_id`,
    [checkinId, athleteUserId, response === "confirm" ? "confirmed" : "move_requested", response === "move" ? message : null]
  );
  if (!updated.rows.length) throw new CoachCheckinError("checkin_not_found", 404);
  return listAthleteCheckins(athleteUserId);
}
