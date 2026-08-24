// DEV NOTE: FULL-UI-02 browser account transport (React port).
// This module transports account state only and cannot mutate engine law.
// Ported from public/app/account_ui.js's request() - identical CSRF/session
// semantics (credentials: "same-origin", x-kolosseum-csrf on non-GET
// requests), independent of the legacy app.js module scope by design so
// this React island never reaches into legacy private state.

export type JsonRecord = Record<string, unknown>;

export class AccountRequestError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AccountRequestError";
    this.status = status;
    this.payload = payload;
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

async function request(
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

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const record = isRecord(payload) ? payload : {};
    const message = String(
      record.error ?? record.reason ?? record.failure_token ?? `account_request_${response.status}`
    );
    throw new AccountRequestError(message, response.status, payload);
  }

  return isRecord(payload) ? payload : {};
}

export function loadAccountDetail(): Promise<JsonRecord> {
  return request("GET", "/account/detail");
}

export function updateAccountProfile(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/profile", input, csrfToken);
}

export function changeAccountPassword(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/password/change", input, csrfToken);
}

export function requestEmailVerification(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/email-verification/request", {}, csrfToken);
}

export function completeEmailVerification(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/email-verification/complete", input, csrfToken);
}
