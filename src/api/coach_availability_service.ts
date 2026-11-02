// DEV NOTE: Check-in slots. A coach sets the hours they're free for check-in
// calls - every week on a weekday, or on one date - split into calls of a
// set length, each block with its own call method (WhatsApp, Teams or in
// person), and blocks out days off. Times are the coach's local time in
// their time zone, so 18:00 stays 18:00 for them across the clocks
// changing. An athlete the coach coaches books an open slot straight away
// (coach_checkin_service.ts holds the call itself, booked_by 'athlete'):
// at least 12 hours ahead, at most 4 weeks, one upcoming self-booked call
// per coach at a time. A slot is open when no other call of the coach's
// overlaps it.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { coachBusinessName } from "./coach_branding_service.js";
import { CoachCheckinError, assertCoachesAthlete, listAthleteCheckins } from "./coach_checkin_service.js";
import { athletePaymentDue } from "./package_membership_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export const BOOKING_NOTICE_HOURS = 12;
export const BOOKING_WINDOW_DAYS = 28;
const DAY_MS = 86400000;
const METHODS = new Set(["whatsapp", "teams", "in_person"]);
const SLOT_LENGTHS = new Set([15, 30, 45, 60]);
const MAX_BLOCKS = 30;
const MAX_DAYS_OFF = 30;

// --- Time zones ------------------------------------------------------------

export function validTimeZone(value: unknown): string | null {
  const zone = text(value);
  if (!zone || zone.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  }
  catch {
    return null;
  }
}

// How far ahead of UTC a time zone is at an instant, in milliseconds.
function zoneOffsetMs(instant: number, zone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// A local date ("2026-11-10") and minute of the day in a time zone, as an
// instant - right across the clocks changing.
export function zonedInstant(date: string, minute: number, zone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  let instant = wall - zoneOffsetMs(wall, zone);
  instant = wall - zoneOffsetMs(instant, zone);
  return new Date(instant);
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

function parseDate(value: unknown): string | null {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || isoDate(Date.parse(`${date}T00:00:00Z`)) !== date) return null;
  return date;
}

// "18:30" -> 1110; "24:00" is the end of the day.
function parseMinute(value: unknown): number | null {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(text(value));
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minute <= 1440 ? minute : null;
}

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

// --- The coach's availability -----------------------------------------------

function blockView(row: Json): Json {
  return {
    block_id: String(row.block_id),
    repeats_weekly: row.repeats_weekly === true,
    weekday: row.weekday === null || row.weekday === undefined ? null : Number(row.weekday),
    on_date: row.on_date_text ? String(row.on_date_text) : null,
    start: clock(Number(row.start_minute)),
    end: clock(Number(row.end_minute)),
    slot_minutes: Number(row.slot_minutes),
    call_method: String(row.call_method),
    time_zone: String(row.time_zone)
  };
}

export async function getCoachAvailability(coachUserId: string): Promise<Json> {
  const [blocks, daysOff] = await Promise.all([
    pool.query(`SELECT *, to_char(on_date, 'YYYY-MM-DD') AS on_date_text FROM product_coach_availability_blocks WHERE coach_user_id = $1 ORDER BY repeats_weekly DESC, weekday, on_date, start_minute`, [coachUserId]),
    pool.query(`SELECT day_off_id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date, note FROM product_coach_availability_days_off WHERE coach_user_id = $1 AND to_date >= current_date - 1 ORDER BY from_date`, [coachUserId])
  ]);
  return {
    ok: true,
    blocks: blocks.rows.map(blockView),
    days_off: daysOff.rows.map((row) => ({ day_off_id: String(row.day_off_id), from_date: String(row.from_date), to_date: String(row.to_date), note: text(row.note) || null })),
    booking_notice_hours: BOOKING_NOTICE_HOURS,
    booking_window_days: BOOKING_WINDOW_DAYS
  };
}

export async function addAvailabilityBlock(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachCheckinError("availability_invalid", 422);
  const errors: Json = {};
  const repeatsWeekly = input.repeats_weekly !== false;
  const weekday = Number(input.weekday);
  const onDate = parseDate(input.on_date);
  if (repeatsWeekly && !(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) errors.weekday = "Choose a day of the week.";
  if (!repeatsWeekly && !onDate) errors.on_date = "Choose a date.";
  if (!repeatsWeekly && onDate && Date.parse(`${onDate}T23:59:59Z`) < Date.now() - DAY_MS) errors.on_date = "Choose a date that hasn't passed.";
  const start = parseMinute(input.start);
  const end = parseMinute(input.end);
  const slot = Number(input.slot_minutes ?? 30);
  if (start === null) errors.start = "A start time like 18:00.";
  if (end === null) errors.end = "An end time like 20:00.";
  if (!SLOT_LENGTHS.has(slot)) errors.slot_minutes = "15, 30, 45 or 60 minutes.";
  if (start !== null && end !== null && SLOT_LENGTHS.has(slot) && end - start < slot) errors.end = "The end has to leave room for at least one call.";
  const method = text(input.call_method);
  if (!METHODS.has(method)) errors.call_method = "WhatsApp, Teams or in person.";
  const zone = validTimeZone(input.time_zone);
  if (!zone) errors.time_zone = "Unknown time zone.";
  if (Object.keys(errors).length) throw new CoachCheckinError("availability_invalid", 422, errors);
  const count = await pool.query(`SELECT count(*)::int AS n FROM product_coach_availability_blocks WHERE coach_user_id = $1`, [coachUserId]);
  if (Number(count.rows[0]?.n) >= MAX_BLOCKS) throw new CoachCheckinError("availability_limit_reached", 409);
  await pool.query(
    `INSERT INTO product_coach_availability_blocks (block_id, coach_user_id, repeats_weekly, weekday, on_date, start_minute, end_minute, slot_minutes, call_method, time_zone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [`avb_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, repeatsWeekly, repeatsWeekly ? weekday : null, repeatsWeekly ? null : onDate, start, end, slot, method, zone]
  );
  return getCoachAvailability(coachUserId);
}

export async function removeAvailabilityBlock(coachUserId: string, blockId: string): Promise<Json> {
  const removed = await pool.query(`DELETE FROM product_coach_availability_blocks WHERE block_id = $1 AND coach_user_id = $2 RETURNING block_id`, [blockId, coachUserId]);
  if (!removed.rows.length) throw new CoachCheckinError("availability_not_found", 404);
  return getCoachAvailability(coachUserId);
}

export async function addDayOff(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachCheckinError("availability_invalid", 422);
  const from = parseDate(input.from_date);
  const to = parseDate(input.to_date ?? input.from_date);
  const note = text(input.note);
  const errors: Json = {};
  if (!from) errors.from_date = "Choose the first day off.";
  if (!to || (from && to < from)) errors.to_date = "Choose the last day off (on or after the first).";
  if (note.length > 80) errors.note = "Up to 80 characters.";
  if (Object.keys(errors).length) throw new CoachCheckinError("availability_invalid", 422, errors);
  const count = await pool.query(`SELECT count(*)::int AS n FROM product_coach_availability_days_off WHERE coach_user_id = $1 AND to_date >= current_date`, [coachUserId]);
  if (Number(count.rows[0]?.n) >= MAX_DAYS_OFF) throw new CoachCheckinError("availability_limit_reached", 409);
  await pool.query(
    `INSERT INTO product_coach_availability_days_off (day_off_id, coach_user_id, from_date, to_date, note) VALUES ($1, $2, $3, $4, $5)`,
    [`doff_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, from, to, note || null]
  );
  return getCoachAvailability(coachUserId);
}

export async function removeDayOff(coachUserId: string, dayOffId: string): Promise<Json> {
  const removed = await pool.query(`DELETE FROM product_coach_availability_days_off WHERE day_off_id = $1 AND coach_user_id = $2 RETURNING day_off_id`, [dayOffId, coachUserId]);
  if (!removed.rows.length) throw new CoachCheckinError("availability_not_found", 404);
  return getCoachAvailability(coachUserId);
}

// --- Open slots ----------------------------------------------------------------

type Slot = { starts_at: string; duration_minutes: number; call_method: string };
type QueryClient = { query: typeof pool.query };

// The coach's open slots between 12 hours and 4 weeks from now: their hours
// on each day (in their own time zone), less days off and anything that
// overlaps a call they already have.
export async function openSlots(coachUserId: string, client: QueryClient = pool, now = Date.now()): Promise<Slot[]> {
  const from = now + BOOKING_NOTICE_HOURS * 3600000;
  const until = now + BOOKING_WINDOW_DAYS * DAY_MS;
  const [blocks, daysOff, calls] = await Promise.all([
    client.query(`SELECT *, to_char(on_date, 'YYYY-MM-DD') AS on_date_text FROM product_coach_availability_blocks WHERE coach_user_id = $1 ORDER BY start_minute`, [coachUserId]),
    client.query(`SELECT to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date FROM product_coach_availability_days_off WHERE coach_user_id = $1`, [coachUserId]),
    client.query(
      `SELECT starts_at, duration_minutes FROM product_coach_checkins
       WHERE coach_user_id = $1 AND checkin_status <> 'cancelled' AND starts_at < $3 AND starts_at > $2`,
      [coachUserId, new Date(from - DAY_MS), new Date(until + DAY_MS)]
    )
  ]);
  const busy = calls.rows.map((row) => {
    const start = new Date(String(row.starts_at)).getTime();
    return [start, start + Number(row.duration_minutes) * 60000];
  });
  const off = daysOff.rows.map((row) => [String(row.from_date), String(row.to_date)]);
  const slots = new Map<number, Slot>();
  for (let day = -1; day <= BOOKING_WINDOW_DAYS + 1; day += 1) {
    const date = isoDate(now + day * DAY_MS);
    for (const block of blocks.rows) {
      const zone = String(block.time_zone);
      if (block.repeats_weekly ? Number(block.weekday) !== weekdayOf(date) : String(block.on_date_text) !== date) continue;
      if (off.some(([first, last]) => date >= first && date <= last)) continue;
      const length = Number(block.slot_minutes);
      for (let minute = Number(block.start_minute); minute + length <= Number(block.end_minute); minute += length) {
        const start = zonedInstant(date, minute, zone).getTime();
        const end = start + length * 60000;
        if (start < from || start > until || slots.has(start)) continue;
        if (busy.some(([busyStart, busyEnd]) => busyStart < end && busyEnd > start)) continue;
        slots.set(start, { starts_at: new Date(start).toISOString(), duration_minutes: length, call_method: String(block.call_method) });
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

// The athlete's coaches who have open slots, and whether they can book one
// (one upcoming call they booked themselves per coach).
export async function athleteBookableSlots(athleteUserId: string): Promise<Json> {
  const coaches = await pool.query(
    `SELECT DISTINCT ON (r.actor_user_id) r.actor_user_id AS coach_user_id, r.record_payload->>'relationship_state' AS state, a.display_name
     FROM beta_product_records r JOIN product_accounts a ON a.user_id = r.actor_user_id
     WHERE r.record_type = 'beta17_coach_relationship' AND r.subject_user_id = $1
     ORDER BY r.actor_user_id, r.effective_at DESC, r.created_at DESC`,
    [athleteUserId]
  );
  const out = [];
  for (const row of coaches.rows) {
    if (text(row.state) !== "accepted") continue;
    const coachUserId = String(row.coach_user_id);
    // Payment due on their package: no booking until the coach records it.
    const due = await athletePaymentDue(coachUserId, athleteUserId);
    const [slots, upcoming] = await Promise.all([
      due ? Promise.resolve([]) : openSlots(coachUserId),
      pool.query(
        `SELECT starts_at FROM product_coach_checkins WHERE coach_user_id = $1 AND athlete_user_id = $2 AND booked_by = 'athlete' AND checkin_status <> 'cancelled' AND starts_at > now() ORDER BY starts_at LIMIT 1`,
        [coachUserId, athleteUserId]
      )
    ]);
    if (!slots.length && !upcoming.rows.length && !due) continue;
    out.push({
      coach_user_id: coachUserId,
      coach_display_name: text(row.display_name) || "Your coach",
      coach_business_name: await coachBusinessName(coachUserId),
      booked_upcoming_at: upcoming.rows.length ? new Date(String(upcoming.rows[0].starts_at)).toISOString() : null,
      payment_due: due,
      slots
    });
  }
  return { ok: true, coaches: out, booking_notice_hours: BOOKING_NOTICE_HOURS, booking_window_days: BOOKING_WINDOW_DAYS };
}

// Book an open slot: checked again under a per-coach lock, so two athletes
// can't take the same slot.
export async function bookSlot(athleteUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachCheckinError("booking_invalid", 422);
  const coachUserId = text(input.coach_user_id);
  const startsAt = new Date(text(input.starts_at));
  const note = text(input.note);
  if (note.length > 300) throw new CoachCheckinError("booking_invalid", 422, { note: "Up to 300 characters." });
  if (Number.isNaN(startsAt.getTime())) throw new CoachCheckinError("booking_invalid", 422, { starts_at: "Choose a slot." });
  await assertCoachesAthlete(coachUserId, athleteUserId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`checkin_slots:${coachUserId}`]);
    const already = await client.query(
      `SELECT 1 FROM product_coach_checkins WHERE coach_user_id = $1 AND athlete_user_id = $2 AND booked_by = 'athlete' AND checkin_status <> 'cancelled' AND starts_at > now()`,
      [coachUserId, athleteUserId]
    );
    if (already.rows.length) throw new CoachCheckinError("booking_one_at_a_time", 409);
    if (await athletePaymentDue(coachUserId, athleteUserId, client)) throw new CoachCheckinError("booking_payment_due", 409);
    const slot = (await openSlots(coachUserId, client)).find((open) => open.starts_at === startsAt.toISOString());
    if (!slot) throw new CoachCheckinError("booking_slot_taken", 409);
    await client.query(
      `INSERT INTO product_coach_checkins (checkin_id, coach_user_id, athlete_user_id, starts_at, duration_minutes, call_method, note, checkin_status, booked_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', 'athlete')`,
      [`chk_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, athleteUserId, startsAt, slot.duration_minutes, slot.call_method, note || null]
    );
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
  return listAthleteCheckins(athleteUserId);
}

// The athlete cancels a call they booked themselves; the slot opens again.
export async function cancelOwnBooking(athleteUserId: string, checkinId: string): Promise<Json> {
  const updated = await pool.query(
    `UPDATE product_coach_checkins SET checkin_status = 'cancelled', cancelled_by = 'athlete', cancelled_at = now(), updated_at = now()
     WHERE checkin_id = $1 AND athlete_user_id = $2 AND booked_by = 'athlete' AND checkin_status <> 'cancelled' AND starts_at > now()
     RETURNING checkin_id`,
    [checkinId, athleteUserId]
  );
  if (!updated.rows.length) throw new CoachCheckinError("checkin_not_found", 404);
  return listAthleteCheckins(athleteUserId);
}
