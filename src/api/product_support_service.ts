// DEV NOTE: FULL-UI-20 factual status, support and error-reporting surface.
// A support report captures only an explicit, narrow allowlist of caller-
// supplied context fields - this module never accepts or stores a raw
// error payload or any other unbounded caller-supplied blob, regardless of
// what a caller sends. Retry/recovery decisions are made entirely by the
// client; the server never re-runs anything on the caller's behalf.

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isIso8601(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const asString = cleanString(value);
  return asString || new Date(0).toISOString();
}

export class ProductSupportError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProductSupportError";
    this.status = status;
  }
}

const supportReportInputKeys = new Set([
  "correlation_id",
  "route_hash",
  "occurred_at_iso8601",
  "description",
  "browser_context",
  "failure_context"
]);

const allowedFailureMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

// Explicit allowlist - only these fields are ever read out of the client's
// browser_context object. Anything else the client sends is simply never
// looked at, let alone stored, no matter how sensitive.
function buildBrowserContext(input: unknown): JsonRecord {
  if (!isRecord(input)) return {};

  const width = Number(input.viewport_width);
  const height = Number(input.viewport_height);
  const offset = Number(input.timezone_offset_minutes);

  return {
    user_agent: cleanString(input.user_agent).slice(0, 300),
    language: cleanString(input.language).slice(0, 20),
    viewport_width: Number.isFinite(width) ? Math.trunc(width) : null,
    viewport_height: Number.isFinite(height) ? Math.trunc(height) : null,
    timezone_offset_minutes: Number.isFinite(offset) ? Math.trunc(offset) : null
  };
}

// Explicit allowlist for the failed request this report may be attached
// to - a status code, a short reason code, an HTTP method restricted to a
// closed set, and a path. Never a full response body or header set.
function buildFailureContext(input: unknown): JsonRecord {
  if (!isRecord(input) || Object.keys(input).length === 0) return {};

  const statusValue = Number(input.status);
  const method = cleanString(input.method).toUpperCase();
  const path = cleanString(input.path);
  const safeMethod = allowedMethods(method) ? method : null;
  const safePath = path.startsWith("/") ? path.slice(0, 300) : null;

  return {
    status: Number.isInteger(statusValue) ? statusValue : null,
    reason: cleanString(input.reason).slice(0, 200) || null,
    method: safeMethod,
    path: safePath,
    // A retry is only ever offered for a safe read - never a mutation.
    retryable: safeMethod === "GET" && safePath !== null
  };
}

function allowedMethods(method: string): boolean {
  return allowedFailureMethods.has(method);
}

function toPublicReport(row: JsonRecord): Readonly<JsonRecord> {
  return Object.freeze({
    correlation_id: cleanString(row.correlation_id),
    route_hash: cleanString(row.route_hash),
    occurred_at_iso8601: toIso(row.occurred_at),
    description: cleanString(row.description),
    browser_context: isRecord(row.browser_context) ? row.browser_context : {},
    failure_context: isRecord(row.failure_context) ? row.failure_context : {},
    status: cleanString(row.status) || "submitted",
    created_at_iso8601: toIso(row.created_at)
  });
}

export async function createSupportReport(
  userId: string,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!userId) {
    throw new ProductSupportError("support_report_user_required", 401);
  }
  if (!isRecord(inputValue)) {
    throw new ProductSupportError("support_report_input_invalid");
  }

  for (const key of Object.keys(inputValue)) {
    if (!supportReportInputKeys.has(key)) {
      throw new ProductSupportError("support_report_unknown_field");
    }
  }

  const correlationId = cleanString(inputValue.correlation_id);
  if (!/^[a-zA-Z0-9-]{8,64}$/u.test(correlationId)) {
    throw new ProductSupportError("support_report_correlation_id_invalid");
  }

  if (!isIso8601(inputValue.occurred_at_iso8601)) {
    throw new ProductSupportError("support_report_timestamp_invalid");
  }

  const description = cleanString(inputValue.description);
  if (!description || description.length > 4000) {
    throw new ProductSupportError("support_report_description_invalid");
  }

  const routeHash = cleanString(inputValue.route_hash).slice(0, 300) || "#/";
  const browserContext = buildBrowserContext(inputValue.browser_context);
  const failureContext = buildFailureContext(inputValue.failure_context);

  const existing = await pool.query(
    `SELECT * FROM product_support_requests WHERE correlation_id = $1`,
    [correlationId]
  );

  if (existing.rows[0]) {
    if (cleanString(existing.rows[0].user_id) !== userId) {
      throw new ProductSupportError("support_report_correlation_id_conflict", 409);
    }
    return toPublicReport(existing.rows[0]);
  }

  const inserted = await pool.query(
    `
    INSERT INTO product_support_requests (
      correlation_id,
      user_id,
      route_hash,
      occurred_at,
      description,
      browser_context,
      failure_context
    )
    VALUES ($1,$2,$3,$4::timestamptz,$5,$6::jsonb,$7::jsonb)
    ON CONFLICT (correlation_id) DO NOTHING
    RETURNING *
    `,
    [
      correlationId,
      userId,
      routeHash,
      inputValue.occurred_at_iso8601,
      description,
      JSON.stringify(browserContext),
      JSON.stringify(failureContext)
    ]
  );

  const row =
    inserted.rows[0] ??
    (
      await pool.query(
        `SELECT * FROM product_support_requests WHERE correlation_id = $1`,
        [correlationId]
      )
    ).rows[0];

  if (!row) {
    throw new ProductSupportError("support_report_persist_readback_failed", 500);
  }

  return toPublicReport(row);
}

export async function listSupportReportsForUser(
  userId: string
): Promise<readonly Readonly<JsonRecord>[]> {
  if (!userId) {
    throw new ProductSupportError("support_report_user_required", 401);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM product_support_requests
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 200
    `,
    [userId]
  );

  return Object.freeze(result.rows.map(toPublicReport));
}
