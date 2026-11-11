// DEV NOTE: Access gate for everything mounted at /sessions (sessions.routes.ts
// and beta17_coach_note_write.routes.ts). Those routes take an athlete's or
// coach's user id from the request body, or a session id from the path, and
// trusted it - with no sign-in, anyone holding an id could read an athlete's
// training history or write events into their session. Here the caller is
// always the signed-in account (product session cookie), changes need the
// CSRF header, and:
// - athlete reads (Today, history, export) are the athlete's own;
// - coach routes name the signed-in coach, and notes need an accepted
//   relationship with the athlete; a coach can only invite or revoke - never
//   mark a relationship accepted or declined (the athlete does that, signed
//   in, through relationship_invitation_service.ts);
// - a session's own routes are its athlete's or its coach's. A session with
//   no owner at all (an anonymous engine session from /blocks/compile, as the
//   engine lifecycle tests make) holds nothing personal and stays open;
// - the early beta test-harness routes, used by no screen, are not served
//   unless KOLOSSEUM_SESSIONS_TEST_HARNESS=1 outside production. The same
//   switch lets the BETA-E2E-01 journey tests call routes without a cookie.

import type { NextFunction, Request, Response } from "express";

import { asyncHandler } from "./async_handler.js";
import { cookieValue } from "./coach_session_auth.js";
import { forbidden, notFound, unauthorized } from "./http_errors.js";
import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import { loadSessionOwnership } from "./sessions.summary.adapters.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type JsonRecord = Record<string, unknown>;

const HARNESS_ONLY_PATHS: ReadonlySet<string> = new Set([
  "/beta-auth",
  "/beta-acknowledgement",
  "/beta-declaration",
  "/beta-coach-profile",
  "/beta-coach-assignment",
  "/plan"
]);

// Read-only POSTs the clients send without a CSRF header.
const ATHLETE_READ_PATHS: ReadonlySet<string> = new Set([
  "/beta-athlete-today",
  "/beta-athlete-history",
  "/beta-athlete-history-detail",
  "/beta-athlete-history-export"
]);

const COACH_PATHS: Readonly<Record<string, { mutation: boolean }>> = Object.freeze({
  "/beta-coach-artefacts": { mutation: false },
  "/beta-coach-relationship": { mutation: true },
  "/beta-coach-notes": { mutation: true }
});

const COACH_RELATIONSHIP_STATES: ReadonlySet<string> = new Set(["invited", "revoked"]);

const SESSION_PATH = /^\/([^/]+)\/(state|events|start|substitution-request|substitution-options|summary)$/u;

export function sessionsTestHarnessEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.KOLOSSEUM_SESSIONS_TEST_HARNESS === "1";
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function signedInUserId(request: Request, mutation: boolean): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }
  try {
    if (mutation) assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    const session = await resolveProductSession(rawToken);
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code });
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: error.code });
    }
    throw error;
  }
}

function denied(token: string): never {
  throw forbidden("SESSIONS_ACCESS_DENIED", { failure_token: token });
}

// Every coach id the body names - top level, in the coach profile and in the
// relationship object - must be the signed-in coach.
function assertCoachIdentity(body: JsonRecord, callerUserId: string): void {
  const named = [
    body.coach_user_id,
    isRecord(body.coach_profile) ? body.coach_profile.coach_user_id : undefined,
    isRecord(body.relationship) ? body.relationship.coach_user_id : undefined
  ].filter((value) => value !== undefined);
  if (named.length === 0 || named.some((value) => value !== callerUserId)) denied("sessions_coach_identity_mismatch");
}

async function assertCoachHasAthlete(coachUserId: string, athleteUserId: unknown): Promise<void> {
  if (typeof athleteUserId !== "string" || !athleteUserId) denied("sessions_athlete_required");
  try {
    await requireCoachAthleteAccess(coachUserId, athleteUserId);
  }
  catch {
    denied("sessions_coach_relationship_required");
  }
}

export const sessionsAccessGate = asyncHandler(async (request: Request, _response: Response, next: NextFunction) => {
  const path = request.path;
  const harness = sessionsTestHarnessEnabled();
  const body: JsonRecord = isRecord(request.body) ? request.body : {};

  if (HARNESS_ONLY_PATHS.has(path) || path.startsWith("/decision-summary/")) {
    if (!harness) throw notFound("Not found");
    return next();
  }
  if (harness && !cookieValue(request, PRODUCT_SESSION_COOKIE)) return next();

  if (ATHLETE_READ_PATHS.has(path)) {
    const callerUserId = await signedInUserId(request, false);
    if (body.athlete_user_id !== callerUserId) denied("sessions_athlete_identity_mismatch");
    return next();
  }

  const coachPath = COACH_PATHS[path];
  if (coachPath) {
    const callerUserId = await signedInUserId(request, coachPath.mutation);
    assertCoachIdentity(body, callerUserId);
    if (path === "/beta-coach-relationship") {
      const state = body.relationship_state;
      if (typeof state !== "string" || !COACH_RELATIONSHIP_STATES.has(state)) denied("sessions_coach_can_only_invite");
    }
    if (path === "/beta-coach-notes") await assertCoachHasAthlete(callerUserId, body.athlete_user_id);
    return next();
  }

  const match = SESSION_PATH.exec(path);
  if (match) {
    let sessionId = match[1];
    try { sessionId = decodeURIComponent(sessionId); }
    catch { return next(); }
    const ownership = await loadSessionOwnership(sessionId);
    if (!ownership) return next();
    const subject = ownership.beta_subject_user_id ?? null;
    const coach = ownership.beta_coach_user_id ?? null;
    if (!subject && !coach) return next();
    const callerUserId = await signedInUserId(request, request.method === "POST");
    if (callerUserId !== subject && callerUserId !== coach) denied("sessions_not_your_session");
    return next();
  }

  return next();
});
