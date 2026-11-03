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

// --- Reading ---------------------------------------------------------------------

const MEMBERSHIP_SELECT = `
  SELECT m.membership_id, m.coach_user_id, m.athlete_user_id, m.started_on::text AS started_on, m.paid_until::text AS paid_until, m.paid_in_full,
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
  return row ? membershipView(row) : null;
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
  return { ok: true, membership: row ? await membershipView(row) : null, options };
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
    await client.query(
      `INSERT INTO product_package_memberships (membership_id, package_id, coach_user_id, athlete_user_id, started_on, paid_until, paid_in_full)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `pmem_${crypto.randomUUID().replaceAll("-", "")}`, option.package_id, coachUserId, athleteUserId, startedOn,
        paidNow && billing !== "one_off" ? nextPaidUntil(startedOn, billing, null) : null,
        paidNow && billing === "one_off"
      ]
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
  if (billing === "one_off") {
    await pool.query(`UPDATE product_package_memberships SET paid_in_full = true, updated_at = now() WHERE membership_id = $1`, [row.membership_id]);
  }
  else {
    const given = isRecord(input) && input.paid_until !== undefined && input.paid_until !== "" ? dayValue(input.paid_until) : undefined;
    if (given === null || (given && (given < addDays(startedOn, -1) || given > addDays(today(), 400)))) {
      throw new CoachCheckinError("package_membership_invalid", 422, { paid_until: "A date from the start to about a year ahead." });
    }
    await pool.query(
      `UPDATE product_package_memberships SET paid_until = $2, updated_at = now() WHERE membership_id = $1`,
      [row.membership_id, given ?? nextPaidUntil(startedOn, billing, dayValue(row.paid_until))]
    );
  }
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
