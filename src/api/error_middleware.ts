
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

// src/api/error_middleware.ts
import type { Request, Response, NextFunction } from "express";
import { mapUnknownErrorToHttp } from "./error_mapper.js";

export function apiErrorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const mapped = mapUnknownErrorToHttp(err);
  return res.status(mapped.status).json(mapped.body);
}
