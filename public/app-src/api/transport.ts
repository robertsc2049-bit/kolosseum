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

// Reads are shared. Each screen fetches what it needs on its own, so one
// page load used to send the same read dozens of times (GET /account/detail
// 45-65 times) - a slow first load on a phone. An identical read already in
// flight is shared, and a just-finished one is reused for a moment. Any other
// request (a change) clears them, so a read after a change always goes to the
// server. Each caller gets its own copy of the answer.
const READ_ONLY_POSTS = new Set(["/sessions/beta-athlete-today", "/sessions/beta-athlete-history"]);
const DEFAULT_READ_REUSE_MS = 1500;
type SharedRead = { promise: Promise<JsonRecord>; settledAt: number | null };
const sharedReads = new Map<string, SharedRead>();

function readKey(method: string, path: string, body?: JsonRecord): string | null {
  if (method === "GET" || method === "HEAD") return `${method} ${path}`;
  if (method === "POST" && READ_ONLY_POSTS.has(path)) return `POST ${path} ${JSON.stringify(body ?? null)}`;
  return null;
}

// Tests swap their mocked responses between calls, so they set this to 0.
function readReuseMs(): number {
  const configured = (globalThis as { __KOLOSSEUM_READ_REUSE_MS__?: number }).__KOLOSSEUM_READ_REUSE_MS__;
  return typeof configured === "number" ? configured : DEFAULT_READ_REUSE_MS;
}

// Changes made outside this transport (the legacy app's own requests) say so
// with this event.
globalThis.document?.addEventListener?.("kolosseum:data-changed", () => sharedReads.clear());

export function __resetSharedReadsForTests(): void {
  sharedReads.clear();
}

export async function request(
  method: string,
  path: string,
  body?: JsonRecord,
  csrfToken = ""
): Promise<JsonRecord> {
  const key = readKey(method, path, body);
  if (key === null) {
    sharedReads.clear();
    try {
      return await send(method, path, body, csrfToken);
    }
    finally {
      sharedReads.clear();
    }
  }
  const existing = sharedReads.get(key);
  if (existing && (existing.settledAt === null || Date.now() - existing.settledAt < readReuseMs())) {
    return structuredClone(await existing.promise);
  }
  const entry: SharedRead = { promise: send(method, path, body, csrfToken), settledAt: null };
  sharedReads.set(key, entry);
  entry.promise.then(
    () => { entry.settledAt = Date.now(); },
    () => { if (sharedReads.get(key) === entry) sharedReads.delete(key); }
  );
  return structuredClone(await entry.promise);
}

async function send(
  method: string,
  path: string,
  body: JsonRecord | undefined,
  csrfToken: string
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
