// DEV NOTE: The pure parts of server error alerts (server_error_alerts.ts):
// how a route and an error code are kept without anything personal, and
// what the admin's email says. No database import, so unit tests can load it.

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

export type ServerErrorGroup = { method: string; route: string; status: number; error_code: string; count: number; first_at: string; last_at: string };

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
