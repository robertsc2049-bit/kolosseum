// DEV NOTE: Generic same-origin JSON transport shared by every screen's API
// client. Extracted from account_ui.js's request() logic (see client.ts's
// original DEV NOTE) when the second screen (coach athlete strength
// profile) needed the identical CSRF/session handling - centralising it here
// avoids the two clients' security-relevant header/credentials logic
// silently diverging over time.

export type JsonRecord = Record<string, unknown>;

export class ApiRequestError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
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
      record.error ?? record.reason ?? record.failure_token ?? `api_request_${response.status}`
    );
    throw new ApiRequestError(message, response.status, payload);
  }

  return isRecord(payload) ? payload : {};
}
