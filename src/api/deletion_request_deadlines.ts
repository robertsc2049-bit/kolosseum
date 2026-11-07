// Deletion requests have a deadline. The privacy notice (section 8.2) says a
// person's data is deleted "normally within 30 days" of their request, and
// UK GDPR gives one month. Erasing is a manual admin step (the Erase button,
// gdpr_erasure_service.ts), so this module makes sure a request can't be
// missed:
// - deletionDeadline() gives each request a due-by date and a state the
//   admin console shows (product_admin_review_service.ts);
// - notifyDeletionRequested() emails the admin when a request arrives;
// - runDeletionDeadlineSweep() emails the admin once a day while any
//   request is still open after DUE_SOON_DAYS.
// All of it is a no-op without email configured, and never throws into the
// person's request.
import { pool } from "../db/pool.js";
import { sendAdminEmail } from "./support_alert_notifier.js";

export const DELETION_DUE_DAYS = 30;
export const DUE_SOON_DAYS = 21;
const DAY_MS = 86_400_000;

export type DeadlineState = "on_time" | "due_soon" | "overdue" | "done";

export type DeletionDeadline = {
  due_by_iso8601: string;
  days_left: number;
  deadline_state: DeadlineState;
};

// Counted in calendar days (UTC), like the "erase by" date the admin sees:
// due today is 0 days left, overdue from the next day.
const utcDay = (date: Date) => Math.floor(date.getTime() / DAY_MS);

export function deletionDeadline(requestedAt: Date | string, queueStatus: string, now: Date = new Date()): DeletionDeadline {
  const requested = new Date(requestedAt);
  const due = new Date(requested.getTime() + DELETION_DUE_DAYS * DAY_MS);
  const daysLeft = utcDay(due) - utcDay(now);
  const deadline_state: DeadlineState = queueStatus === "completed"
    ? "done"
    : daysLeft < 0
      ? "overdue"
      : daysLeft <= DELETION_DUE_DAYS - DUE_SOON_DAYS
        ? "due_soon"
        : "on_time";
  return { due_by_iso8601: due.toISOString(), days_left: daysLeft, deadline_state };
}

export type DeletionRequestKind = "athlete_or_coach" | "org_owner";

const KIND_LABELS: Readonly<Record<DeletionRequestKind, string>> = {
  athlete_or_coach: "an athlete or coach",
  org_owner: "a gym or organisation owner"
};

function adminLink(): string {
  const base = (process.env.KOLOSSEUM_PUBLIC_APP_URL || "").replace(/\/$/u, "");
  return base ? `${base}/admin/` : "the admin console";
}

const dueDate = (iso: string) => iso.slice(0, 10);

// A new request: what it is and when it's due, never the person's data.
export async function notifyDeletionRequested(input: { kind: DeletionRequestKind; deletion_request_id: string; user_id: string; requested_at: Date | string }): Promise<void> {
  const { due_by_iso8601 } = deletionDeadline(input.requested_at, "queued_for_review");
  await sendAdminEmail(
    `Deletion request - erase by ${dueDate(due_by_iso8601)}`,
    [
      `${KIND_LABELS[input.kind][0].toUpperCase()}${KIND_LABELS[input.kind].slice(1)} asked for their data to be deleted.`,
      "",
      `Request: ${input.deletion_request_id}`,
      `User ID: ${input.user_id}`,
      `Erase by: ${dueDate(due_by_iso8601)} (${DELETION_DUE_DAYS} days, as the privacy notice promises)`,
      "",
      `Review and erase it in ${adminLink()} (Data rights).`
    ],
    "deletion request alert"
  );
}

export type OpenDeletionRequest = DeletionDeadline & {
  kind: DeletionRequestKind;
  deletion_request_id: string;
  user_id: string;
  requested_at_iso8601: string;
};

type QueryClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

// Every request not yet erased, oldest first, with its deadline.
export async function openDeletionRequests(client: QueryClient = pool, now: Date = new Date()): Promise<OpenDeletionRequest[]> {
  const result = await client.query(
    `SELECT 'athlete_or_coach' AS kind, deletion_request_id, user_id, queue_status, requested_at
       FROM data_deletion_requests WHERE queue_status <> 'completed'
     UNION ALL
     SELECT 'org_owner' AS kind, deletion_request_id, user_id, queue_status, requested_at
       FROM org_owner_data_deletion_requests WHERE queue_status <> 'completed'
     ORDER BY requested_at ASC`
  );
  return result.rows.map((row) => ({
    kind: row.kind as DeletionRequestKind,
    deletion_request_id: String(row.deletion_request_id),
    user_id: String(row.user_id),
    requested_at_iso8601: new Date(row.requested_at as string).toISOString(),
    ...deletionDeadline(row.requested_at as string, String(row.queue_status), now)
  }));
}

export function deadlineReminderEmail(requests: readonly OpenDeletionRequest[]): { subject: string; lines: string[] } {
  const overdue = requests.filter((r) => r.deadline_state === "overdue").length;
  const subject = overdue
    ? `${overdue} deletion request${overdue === 1 ? " is" : "s are"} overdue`
    : `${requests.length} deletion request${requests.length === 1 ? "" : "s"} due soon`;
  const lines = [
    `These deletion requests haven't been erased yet. The privacy notice promises deletion within ${DELETION_DUE_DAYS} days.`,
    ""
  ];
  for (const r of requests) {
    const when = r.deadline_state === "overdue"
      ? `OVERDUE by ${-r.days_left} day${r.days_left === -1 ? "" : "s"}`
      : `${r.days_left} day${r.days_left === 1 ? "" : "s"} left`;
    lines.push(`- ${r.deletion_request_id} (${KIND_LABELS[r.kind]}, user ${r.user_id}): erase by ${dueDate(r.due_by_iso8601)}, ${when}`);
  }
  lines.push("", `Review and erase them in ${adminLink()} (Data rights).`);
  return { subject, lines };
}

export type AdminSender = (subject: string, lines: string[]) => Promise<void>;

let lastReminderDay = "";

// Emails one summary of every request due soon or overdue. At most once per
// UTC day per server run (a redeploy can repeat that day's email - harmless),
// and not before 08:00 UTC so it arrives in the working day.
export async function runDeletionDeadlineSweep(options: { send?: AdminSender; now?: Date; client?: QueryClient; force?: boolean } = {}): Promise<number> {
  const now = options.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  if (!options.force && (lastReminderDay === day || now.getUTCHours() < 8)) return 0;
  const due = (await openDeletionRequests(options.client, now)).filter((r) => r.deadline_state === "due_soon" || r.deadline_state === "overdue");
  lastReminderDay = day;
  if (!due.length) return 0;
  const email = deadlineReminderEmail(due);
  const send = options.send ?? ((subject: string, lines: string[]) => sendAdminEmail(subject, lines, "deletion deadline reminder"));
  await send(email.subject, email.lines);
  return due.length;
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweeping = false;

// Started by the server: hourly, so the day's email goes out soon after
// 08:00 UTC. A no-op without email configured.
export function startDeletionDeadlineSweeps(): void {
  if (sweepTimer || !process.env.RESEND_API_KEY || !process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO) return;
  const tick = () => {
    if (sweeping) return;
    sweeping = true;
    runDeletionDeadlineSweep().catch(() => 0).finally(() => { sweeping = false; });
  };
  setTimeout(tick, 60_000).unref?.();
  sweepTimer = setInterval(tick, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}
