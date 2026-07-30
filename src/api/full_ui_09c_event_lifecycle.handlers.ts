// DEV NOTE: FULL-UI-09C authenticated standalone event HTTP boundary.

import type { Request, Response } from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import {
  archiveStandaloneEvent,
  cancelStandaloneEvent,
  createStandaloneEventLifecycle,
  createStandaloneEventVersion,
  FullUi09cEventLifecycleError,
  linkAthleteToStandaloneEvent,
  loadStandaloneEventDetail,
  loadStandaloneEventLibrary
} from "./full_ui_09c_event_lifecycle_service.js";
import {
  unlinkAthleteFromStandaloneEventSafely
} from "./full_ui_09c_event_unlink_service.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized
} from "./http_errors.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cookieValue(request: Request, name: string): string {
  const header = String(request.headers.cookie ?? "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
    catch {
      return "";
    }
  }
  return "";
}

async function authenticatedCoach(
  request: Request,
  mutation: boolean
): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", {
      failure_token: "account_session_missing"
    });
  }

  try {
    if (mutation) {
      assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "coach") {
      throw forbidden("COACH_ACCOUNT_REQUIRED", {
        failure_token: "coach_account_required"
      });
    }
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) {
        throw unauthorized("ACCOUNT_SESSION_REQUIRED", {
          failure_token: error.code
        });
      }
      throw forbidden("ACCOUNT_ACTION_DENIED", {
        failure_token: error.code
      });
    }
    throw error;
  }
}

function lifecycleHttpError(error: unknown): never {
  if (!(error instanceof FullUi09cEventLifecycleError)) {
    throw error;
  }

  const details = {
    failure_token: "full_ui_09c_event_lifecycle_invalid",
    reason: error.reason
  };

  if (
    error.reason === "event_ownership_denied" ||
    error.reason === "relationship_access_denied" ||
    error.reason === "coach_access_denied"
  ) {
    throw forbidden("EVENT_ACCESS_DENIED", details);
  }
  if (
    error.reason === "event_not_found" ||
    error.reason === "event_link_not_found"
  ) {
    throw notFound("EVENT_RECORD_NOT_FOUND", details);
  }
  if (
    error.reason.includes("conflict") ||
    error.reason.includes("duplicate") ||
    error.reason === "event_already_exists" ||
    error.reason === "event_stale_write" ||
    error.reason === "event_not_active"
  ) {
    throw conflict("EVENT_STATE_CONFLICT", details);
  }
  throw badRequest("EVENT_LIFECYCLE_INVALID", details);
}

function bodyRecord(request: Request): JsonRecord {
  if (!isRecord(request.body)) {
    throw badRequest("EVENT_BODY_REQUIRED", {
      failure_token: "event_body_required"
    });
  }
  return request.body;
}

export async function getStandaloneEventLibraryHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, false);
    const events = await loadStandaloneEventLibrary(coachUserId, {
      search: cleanString(request.query.search),
      status: cleanString(request.query.status),
      activity_id: cleanString(request.query.activity_id),
      date_scope: cleanString(request.query.date_scope)
    });

    return response.status(200).json({
      ok: true,
      route_id: "coach_events",
      events,
      server_authoritative: true
    });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function createStandaloneEventHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const event = await createStandaloneEventLifecycle({
      ...bodyRecord(request),
      coach_user_id: coachUserId
    });
    return response.status(201).json({ ok: true, event });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function getStandaloneEventDetailHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, false);
    const detail = await loadStandaloneEventDetail(
      coachUserId,
      cleanString(request.params.event_id)
    );
    return response.status(200).json({ ok: true, detail });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function createStandaloneEventVersionHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const event = await createStandaloneEventVersion({
      ...bodyRecord(request),
      coach_user_id: coachUserId,
      event_id: cleanString(request.params.event_id)
    });
    return response.status(201).json({ ok: true, event });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function cancelStandaloneEventHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const event = await cancelStandaloneEvent({
      ...bodyRecord(request),
      coach_user_id: coachUserId,
      event_id: cleanString(request.params.event_id)
    });
    return response.status(200).json({ ok: true, event });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function archiveStandaloneEventHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const event = await archiveStandaloneEvent({
      ...bodyRecord(request),
      coach_user_id: coachUserId,
      event_id: cleanString(request.params.event_id)
    });
    return response.status(200).json({ ok: true, event });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function linkStandaloneEventAthleteHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await linkAthleteToStandaloneEvent({
      ...bodyRecord(request),
      coach_user_id: coachUserId,
      event_id: cleanString(request.params.event_id),
      athlete_user_id: cleanString(request.params.athlete_id)
    });
    return response.status(201).json({ ok: true, ...result });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}

export async function unlinkStandaloneEventAthleteHandler(
  request: Request,
  response: Response
) {
  try {
    const coachUserId = await authenticatedCoach(request, true);
    const link = await unlinkAthleteFromStandaloneEventSafely({
      coach_user_id: coachUserId,
      event_id: cleanString(request.params.event_id),
      athlete_user_id: cleanString(request.params.athlete_id)
    });
    return response.status(200).json({ ok: true, link });
  }
  catch (error) {
    lifecycleHttpError(error);
  }
}
