// DEV NOTE: Payment reminders for packages (package_membership_service.ts).
// Payment is made outside the app, so nobody else knows it's coming: the
// athlete is reminded three days before their paid-up date runs out and told
// when payment is due; the coach is told when an athlete's paid-up date has
// lapsed (not when the coach starts someone unpaid - they just did that).
// In-app notifications are derived from these keys (product_notification_
// service.ts); a background sweep emails the same reminders, once each - the
// keys already emailed are kept on the membership (emailed_reminders), and a
// coach gets one email listing every athlete who fell due since the last
// sweep. Dates are UTC days, like the memberships themselves.

import { pool } from "../db/pool.js";
import { coachBusinessName } from "./coach_branding_service.js";
import { paymentDue, today } from "./package_membership_service.js";

type Json = Record<string, unknown>;
type QueryClient = { query: typeof pool.query };
const DAY_MS = 86400000;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

export const REMINDER_DAYS_BEFORE = 3;

export type ReminderKind = "upcoming" | "due" | "coach_due";

// Which reminders a membership owes today. Each is keyed by the paid-up date
// it's about, so a new payment brings fresh reminders for the next period
// and the same period is never reminded twice.
export function remindersFor(
  row: { billing: string; started_on: string; paid_until: string | null; paid_in_full: boolean },
  on = today()
): { kind: ReminderKind; key: string }[] {
  const out: { kind: ReminderKind; key: string }[] = [];
  if (paymentDue(row, on)) {
    const about = row.paid_until ?? `unpaid-${row.started_on}`;
    out.push({ kind: "due", key: `due:${about}` });
    if (row.paid_until) out.push({ kind: "coach_due", key: `coach_due:${about}` });
  }
  else if (row.billing !== "one_off" && row.paid_until && !row.paid_in_full && on >= row.started_on
    && on >= addDays(row.paid_until, 1 - REMINDER_DAYS_BEFORE)) {
    out.push({ kind: "upcoming", key: `upcoming:${row.paid_until}` });
  }
  return out;
}

export const REMINDER_SELECT = `
  SELECT m.membership_id, m.coach_user_id, m.athlete_user_id, m.started_on::text AS started_on, m.paid_until::text AS paid_until,
         m.paid_in_full, m.emailed_reminders, m.payment_claimed_at, m.payment_claim_declined_at, p.name AS package_name, p.billing
  FROM product_package_memberships m
  JOIN product_service_packages p ON p.package_id = m.package_id
  WHERE m.ended_at IS NULL`;

export function reminderRow(row: Json): { billing: string; started_on: string; paid_until: string | null; paid_in_full: boolean } {
  return { billing: String(row.billing), started_on: String(row.started_on), paid_until: row.paid_until ? String(row.paid_until) : null, paid_in_full: row.paid_in_full === true };
}

export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// --- Emails ----------------------------------------------------------------------

function appOrigin(): string {
  try {
    return new URL(process.env.KOLOSSEUM_PUBLIC_APP_URL || "https://app.kolosseum.tools").origin;
  }
  catch {
    return "https://app.kolosseum.tools";
  }
}

export function athleteReminderEmail(kind: "upcoming" | "due", input: { coachName: string; packageName: string; paidUntil: string | null }): { subject: string; text: string } {
  const appUrl = `${appOrigin()}/app/#/account`;
  if (kind === "upcoming") {
    return {
      subject: `Your ${input.packageName} with ${input.coachName} is paid up to ${dayLabel(input.paidUntil as string)}`,
      text: [
        `Your ${input.packageName} package with ${input.coachName} is paid up to ${dayLabel(input.paidUntil as string)}.`,
        "",
        `Pay ${input.coachName} the way you usually do before then to keep booking calls and sessions. Once they've recorded it, you'll see the new date under My coach:`,
        appUrl
      ].join("\n")
    };
  }
  return {
    subject: `Payment due for your ${input.packageName} with ${input.coachName}`,
    text: [
      input.paidUntil
        ? `Your ${input.packageName} package with ${input.coachName} was paid up to ${dayLabel(input.paidUntil)}, so payment is now due.`
        : `Payment is due for your ${input.packageName} package with ${input.coachName}.`,
      "",
      `You can't book their open slots until they record your payment, and they may cancel upcoming calls and sessions. Pay ${input.coachName} the way you usually do; you'll see it under My coach once they've recorded it:`,
      appUrl
    ].join("\n")
  };
}

export function coachDueEmail(athletes: { name: string; packageName: string; paidUntil: string }[]): { subject: string; text: string } {
  const appUrl = `${appOrigin()}/app/#/coach/athletes`;
  return {
    subject: athletes.length === 1 ? `Payment due: ${athletes[0].name}` : `Payment due: ${athletes.length} athletes`,
    text: [
      athletes.length === 1 ? "This athlete's package is no longer paid up:" : "These athletes' packages are no longer paid up:",
      "",
      ...athletes.map((a) => `- ${a.name} - ${a.packageName}, paid up to ${dayLabel(a.paidUntil)}`),
      "",
      "They can't book your open slots until you record a payment. Record it under Payments on your Athletes page, or open their profile to cancel what's booked with them:",
      appUrl
    ].join("\n")
  };
}

async function sendEmail(to: string, email: { subject: string; text: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.KOLOSSEUM_EMAIL_FROM || process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM;
  if (!apiKey || !from || !to) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`WARN: package reminder email failed (status ${response.status})`);
    }
    return response.ok;
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error("WARN: package reminder email failed to send", error instanceof Error ? error.message : error);
    return false;
  }
}

export type ReminderSender = (to: string, email: { subject: string; text: string }) => Promise<boolean>;

// Claims a reminder key on the membership; only one sweep can claim it.
async function claim(client: QueryClient, membershipId: string, key: string): Promise<boolean> {
  const result = await client.query(
    `UPDATE product_package_memberships SET emailed_reminders = array_append(emailed_reminders, $2)
     WHERE membership_id = $1 AND ended_at IS NULL AND NOT ($2 = ANY(emailed_reminders)) RETURNING membership_id`,
    [membershipId, key]
  );
  return (result.rowCount ?? 0) > 0;
}

// A failed send is given back, to be tried again next sweep.
async function unclaim(client: QueryClient, membershipId: string, key: string): Promise<void> {
  await client.query(`UPDATE product_package_memberships SET emailed_reminders = array_remove(emailed_reminders, $2) WHERE membership_id = $1`, [membershipId, key]);
}

// Emails every reminder owed and not yet sent. Returns how many emails went.
export async function runPackageReminderSweep(options: { send?: ReminderSender; on?: string; client?: QueryClient } = {}): Promise<number> {
  const send = options.send ?? sendEmail;
  const client = options.client ?? pool;
  const on = options.on ?? today();
  if (!options.send && !process.env.RESEND_API_KEY) return 0;
  const rows = (await client.query(REMINDER_SELECT)).rows as Json[];
  const people = new Map<string, { email: string; name: string }>();
  async function person(userId: string): Promise<{ email: string; name: string } | null> {
    if (!people.has(userId)) {
      const result = await client.query(`SELECT email_canonical, display_name FROM product_accounts WHERE user_id = $1`, [userId]);
      const found = result.rows[0] as Json | undefined;
      if (!found) return null;
      const business = await coachBusinessName(userId).catch(() => null);
      people.set(userId, { email: String(found.email_canonical), name: business || String(found.display_name) });
    }
    return people.get(userId) ?? null;
  }

  let sent = 0;
  const coachDue = new Map<string, { membershipId: string; key: string; name: string; packageName: string; paidUntil: string }[]>();
  for (const row of rows) {
    const emailed = Array.isArray(row.emailed_reminders) ? (row.emailed_reminders as string[]) : [];
    const membershipId = String(row.membership_id);
    const packageName = String(row.package_name);
    const plain = reminderRow(row);
    for (const reminder of remindersFor(plain, on)) {
      if (emailed.includes(reminder.key)) continue;
      if (reminder.kind === "coach_due") {
        const athlete = await person(String(row.athlete_user_id));
        const list = coachDue.get(String(row.coach_user_id)) ?? [];
        list.push({ membershipId, key: reminder.key, name: athlete?.name ?? "An athlete", packageName, paidUntil: plain.paid_until as string });
        coachDue.set(String(row.coach_user_id), list);
        continue;
      }
      const athlete = await person(String(row.athlete_user_id));
      const coach = await person(String(row.coach_user_id));
      if (!athlete || !coach) continue;
      if (!(await claim(client, membershipId, reminder.key))) continue;
      const email = athleteReminderEmail(reminder.kind, { coachName: coach.name, packageName, paidUntil: plain.paid_until });
      if (await send(athlete.email, email)) sent += 1;
      else await unclaim(client, membershipId, reminder.key);
    }
  }

  // One email per coach, listing everyone who fell due.
  for (const [coachUserId, entries] of coachDue) {
    const coach = await person(coachUserId);
    if (!coach) continue;
    const claimed = [];
    for (const entry of entries) if (await claim(client, entry.membershipId, entry.key)) claimed.push(entry);
    if (!claimed.length) continue;
    if (await send(coach.email, coachDueEmail(claimed))) sent += 1;
    else for (const entry of claimed) await unclaim(client, entry.membershipId, entry.key);
  }
  return sent;
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweeping = false;

// Started by the server: a sweep shortly after start, then hourly (so a
// reminder goes out within the hour after a UTC day starts). A no-op
// without email configured.
export function startPackageReminderSweeps(): void {
  if (sweepTimer || !process.env.RESEND_API_KEY) return;
  const tick = () => {
    if (sweeping) return;
    sweeping = true;
    runPackageReminderSweep().catch(() => 0).finally(() => { sweeping = false; });
  };
  setTimeout(tick, 30_000).unref?.();
  sweepTimer = setInterval(tick, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}
