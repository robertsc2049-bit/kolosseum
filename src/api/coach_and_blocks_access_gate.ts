// DEV NOTE: The same rule as sessions_access_gate.ts for the remaining routes
// that took a user id from the request and trusted it with no sign-in:
// - /blocks/compile with an athlete or coach named (beta_user_id,
//   beta_coach_user_id) or a beta_path_context: the signed-in athlete must
//   be that athlete, with the CSRF header. Otherwise anyone could create
//   sessions owned by any athlete. An anonymous engine compile (no one
//   named) stays open;
// - /blocks/:block_id and /blocks/:block_id/sessions: a block whose sessions
//   belong to someone is that athlete's or their coach's;
// - /coach-workspace/reviews, /session-review/:id and
//   /athlete-assignment/:id/(replace|cancel): the coach named in the query or
//   body must be the signed-in coach, with the CSRF header for changes. The
//   handlers already check that coach's relationship with the athlete.
// KOLOSSEUM_SESSIONS_TEST_HARNESS=1 (never in production) lets tests that
// seed through these without a cookie keep doing so.

import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { pool } from "../db/pool.js";
import { asyncHandler } from "./async_handler.js";
import { cookieValue } from "./coach_session_auth.js";
import { forbidden } from "./http_errors.js";
import { PRODUCT_SESSION_COOKIE } from "./product_account_service.js";
import { accountRateLimitKey } from "./rate_limit_key.js";
import { sessionsTestHarnessEnabled, signedInUserId } from "./sessions_access_gate.js";

type JsonRecord = Record<string, unknown>;

// The gates read the database (the sign-in, a block's owners), so they are
// rate-limited per account (per address when signed out), generously enough
// for a coach's review screens and an athlete's sessions.
export const accessGateRateLimit = rateLimit({
  keyGenerator: accountRateLimitKey,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false
});

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function denied(token: string): never {
  throw forbidden("ACCESS_DENIED", { failure_token: token });
}

function harnessWithoutCookie(request: Request): boolean {
  return sessionsTestHarnessEnabled() && !cookieValue(request, PRODUCT_SESSION_COOKIE);
}

const BLOCK_PATH = /^\/([^/]+)(?:\/sessions)?$/u;

export const blocksAccessGate = asyncHandler(async (request: Request, _response: Response, next: NextFunction) => {
  if (harnessWithoutCookie(request)) return next();
  const path = request.path;
  const body: JsonRecord = isRecord(request.body) ? request.body : {};

  if (path === "/compile" && request.method === "POST") {
    const context = isRecord(body.beta_path_context) ? body.beta_path_context : null;
    const authUserId = context && isRecord(context.auth_record) ? context.auth_record.user_id : undefined;
    const names = body.beta_user_id !== undefined || body.beta_coach_user_id !== undefined || context !== null;
    if (!names) return next();
    const callerUserId = await signedInUserId(request, true);
    if (body.beta_user_id !== undefined && body.beta_user_id !== callerUserId) denied("compile_athlete_identity_mismatch");
    if (context !== null && authUserId !== callerUserId) denied("compile_athlete_identity_mismatch");
    if (body.beta_user_id === undefined && context === null) denied("compile_athlete_required");
    return next();
  }

  const match = BLOCK_PATH.exec(path);
  if (match && path !== "/compile") {
    let blockId = match[1];
    try { blockId = decodeURIComponent(blockId); }
    catch { return next(); }
    const owners = await pool.query(
      `SELECT DISTINCT beta_subject_user_id, beta_coach_user_id FROM sessions
       WHERE block_id = $1 AND (beta_subject_user_id IS NOT NULL OR beta_coach_user_id IS NOT NULL)`,
      [blockId]
    );
    if ((owners.rowCount ?? 0) === 0) return next();
    const callerUserId = await signedInUserId(request, request.method !== "GET" && request.method !== "HEAD");
    const allowed = owners.rows.some((row) => row.beta_subject_user_id === callerUserId || row.beta_coach_user_id === callerUserId);
    if (!allowed) denied("block_not_yours");
    return next();
  }

  return next();
});

const COACH_IDENTITY_PATH = /^\/(?:reviews|session-review\/[^/]+|athlete-assignment\/[^/]+\/(?:replace|cancel))$/u;

export const coachIdentityGate = asyncHandler(async (request: Request, _response: Response, next: NextFunction) => {
  if (!COACH_IDENTITY_PATH.test(request.path)) return next();
  if (harnessWithoutCookie(request)) return next();
  const read = request.method === "GET" || request.method === "HEAD";
  const callerUserId = await signedInUserId(request, !read);
  const source: JsonRecord = read
    ? (isRecord(request.query) ? (request.query as JsonRecord) : {})
    : (isRecord(request.body) ? request.body : {});
  if (source.coach_user_id !== callerUserId) denied("coach_identity_mismatch");
  return next();
});
