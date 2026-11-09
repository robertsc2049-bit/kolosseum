// DEV NOTE: Server errors reach the admin instead of only the log.
// Every 5xx response the app sends is recorded (recordServerErrors, mounted
// first in server.ts, so it sees errors from every router and from the final
// error handler alike). runServerErrorDigest() then emails the admin
// (KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO): the first errors within minutes, then
// at most one email an hour while they continue. The admin console shows
// the last 24 hours (serverErrorSummary, /admin/system-status).
//
// Nothing personal is kept: no user id, no request body, no query string,
// no stack. The route has ids replaced by ":id", and the error code is kept
// only when it's a code token - an exception's free-text message (which can
// quote data, e.g. a database error) is replaced by the response's generic
// code. Rows are deleted after RETENTION_DAYS.
import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { sendAdminEmail } from "./support_alert_notifier.js";

export const DIGEST_GAP_MS = 60 * 60 * 1000;
export const RETENTION_DAYS = 30;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type QueryClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

const CODE_TOKEN = /^[A-Za-z0-9_.:-]{1,80}$/u;
const ID_SEGMENT = /^(?:\d+|(?=(?:[^\d]*\d){3})[A-Za-z0-9_.-]{8,})$/u;

// "/messages/thread_9f8e7d6c5b4a/read" -> "/messages/:id/read". Numbers,
// and 8+ character segments with at least 3 digits (generated ids, UUIDs,
// tokens), go; words like "coach_onboarding" or "e1rm-history" stay.
export function normaliseRoute(path: string): string {
  const clean = String(path || "/").split("?")[0].slice(0, 300);
  const segments = clean.split("/").map((segment) => {
    if (!segment || segment.startsWith(":")) return segment;
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch { /* keep as is */ }
    return ID_SEGMENT.test(decoded) || decoded.includes("@") ? ":id" : segment;
  });
  return segments.join("/") || "/";
}

// The code to keep: the response's `error` when it's a code token (e.g.
// "admin_two_step_unavailable"), otherwise its `code` (e.g. "INTERNAL"),
// otherwise "unknown". Never free text.
export function errorCodeFrom(body: unknown): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const value of [record.error, record.code]) {
      if (typeof value === "string" && CODE_TOKEN.test(value)) return value;
    }
  }
  return "unknown";
}

export async function recordServerError(event: { method: string; route: string; status: number; error_code: string }, client: QueryClient = pool): Promise<void> {
  await client.query(
    `INSERT INTO server_error_events (event_id, method, route, status, error_code) VALUES ($1, $2, $3, $4, $5)`,
    [`server_error_${globalThis.crypto.randomUUID().replaceAll("-", "")}`, event.method.slice(0, 10), event.route.slice(0, 300), event.status, event.error_code]
  );
}

// The matched route pattern with its full mount path, e.g.
// "/account/sessions/:session_id/sets". In the final error handler Express
// has already reset baseUrl, so the mount path is taken from the real URL:
// whatever comes before the pattern's own segments.
function matchedRoute(request: Request): string | null {
  const pattern = request.route?.path;
  if (typeof pattern !== "string" || !pattern.startsWith("/")) return null;
  const actual = String(request.originalUrl || request.url || "").split("?")[0].split("/");
  const own = pattern.split("/").length - 1; // segments after the leading "/"
  if (own > actual.length - 1) return null;
  const mount = actual.slice(0, actual.length - own).join("/");
  return normaliseRoute(`${mount}${pattern}`);
}

let warnedRecordFailure = false;

// Express middleware: notes the route and error code when a 5xx body is
// sent, and records it once the response has finished. Never affects the
// response; a failed insert is logged once, not thrown.
export function recordServerErrors(request: Request, response: Response, next: NextFunction): void {
  const json = response.json.bind(response);
  let route: string | null = null;
  let code = "unknown";
  response.json = (body?: unknown) => {
    if (response.statusCode >= 500) {
      route = matchedRoute(request);
      code = errorCodeFrom(body);
    }
    return json(body);
  };
  response.on("finish", () => {
    if (response.statusCode < 500) return;
    recordServerError({
      method: request.method,
      route: route ?? normaliseRoute(request.originalUrl || request.path),
      status: response.statusCode,
      error_code: code
    }).catch((error) => {
      if (warnedRecordFailure) return;
      warnedRecordFailure = true;
      // eslint-disable-next-line no-console
      console.error("WARN: could not record a server error", error instanceof Error ? error.message : error);
    });
  });
  next();
}

export type ServerErrorGroup = { method: string; route: string; status: number; error_code: string; count: number; first_at: string; last_at: string };

function mapGroup(row: any): ServerErrorGroup {
  return {
    method: row.method,
    route: row.route,
    status: Number(row.status),
    error_code: row.error_code,
    count: Number(row.count),
    first_at: new Date(row.first_at).toISOString(),
    last_at: new Date(row.last_at).toISOString()
  };
}

const GROUP_SELECT = `SELECT method, route, status, error_code, count(*) AS count, min(occurred_at) AS first_at, max(occurred_at) AS last_at FROM server_error_events`;
const GROUP_TAIL = `GROUP BY method, route, status, error_code ORDER BY count(*) DESC, max(occurred_at) DESC`;

export type ServerErrorSummary = { last_24h: number; last_at: string | null; groups: ServerErrorGroup[] };

// The last 24 hours, for the admin console: how many, the latest, and the
// five commonest kinds.
export async function serverErrorSummary(client: QueryClient = pool, now: Date = new Date()): Promise<ServerErrorSummary> {
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const groups = (await client.query(`${GROUP_SELECT} WHERE occurred_at > $1 ${GROUP_TAIL}`, [since])).rows.map(mapGroup);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const lastAt = groups.reduce<string | null>((latest, group) => (!latest || group.last_at > latest ? group.last_at : latest), null);
  return { last_24h: total, last_at: lastAt, groups: groups.slice(0, 5) };
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function serverErrorDigestEmail(groups: readonly ServerErrorGroup[]): { subject: string; lines: string[] } {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const firstAt = groups.reduce((first, group) => (group.first_at < first ? group.first_at : first), groups[0].first_at);
  const lines = [
    `The live app sent ${total} server error${total === 1 ? "" : "s"} since ${when(firstAt)}. Someone saw "something went wrong" each time.`,
    ""
  ];
  for (const group of groups.slice(0, 15)) {
    const times = group.count === 1 ? `at ${when(group.first_at)}` : `${when(group.first_at)} to ${when(group.last_at)}`;
    lines.push(`- ${group.method} ${group.route} - ${group.error_code} (${group.status}): ${group.count}, ${times}`);
  }
  if (groups.length > 15) lines.push(`- and ${groups.length - 15} other kinds`);
  lines.push(
    "",
    "The details are in the server log:",
    "docker compose -f docker-compose.prod.yml logs app --since 2h 2>&1 | grep -B2 -A20 ERROR_REPORT",
    "",
    "While errors continue you'll get at most one of these an hour. The admin console shows the last 24 hours."
  );
  return { subject: `Kolosseum: ${total} server error${total === 1 ? "" : "s"} on the live app`, lines };
}

export type AdminSender = (subject: string, lines: string[]) => Promise<void>;

// Emails errors not yet reported, unless one was sent within the last hour
// (they wait for the next email). Returns how many errors the email covered.
export async function runServerErrorDigest(options: { send?: AdminSender; now?: Date; client?: QueryClient } = {}): Promise<number> {
  const client = options.client ?? pool;
  const now = options.now ?? new Date();
  const send = options.send ?? ((subject, lines) => sendAdminEmail(subject, lines, "server error alert"));

  await client.query(`DELETE FROM server_error_events WHERE occurred_at < $1`, [new Date(now.getTime() - RETENTION_DAYS * 86_400_000)]);

  const lastSent = (await client.query(`SELECT max(alerted_at) AS last FROM server_error_events`)).rows[0]?.last;
  if (lastSent && now.getTime() - new Date(lastSent).getTime() < DIGEST_GAP_MS) return 0;

  const groups = (await client.query(`${GROUP_SELECT} WHERE alerted_at IS NULL AND occurred_at <= $1 ${GROUP_TAIL}`, [now])).rows.map(mapGroup);
  if (!groups.length) return 0;

  const { subject, lines } = serverErrorDigestEmail(groups);
  await send(subject, lines);
  const marked = await client.query(`UPDATE server_error_events SET alerted_at = $1 WHERE alerted_at IS NULL AND occurred_at <= $1`, [now]);
  return marked.rowCount ?? 0;
}

let digestTimer: ReturnType<typeof setInterval> | null = null;

// Every five minutes, so the first errors are reported quickly; the hourly
// gap above keeps it to one email an hour. Off without email configured
// (errors are still recorded and shown on the console).
export function startServerErrorDigests(): void {
  if (digestTimer || !process.env.RESEND_API_KEY || !process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO) return;
  const tick = () => {
    runServerErrorDigest().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("WARN: server error digest failed", error instanceof Error ? error.message : error);
    });
  };
  setTimeout(tick, 60_000).unref?.();
  digestTimer = setInterval(tick, CHECK_INTERVAL_MS);
  digestTimer.unref?.();
}
