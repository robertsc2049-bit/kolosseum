import { type JsonRecord } from "../api/transport";

// Fired after an athlete sends a coaching request, so their list on the
// Account page (AthleteCoachingRequestsPanel.tsx) refreshes.
export const COACHING_REQUESTS_CHANGED_EVENT = "kolosseum:coaching-requests-changed";

// "from 29 Nov 2026" from a coaching_request_recently_declined error, or "later".
export function askAgainText(error: unknown): string {
  const fieldErrors = (((error as { payload?: JsonRecord }).payload ?? {}).field_errors ?? {}) as JsonRecord;
  const date = new Date(String(fieldErrors.ask_again_from ?? ""));
  return Number.isNaN(date.getTime()) ? "later" : `from ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}
