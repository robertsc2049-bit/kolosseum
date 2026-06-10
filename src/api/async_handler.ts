
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

// src/api/async_handler.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
