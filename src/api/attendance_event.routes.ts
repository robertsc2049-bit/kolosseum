// DEV NOTE: Attendance events routes, mounted at /attendance-events.
// Coach routes resolve identity via authenticatedCoach (coach_session_auth.ts,
// the same shared boundary progress_insights.routes.ts/org_owner.routes.ts
// already use). Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in progress_insights.routes.ts/body_metrics.routes.ts/
// progress_photos.routes.ts/messaging.routes.ts - neither side ever
// trusts a client-supplied user_id.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  resolveProductSession
} from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import {
  AttendanceEventError,
  cancelAttendanceEvent,
  createAttendanceEventForCoach,
  getAttendanceEventForCoach,
  listAttendanceEventsForCoach,
  rescheduleAttendanceOccurrence,
  skipAttendanceOccurrence
} from "./attendance_event_service.js";
import {
  assertAthletesCurrentlyAccepted,
  inviteAthletesToAttendanceEvent
} from "./attendance_event_invite_service.js";
import {
  getAttendanceRosterForEvent,
  listMyAttendanceOccurrences,
  submitAttendanceRsvp
} from "./attendance_event_rsvp_service.js";
import {
  AttendanceEventOrgInviteError,
  assertOrgAthletesCurrentlyAccepted,
  listSharedOrgAcceptedAthletes,
  requireActiveSharedOrgMembership
} from "./attendance_event_org_invite_service.js";

export const attendanceEventRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

async function authenticatedAthlete(request: Request): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  try {
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete") {
      throw forbidden("ATHLETE_ACCOUNT_REQUIRED", { failure_token: "athlete_account_required" });
    }
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) {
        throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code });
      }
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: error.code });
    }
    throw error;
  }
}

attendanceEventRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const ownerScope = request.body?.owner_scope === "org" ? "org" : "coach";

    // Validate the invite list (and, for an org-wide event, the org
    // membership itself) is fully eligible BEFORE creating the event -
    // creating it first and only discovering an invalid invite list or
    // membership afterward would leave an orphaned event behind despite
    // the caller receiving an error response.
    const athleteUserIds = Array.isArray(request.body?.athlete_user_ids) ? request.body.athlete_user_ids : [];
    if (ownerScope === "org") {
      if (athleteUserIds.length > 0) {
        await assertOrgAthletesCurrentlyAccepted(coachUserId, request.body?.owner_org_id, athleteUserIds);
      }
      else {
        await requireActiveSharedOrgMembership(coachUserId, request.body?.owner_org_id);
      }
    }
    else if (athleteUserIds.length > 0) {
      await assertAthletesCurrentlyAccepted(coachUserId, athleteUserIds);
    }

    const created = await createAttendanceEventForCoach(coachUserId, request.body ?? {});

    const invites = athleteUserIds.length > 0
      ? await inviteAthletesToAttendanceEvent(coachUserId, created.event.event_id, athleteUserIds)
      : [];

    return response.status(201).json({
      ok: true,
      event: created.event,
      occurrences: created.occurrences,
      invites
    });
  })
);

attendanceEventRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const events = await listAttendanceEventsForCoach(coachUserId);
    return response.status(200).json({ ok: true, events });
  })
);

attendanceEventRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request);
    const occurrences = await listMyAttendanceOccurrences(athleteUserId);
    return response.status(200).json({ ok: true, occurrences });
  })
);

// Coach-facing read for the org-wide event-creation athlete picker -
// every currently-accepted athlete across the whole shared-mode org,
// gated by the same active-membership + shared-visibility check as
// event creation itself.
attendanceEventRouter.get(
  "/org-roster/:org_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const athletes = await listSharedOrgAcceptedAthletes(coachUserId, request.params.org_id);
    return response.status(200).json({ ok: true, athletes });
  })
);

attendanceEventRouter.get(
  "/:event_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const detail = await getAttendanceEventForCoach(coachUserId, request.params.event_id);
    const roster = await getAttendanceRosterForEvent(detail.event.event_id as string);
    return response.status(200).json({
      ok: true,
      event: detail.event,
      occurrences: detail.occurrences,
      roster
    });
  })
);

attendanceEventRouter.post(
  "/:event_id/cancel",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const event = await cancelAttendanceEvent(coachUserId, request.params.event_id);
    return response.status(200).json({ ok: true, event });
  })
);

attendanceEventRouter.post(
  "/:event_id/occurrences/:occurrence_id/skip",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const occurrence = await skipAttendanceOccurrence(coachUserId, request.params.event_id, request.params.occurrence_id);
    return response.status(200).json({ ok: true, occurrence });
  })
);

attendanceEventRouter.post(
  "/:event_id/occurrences/:occurrence_id/reschedule",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const occurrence = await rescheduleAttendanceOccurrence(
      coachUserId,
      request.params.event_id,
      request.params.occurrence_id,
      request.body ?? {}
    );
    return response.status(200).json({ ok: true, occurrence });
  })
);

attendanceEventRouter.post(
  "/occurrences/:occurrence_id/rsvp",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request);
    const rsvp = await submitAttendanceRsvp(athleteUserId, request.params.occurrence_id, request.body?.rsvp_state);
    return response.status(201).json({ ok: true, rsvp });
  })
);

attendanceEventRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof AttendanceEventError || error instanceof AttendanceEventOrgInviteError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
