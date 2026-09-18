
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

// src/api/error_middleware.ts
import type { Request, Response, NextFunction } from "express";
import { mapUnknownErrorToHttp } from "./error_mapper.js";
import { createErrorReportEvent } from "../v1ErrorReportingInitialisation.mjs";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// S-V1-O-02: builds a local, sanitised error-report envelope only (no
// provider SDK, no network send - see src/v1ErrorReportingInitialisation.mjs)
// and logs it so platform log aggregation can surface it. Never throws: a
// rejected envelope is logged as a warning rather than affecting the response.
function reportApiError(req: Request, status: number, message: string, details: unknown) {
  const event = createErrorReportEvent({
    error_id: globalThis.crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    event_type: "api_handler_error",
    severity: status >= 500 ? "error" : "warning",
    product_surface: req.path,
    message,
    details: isPlainObject(details) ? details : {}
  });

  // eslint-disable-next-line no-console
  console.error(
    event.ok
      ? `ERROR_REPORT ${event.error_report_event_id}`
      : `WARN: error reporting event rejected input (${event.code})`,
    event
  );
}

export function apiErrorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const mapped = mapUnknownErrorToHttp(err);
  reportApiError(req, mapped.status, mapped.body.error, mapped.body.details);
  return res.status(mapped.status).json(mapped.body);
}
