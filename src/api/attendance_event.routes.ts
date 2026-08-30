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
  listAttendanceEventsForCoach
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

    // Validate the invite list is fully eligible BEFORE creating the
    // event - creating it first and only discovering an invalid invite
    // list afterward would leave an orphaned, invite-less event behind
    // despite the caller receiving an error response.
    const athleteUserIds = Array.isArray(request.body?.athlete_user_ids) ? request.body.athlete_user_ids : [];
    if (athleteUserIds.length > 0) {
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
  "/occurrences/:occurrence_id/rsvp",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request);
    const rsvp = await submitAttendanceRsvp(athleteUserId, request.params.occurrence_id, request.body?.rsvp_state);
    return response.status(201).json({ ok: true, rsvp });
  })
);

attendanceEventRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof AttendanceEventError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
