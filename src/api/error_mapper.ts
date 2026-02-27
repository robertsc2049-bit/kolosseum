// src/api/error_mapper.ts
import { ApiError, type ApiErrorBody } from "./http_errors.js";

type Mapped = { status: number; body: ApiErrorBody };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pgMessage(err: unknown): string {
  if (isRecord(err)) {
    const detail = err["detail"];
    const msg = err["message"];
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

// Postgres / node-postgres error codes (best-effort mapping)
// Keep conservative: do not leak internals; message is already sanitized by pgMessage().
function mapPgError(err: unknown): Mapped | null {
  if (!isRecord(err)) return null;

  const code = err["code"];
  if (typeof code !== "string" || code.length === 0) return null;

  const message = pgMessage(err);

  // Unique violation
  if (code === "23505") {
    return { status: 409, body: { ok: false, code: "PG_UNIQUE_VIOLATION", error: message } };
  }

  // Foreign key violation
  if (code === "23503") {
    return { status: 409, body: { ok: false, code: "PG_FK_VIOLATION", error: message } };
  }

  // Not-null violation
  if (code === "23502") {
    return { status: 400, body: { ok: false, code: "PG_NOT_NULL_VIOLATION", error: message } };
  }

  // Check violation
  if (code === "23514") {
    return { status: 400, body: { ok: false, code: "PG_CHECK_VIOLATION", error: message } };
  }

  // Invalid text representation (e.g. uuid parse)
  if (code === "22P02") {
    return { status: 400, body: { ok: false, code: "PG_INVALID_TEXT_REPRESENTATION", error: message } };
  }

  // Undefined table/column/etc.
  if (code === "42P01") {
    return { status: 500, body: { ok: false, code: "PG_UNDEFINED_TABLE", error: "Database schema missing/invalid" } };
  }

  // Serialization failure / deadlock
  if (code === "40001") {
    return { status: 503, body: { ok: false, code: "PG_SERIALIZATION_FAILURE", error: "Database busy; retry" } };
  }
  if (code === "40P01") {
    return { status: 503, body: { ok: false, code: "PG_DEADLOCK", error: "Database busy; retry" } };
  }

  // Fallback: treat as 400 only if it's clearly caller-caused; otherwise 500.
  return { status: 500, body: { ok: false, code: "PG_ERROR", error: message } };
}

export function mapUnknownErrorToHttp(err: unknown): Mapped {
  // Our explicit typed error
  if (err instanceof ApiError) {
    return { status: err.status, body: err.toBody() };
  }

  // PG mapping (best-effort)
  const pg = mapPgError(err);
  if (pg) return pg;

  // Generic Error
  if (err instanceof Error) {
    return { status: 500, body: { ok: false, code: "INTERNAL", error: err.message } };
  }

  // Unknown
  return { status: 500, body: { ok: false, code: "INTERNAL", error: String(err) } };
}