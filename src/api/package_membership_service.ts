// DEV NOTE: Who is on which package. A coach puts an athlete they coach on
// one of their packages, or a gym package they deliver, and records payments
// made outside the app: a monthly or weekly package is paid up to a date
// (each payment covers the next period from the start date); a one-off
// package is paid in full. Past the paid-up date payment is due - the athlete
// can't book the coach's open slots (coach_availability_service.ts), and the
// coach can cancel every upcoming check-in and in-person session with them in
// one go. Both see what's included and what's been used this period: calls
// and in-person sessions are check-ins (coach_checkin_service.ts) split by
// call method. A gym never sees who is on its packages. Dates are UTC days.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { CoachCheckinError, assertCoachesAthlete } from "./coach_checkin_service.js";
import { packageView } from "./service_package_service.js";

type Json = Record<string, unknown>;
type QueryClient = { query: typeof pool.query };
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const DAY_MS = 86400000;

// --- Days and periods ------------------------------------------------------------

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const dayValue = (value: unknown): string | null => {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return null;
  return isoDay(new Date(`${raw}T00:00:00Z`)) === raw ? raw : null;
};
const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
export const today = () => isoDay(new Date());

// The start of the nth period after `startedOn`: weeks, or months (31 Jan,
// 28 Feb, 31 Mar...).
function periodStart(startedOn: string, billing: string, n: number): string {
  const [y, m, d] = startedOn.split("-").map(Number);
  if (billing === "weekly") return isoDay(new Date(Date.UTC(y, m - 1, d + 7 * n)));
  const lastDay = new Date(Date.UTC(y, m + n, 0)).getUTCDate();
  return isoDay(new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))));
}

// The billing period that holds `day` (end inclusive); one-off packages have
// one period from the start.
export function periodOf(startedOn: string, billing: string, day: string): { start: string; end: string | null } {
  if (billing === "one_off") return { start: startedOn, end: null };
  let n = 0;
  if (day > startedOn) {
    n = Math.max(0, Math.floor((Date.parse(day) - Date.parse(startedOn)) / ((billing === "weekly" ? 7 : 31) * DAY_MS)) - 1);
    while (periodStart(startedOn, billing, n + 1) <= day) n += 1;
  }
  return { start: periodStart(startedOn, billing, n), end: addDays(periodStart(startedOn, billing, n + 1), -1) };
}

// One more period paid: from the paid-up date (or the start) to the end of
// the next period.
export function nextPaidUntil(startedOn: string, billing: string, paidUntil: string | null): string {
  const from = paidUntil && paidUntil >= startedOn ? addDays(paidUntil, 1) : startedOn;
  return periodOf(startedOn, billing, from).end as string;
}

export function paymentDue(row: { started_on: string; paid_until: string | null; paid_in_full: boolean }, on = today()): boolean {
  if (row.paid_in_full || on < row.started_on) return false;
  return !row.paid_until || row.paid_until < on;
}

// How many unpaid periods have started by `on` (owed now), and how many more
// start in the following `days` days (coming up). One-off: the whole package.
export const OUTLOOK_DAYS = 30;
export function paymentOutlook(
  row: { billing: string; started_on: string; paid_until: string | null; paid_in_full: boolean },
  on = today(),
  days = OUTLOOK_DAYS
): { owed: number; upcoming: number } {
  const horizon = addDays(on, days);
  if (row.billing === "one_off") {
    if (row.paid_in_full) return { owed: 0, upcoming: 0 };
    return { owed: row.started_on <= on ? 1 : 0, upcoming: row.started_on > on && row.started_on <= horizon ? 1 : 0 };
  }
  let owed = 0;
  let upcoming = 0;
  let start = row.paid_until && row.paid_until >= row.started_on ? addDays(row.paid_until, 1) : row.started_on;
  for (let i = 0; i < 200 && start <= horizon; i += 1) {
    if (start <= on) owed += 1;
    else upcoming += 1;
    start = addDays(periodOf(row.started_on, row.billing, start).end as string, 1);
  }
  return { owed, upcoming };
}

// How many whole periods a payment covers: the period ends passed moving the
// paid-up date from `from` (null: not paid yet) to `to`. Back: negative.
export function periodsCovered(startedOn: string, billing: string, from: string | null, to: string | null): number {
  const before = from ?? addDays(startedOn, -1);
  const after = to ?? addDays(startedOn, -1);
  const [low, high, sign] = after >= before ? [before, after, 1] : [after, before, -1];
  let n = 0;
  let end = periodOf(startedOn, billing, startedOn).end as string;
  for (let i = 0; i < 1000 && end <= high; i += 1) {
    if (end > low) n += 1;
    end = periodOf(startedOn, billing, addDays(end, 1)).end as string;
  }
  return sign * n;
}

// Keep a record of a recorded payment (product_package_payments), valued at
// the package price - every change to the paid-up date, so it can be undone
// (part of a period is worth nothing until the period is complete).
async function logPayment(
  client: QueryClient,
  entry: { membershipId: string; coachUserId: string; athleteUserId: string; from: string | null; to: string | null; paidInFull: boolean; periods: number; priceMinor: number; currency: string }
): Promise<string | null> {
  if (!entry.paidInFull && entry.from === entry.to) return null;
  const paymentId = `ppay_${crypto.randomUUID().replaceAll("-", "")}`;
  await client.query(
    `INSERT INTO product_package_payments (payment_id, membership_id, coach_user_id, athlete_user_id, paid_until_from, paid_until_to, paid_in_full, periods, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [paymentId, entry.membershipId, entry.coachUserId, entry.athleteUserId, entry.from, entry.to, entry.paidInFull, entry.periods, entry.periods * entry.priceMinor, entry.currency]
  );
  return paymentId;
}

// A payment can be undone for a while after it's recorded - the newest one
// on the athlete's current package only.
export const UNDO_MINUTES = 10;

// The payments recorded on a membership, newest first. Athletes see dates
// and periods, not amounts.
async function paymentHistory(membershipId: string, forAthlete: boolean, client: QueryClient = pool): Promise<Json[]> {
  const result = await client.query(
    `SELECT payment_id, recorded_at, paid_until_from::text AS paid_until_from, paid_until_to::text AS paid_until_to, paid_in_full, periods, amount_minor, currency
     FROM product_package_payments WHERE membership_id = $1 ORDER BY recorded_at DESC, payment_id DESC LIMIT 12`,
    [membershipId]
  );
  return result.rows.map((row: Json) => ({
    payment_id: String(row.payment_id),
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : String(row.recorded_at),
    paid_until_from: row.paid_until_from ?? null,
    paid_until_to: row.paid_until_to ?? null,
    paid_in_full: row.paid_in_full === true,
    periods: Number(row.periods),
    ...(forAthlete ? {} : { amount_minor: Number(row.amount_minor), currency: String(row.currency) })
  }));
}

const isoTime = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

// An athlete can say they've paid when payment is due or the paid-up date
// is within the reminder window (package_payment_reminders.ts).
export const CLAIM_DAYS_BEFORE = 3;
export function canClaimPayment(row: { billing: string; started_on: string; paid_until: string | null; paid_in_full: boolean }, on = today()): boolean {
  if (row.paid_in_full) return false;
  if (paymentDue(row, on)) return true;
  if (row.billing === "one_off") return row.started_on <= addDays(on, CLAIM_DAYS_BEFORE);
  return !row.paid_until || row.paid_until <= addDays(on, CLAIM_DAYS_BEFORE - 1);
}

// --- Reading ---------------------------------------------------------------------

const MEMBERSHIP_SELECT = `
  SELECT m.membership_id, m.coach_user_id, m.athlete_user_id, m.started_on::text AS started_on, m.paid_until::text AS paid_until, m.paid_in_full,
         m.payment_claimed_at, m.payment_claim_note, m.payment_claim_declined_at,
         p.package_id, p.name, p.description, p.price_minor, p.currency, p.billing, p.includes, p.org_id,
         COALESCE(l.display_name, o.org_name) AS gym_name, a.display_name AS athlete_display_name
  FROM product_package_memberships m
  JOIN product_service_packages p ON p.package_id = m.package_id
  JOIN product_accounts a ON a.user_id = m.athlete_user_id
  LEFT JOIN product_organisations o ON o.org_id = p.org_id
  LEFT JOIN product_gym_listings l ON l.org_id = p.org_id`;

async function membershipView(row: Json, client: QueryClient = pool): Promise<Json> {
  const startedOn = dayValue(row.started_on) as string;
  const paidUntil = dayValue(row.paid_until);
  const billing = String(row.billing);
  const now = today();
  const period = periodOf(startedOn, billing, now < startedOn ? startedOn : now);
  const used = await client.query(
    `SELECT count(*) FILTER (WHERE call_method = 'in_person')::int AS in_person, count(*) FILTER (WHERE call_method <> 'in_person')::int AS calls
     FROM product_coach_checkins
     WHERE coach_user_id = $1 AND athlete_user_id = $2 AND checkin_status <> 'cancelled'
       AND starts_at >= $3::date AND ($4::date IS NULL OR starts_at < $4::date + 1)`,
    [row.coach_user_id, row.athlete_user_id, period.start, period.end]
  );
  const pkg = packageView(row);
  const includes = pkg.includes as Json;
  return {
    membership_id: String(row.membership_id),
    package: {
      package_id: pkg.package_id, name: pkg.name, price_label: pkg.price_label, billing, includes_summary: pkg.includes_summary,
      gym_name: row.org_id ? text(row.gym_name) || "Your gym" : null
    },
    started_on: startedOn,
    paid_until: paidUntil,
    paid_in_full: row.paid_in_full === true,
    // The athlete says they've paid, until the coach records it or says it
    // hasn't arrived.
    payment_claim: row.payment_claimed_at ? { claimed_at: isoTime(row.payment_claimed_at), note: text(row.payment_claim_note) || null } : null,
    payment_claim_declined_at: row.payment_claim_declined_at ? isoTime(row.payment_claim_declined_at) : null,
    can_claim_payment: canClaimPayment({ billing, started_on: startedOn, paid_until: paidUntil, paid_in_full: row.paid_in_full === true }, now) && !row.payment_claimed_at,
    // What "record a payment" with no date would make it (one more period).
    next_paid_until: billing === "one_off" ? null : nextPaidUntil(startedOn, billing, paidUntil),
    payment_due: paymentDue({ started_on: startedOn, paid_until: paidUntil, paid_in_full: row.paid_in_full === true }, now),
    period_start: period.start,
    period_end: period.end,
    usage: {
      checkin_calls: { used: Number(used.rows[0]?.calls ?? 0), included: Number(includes.checkin_calls ?? 0) },
      in_person_sessions: { used: Number(used.rows[0]?.in_person ?? 0), included: Number(includes.in_person_sessions ?? 0) }
    }
  };
}

async function currentRow(coachUserId: string, athleteUserId: string, client: QueryClient = pool): Promise<Json | null> {
  const result = await client.query(
    `${MEMBERSHIP_SELECT} WHERE m.coach_user_id = $1 AND m.athlete_user_id = $2 AND m.ended_at IS NULL`,
    [coachUserId, athleteUserId]
  );
  return (result.rows[0] as Json | undefined) ?? null;
}

// Is payment due for this athlete with this coach? (No package: never.)
export async function athletePaymentDue(coachUserId: string, athleteUserId: string, client: QueryClient = pool): Promise<boolean> {
  const row = await currentRow(coachUserId, athleteUserId, client);
  return !!row && paymentDue({ started_on: dayValue(row.started_on) as string, paid_until: dayValue(row.paid_until), paid_in_full: row.paid_in_full === true });
}

// What the athlete sees on their coach's card.
export async function athleteMembershipWith(coachUserId: string, athleteUserId: string): Promise<Json | null> {
  const row = await currentRow(coachUserId, athleteUserId);
  return row ? { ...(await membershipView(row)), payments: await paymentHistory(String(row.membership_id), true) } : null;
}

// The packages a coach can put an athlete on: their own, and gym packages
// they deliver at a gym that has confirmed them.
async function packageOptions(coachUserId: string): Promise<Json[]> {
  const result = await pool.query(
    `SELECT p.*, COALESCE(l.display_name, o.org_name) AS gym_name
     FROM product_service_packages p
     LEFT JOIN product_organisations o ON o.org_id = p.org_id
     LEFT JOIN product_gym_listings l ON l.org_id = p.org_id
     WHERE p.archived_at IS NULL AND (
       p.coach_user_id = $1
       OR ($1 = ANY(p.delivered_by) AND EXISTS (
         SELECT 1 FROM product_coach_gyms g WHERE g.org_id = p.org_id AND g.coach_user_id = $1 AND g.link_status = 'confirmed')))
     ORDER BY p.org_id NULLS FIRST, p.price_minor, p.created_at`,
    [coachUserId]
  );
  return result.rows.map((row) => {
    const view = packageView(row);
    return {
      package_id: view.package_id, name: view.name, price_label: view.price_label, billing: view.billing, includes_summary: view.includes_summary,
      gym_name: row.org_id ? text(row.gym_name) || "Your gym" : null
    };
  });
}

export async function getAthletePackageForCoach(coachUserId: string, athleteUserIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  await assertCoachesAthlete(coachUserId, athleteUserId);
  const [row, options] = await Promise.all([currentRow(coachUserId, athleteUserId), packageOptions(coachUserId)]);
  const membership = row ? { ...(await membershipView(row)), payments: await paymentHistory(String(row.membership_id), false) } : null;
  return { ok: true, membership, options, undo_minutes: UNDO_MINUTES };
}

// The coach's athletes on a package, payment due first (for the Packages
// panel). Only athletes they still coach.
export async function listCoachPackageMembers(coachUserId: string): Promise<Json> {
  const result = await pool.query(
    `${MEMBERSHIP_SELECT}
     WHERE m.coach_user_id = $1 AND m.ended_at IS NULL
       AND (SELECT r.record_payload->>'relationship_state' FROM beta_product_records r
            WHERE r.record_type = 'beta17_coach_relationship' AND r.actor_user_id = m.coach_user_id AND r.subject_user_id = m.athlete_user_id
            ORDER BY r.effective_at DESC, r.created_at DESC LIMIT 1) = 'accepted'
     ORDER BY a.display_name`,
    [coachUserId]
  );
  const members: Json[] = [];
  // Money owed now and coming up in the next 30 days, per currency - worked
  // out from the package prices, as payments are made outside the app.
  const totals = new Map<string, { currency: string; owed_minor: number; upcoming_minor: number }>();
  const now = today();
  for (const row of result.rows) {
    const view = await membershipView(row);
    const outlook = paymentOutlook({ billing: String(row.billing), started_on: view.started_on as string, paid_until: view.paid_until as string | null, paid_in_full: view.paid_in_full === true }, now);
    const priceMinor = Number(row.price_minor ?? 0);
    const currency = String(row.currency ?? "GBP");
    const total = totals.get(currency) ?? { currency, owed_minor: 0, upcoming_minor: 0 };
    total.owed_minor += outlook.owed * priceMinor;
    total.upcoming_minor += outlook.upcoming * priceMinor;
    totals.set(currency, total);
    members.push({
      athlete_user_id: String(row.athlete_user_id), athlete_display_name: text(row.athlete_display_name) || "An athlete", ...view,
      price_minor: priceMinor, currency, owed_periods: outlook.owed, owed_minor: outlook.owed * priceMinor
    });
  }
  members.sort((a, b) => Number(b.payment_due) - Number(a.payment_due));
  return { ok: true, today: now, outlook_days: OUTLOOK_DAYS, members, totals: [...totals.values()].filter((t) => t.owed_minor || t.upcoming_minor) };
}

// --- The coach's changes ---------------------------------------------------------------

// Put the athlete on a package (replacing any current one), paid for the
// first period - or the whole one-off - when the coach says so.
export async function startAthletePackage(coachUserId: string, athleteUserIdInput: unknown, input: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  await assertCoachesAthlete(coachUserId, athleteUserId);
  if (!isRecord(input)) throw new CoachCheckinError("package_membership_invalid", 422);
  const option = (await packageOptions(coachUserId)).find((pkg) => pkg.package_id === text(input.package_id));
  if (!option) throw new CoachCheckinError("package_membership_invalid", 422, { package_id: "Choose one of your packages." });
  const now = today();
  const startedOn = input.started_on === undefined || input.started_on === "" ? now : dayValue(input.started_on);
  if (!startedOn || startedOn < addDays(now, -366) || startedOn > addDays(now, 90)) {
    throw new CoachCheckinError("package_membership_invalid", 422, { started_on: "A date in the last year or the next 90 days." });
  }
  const paidNow = input.paid_now === true;
  const billing = String(option.billing);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE product_package_memberships SET ended_at = now(), updated_at = now() WHERE coach_user_id = $1 AND athlete_user_id = $2 AND ended_at IS NULL`,
      [coachUserId, athleteUserId]
    );
    const membershipId = `pmem_${crypto.randomUUID().replaceAll("-", "")}`;
    const paidUntil = paidNow && billing !== "one_off" ? nextPaidUntil(startedOn, billing, null) : null;
    await client.query(
      `INSERT INTO product_package_memberships (membership_id, package_id, coach_user_id, athlete_user_id, started_on, paid_until, paid_in_full)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [membershipId, option.package_id, coachUserId, athleteUserId, startedOn, paidUntil, paidNow && billing === "one_off"]
    );
    if (paidNow) {
      const price = (await client.query(`SELECT price_minor, currency FROM product_service_packages WHERE package_id = $1`, [option.package_id])).rows[0] as Json;
      await logPayment(client, {
        membershipId, coachUserId, athleteUserId, from: null, to: paidUntil, paidInFull: billing === "one_off",
        periods: 1, priceMinor: Number(price.price_minor), currency: String(price.currency)
      });
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
  return getAthletePackageForCoach(coachUserId, athleteUserId);
}

async function requireCurrent(coachUserId: string, athleteUserId: string): Promise<Json> {
  await assertCoachesAthlete(coachUserId, athleteUserId);
  const row = await currentRow(coachUserId, athleteUserId);
  if (!row) throw new CoachCheckinError("package_membership_not_found", 404);
  return row;
}

// A payment came in: one more period paid (or paid up to a date the coach
// gives), or a one-off paid in full.
export async function recordPackagePayment(coachUserId: string, athleteUserIdInput: unknown, input: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  const row = await requireCurrent(coachUserId, athleteUserId);
  const billing = String(row.billing);
  const startedOn = dayValue(row.started_on) as string;
  const entry = {
    membershipId: String(row.membership_id), coachUserId, athleteUserId, priceMinor: Number(row.price_minor), currency: String(row.currency)
  };
  let recordedPaymentId: string | null = null;
  if (billing === "one_off") {
    const updated = await pool.query(`UPDATE product_package_memberships SET paid_in_full = true, payment_claimed_at = NULL, payment_claim_note = NULL, payment_claim_declined_at = NULL, updated_at = now() WHERE membership_id = $1 AND NOT paid_in_full`, [row.membership_id]);
    if (updated.rowCount) recordedPaymentId = await logPayment(pool, { ...entry, from: null, to: null, paidInFull: true, periods: 1 });
  }
  else {
    const given = isRecord(input) && input.paid_until !== undefined && input.paid_until !== "" ? dayValue(input.paid_until) : undefined;
    if (given === null || (given && (given < addDays(startedOn, -1) || given > addDays(today(), 400)))) {
      throw new CoachCheckinError("package_membership_invalid", 422, { paid_until: "A date from the start to about a year ahead." });
    }
    const from = dayValue(row.paid_until);
    const to = given ?? nextPaidUntil(startedOn, billing, from);
    await pool.query(
      `UPDATE product_package_memberships SET paid_until = $2, payment_claimed_at = NULL, payment_claim_note = NULL, payment_claim_declined_at = NULL, updated_at = now() WHERE membership_id = $1`,
      [row.membership_id, to]
    );
    recordedPaymentId = await logPayment(pool, { ...entry, from, to, paidInFull: false, periods: periodsCovered(startedOn, billing, from, to) });
  }
  return { ...(await getAthletePackageForCoach(coachUserId, athleteUserId)), recorded_payment_id: recordedPaymentId };
}

// Undo a payment recorded by mistake: the paid-up date goes back to what it
// was (or a one-off back to not paid) and the payment is no longer counted.
// Only the newest payment on the current package, within UNDO_MINUTES.
export async function undoPackagePayment(coachUserId: string, athleteUserIdInput: unknown, paymentIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  const row = await requireCurrent(coachUserId, athleteUserId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT 1 FROM product_package_memberships WHERE membership_id = $1 FOR UPDATE`, [row.membership_id]);
    const newest = (await client.query(
      `SELECT payment_id, paid_until_from::text AS paid_until_from, paid_in_full, recorded_at > now() - make_interval(mins => $2) AS recent
       FROM product_package_payments WHERE membership_id = $1 ORDER BY recorded_at DESC, payment_id DESC LIMIT 1`,
      [row.membership_id, UNDO_MINUTES]
    )).rows[0] as Json | undefined;
    if (!newest || newest.payment_id !== text(paymentIdInput)) throw new CoachCheckinError("package_payment_not_found", 404);
    if (!newest.recent) throw new CoachCheckinError("package_payment_undo_expired", 409);
    if (newest.paid_in_full) {
      await client.query(`UPDATE product_package_memberships SET paid_in_full = false, updated_at = now() WHERE membership_id = $1`, [row.membership_id]);
    }
    else {
      await client.query(`UPDATE product_package_memberships SET paid_until = $2, updated_at = now() WHERE membership_id = $1`, [row.membership_id, newest.paid_until_from ?? null]);
    }
    await client.query(`DELETE FROM product_package_payments WHERE payment_id = $1`, [newest.payment_id]);
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
  return getAthletePackageForCoach(coachUserId, athleteUserId);
}

// The athlete says they've paid their coach (outside the app): the coach is
// told and confirms it by recording the payment, or says it hasn't arrived.
// Saying it again while waiting changes nothing.
export async function claimPackagePayment(athleteUserId: string, coachUserIdInput: unknown, input: unknown): Promise<Json> {
  const coachUserId = text(coachUserIdInput);
  const row = await currentRow(coachUserId, athleteUserId);
  if (!row) throw new CoachCheckinError("package_membership_not_found", 404);
  const note = (isRecord(input) ? text(input.note) : "").slice(0, 200);
  if (!row.payment_claimed_at) {
    const plain = { billing: String(row.billing), started_on: dayValue(row.started_on) as string, paid_until: dayValue(row.paid_until), paid_in_full: row.paid_in_full === true };
    if (!canClaimPayment(plain)) throw new CoachCheckinError("package_payment_not_due", 409);
    await pool.query(
      `UPDATE product_package_memberships SET payment_claimed_at = now(), payment_claim_note = $2, payment_claim_declined_at = NULL, updated_at = now()
       WHERE membership_id = $1 AND payment_claimed_at IS NULL`,
      [row.membership_id, note || null]
    );
  }
  return { ok: true, membership: await athleteMembershipWith(coachUserId, athleteUserId) };
}

// The coach hasn't received what the athlete says they paid: the claim is
// cleared and the athlete is told.
export async function declinePaymentClaim(coachUserId: string, athleteUserIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  const row = await requireCurrent(coachUserId, athleteUserId);
  const updated = await pool.query(
    `UPDATE product_package_memberships SET payment_claimed_at = NULL, payment_claim_note = NULL, payment_claim_declined_at = now(), updated_at = now()
     WHERE membership_id = $1 AND payment_claimed_at IS NOT NULL`,
    [row.membership_id]
  );
  if (!updated.rowCount) throw new CoachCheckinError("package_payment_claim_not_found", 404);
  return getAthletePackageForCoach(coachUserId, athleteUserId);
}

export async function endAthletePackage(coachUserId: string, athleteUserIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  const row = await requireCurrent(coachUserId, athleteUserId);
  await pool.query(`UPDATE product_package_memberships SET ended_at = now(), updated_at = now() WHERE membership_id = $1`, [row.membership_id]);
  return getAthletePackageForCoach(coachUserId, athleteUserId);
}

// Payment is due: cancel every upcoming check-in call and in-person session
// with the athlete (they're told, as for any cancelled call).
export async function cancelUpcomingForUnpaid(coachUserId: string, athleteUserIdInput: unknown): Promise<Json> {
  const athleteUserId = text(athleteUserIdInput);
  const row = await requireCurrent(coachUserId, athleteUserId);
  if (!paymentDue({ started_on: dayValue(row.started_on) as string, paid_until: dayValue(row.paid_until), paid_in_full: row.paid_in_full === true })) {
    throw new CoachCheckinError("package_payment_not_due", 409);
  }
  const cancelled = await pool.query(
    `UPDATE product_coach_checkins SET checkin_status = 'cancelled', cancelled_by = 'coach', cancelled_at = now(), updated_at = now()
     WHERE coach_user_id = $1 AND athlete_user_id = $2 AND checkin_status <> 'cancelled' AND starts_at > now()`,
    [coachUserId, athleteUserId]
  );
  return { ...(await getAthletePackageForCoach(coachUserId, athleteUserId)), cancelled_count: cancelled.rowCount ?? 0 };
}
