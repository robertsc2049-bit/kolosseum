// DEV NOTE: Generic same-origin JSON transport shared by every screen's API
// client. Extracted from account_ui.js's request() logic (see client.ts's
// original DEV NOTE) when the second screen (coach athlete strength
// profile) needed the identical CSRF/session handling - centralising it here
// avoids the two clients' security-relevant header/credentials logic
// silently diverging over time.

import { friendlyErrorMessage } from "../utils/friendlyError";

export type JsonRecord = Record<string, unknown>;

export class ApiRequestError extends Error {
  readonly payload: unknown;
  readonly status: number;
  // The raw internal error/reason/failure_token from the response body -
  // what `.message` used to hold before it became friendly text. Kept for
  // the handful of screens that do their own extra-specific mapping.
  readonly code: string;

  constructor(code: string, status: number, payload: unknown) {
    super(friendlyErrorMessage(payload, status));
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : null;
  }
  catch {
    return { raw: text };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// DEV NOTE: unlike legacy's handleError()/buildFailureContextFromError()
// (app.js), most React hooks never re-surface a failed request's context
// anywhere a user could attach it to a support report - each just sets its
// own local, friendly inline error message and moves on. Every React
// screen's API call passes through this one shared request() though, so
// it's the single choke point to remember "what was the most recent
// failed request", mirroring the same {status, reason, method, path}
// shape useAccountSupport.ts's FailureContext (and the server's own
// buildFailureContext allowlist) already expect. See
// AccountSupportPanel.tsx's "Report a problem" button, the only reader.
export type CapturedRequestFailure = {
  status: number | null;
  reason: string;
  method: string;
  path: string;
};

let lastRequestFailure: (CapturedRequestFailure & { occurred_at_ms: number }) | null = null;
const LAST_FAILURE_RELEVANCE_MS = 2 * 60 * 1000;

function recordRequestFailure(method: string, path: string, status: number | null, reason: string): void {
  lastRequestFailure = { status, reason, method, path, occurred_at_ms: Date.now() };
}

// Only returns a failure recent enough that a user reporting "a problem"
// right now is plausibly still talking about it - an hour-old failure
// from a screen the user has long since left shouldn't be silently
// attached to an unrelated report.
export function getRecentRequestFailure(): CapturedRequestFailure | null {
  if (!lastRequestFailure) return null;
  if (Date.now() - lastRequestFailure.occurred_at_ms > LAST_FAILURE_RELEVANCE_MS) return null;
  const { occurred_at_ms: _occurredAtMs, ...context } = lastRequestFailure;
  return context;
}

// Test-only: this module's capture state is a process-lifetime singleton,
// so multiple tests within one file (sharing one module instance) need a
// way to isolate themselves from a failure an earlier test caused.
export function __resetRecentRequestFailureForTests(): void {
  lastRequestFailure = null;
}

export async function request(
  method: string,
  path: string,
  body?: JsonRecord,
  csrfToken = ""
): Promise<JsonRecord> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (csrfToken && method !== "GET" && method !== "HEAD") {
    headers["x-kolosseum-csrf"] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }
  catch (error) {
    recordRequestFailure(method, path, null, "network_error");
    throw error;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const record = isRecord(payload) ? payload : {};
    const code = String(
      record.error ?? record.reason ?? record.failure_token ?? `api_request_${response.status}`
    );
    recordRequestFailure(method, path, response.status, code);
    throw new ApiRequestError(code, response.status, payload);
  }

  return isRecord(payload) ? payload : {};
}
