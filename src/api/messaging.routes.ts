// DEV NOTE: Part D.1 - coach<->athlete messaging routes, mounted at
// /messages. Coach identity is resolved via the shared authenticatedCoach
// guard (coach_session_auth.ts). Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in coach_workspace.handlers.ts:454-478 - neither side ever
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
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import {
  CoachAthleteMessagingError,
  listCoachAthleteThreadMessages,
  listCoachAthleteThreads,
  sendCoachAthleteMessage
} from "./coach_athlete_messaging_service.js";

export const messagingRouter = Router();

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

async function authenticatedAthlete(request: Request, mutation: boolean): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  try {
    if (mutation) {
      assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
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

messagingRouter.get(
  "/coach/threads",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const threads = await listCoachAthleteThreads(coachUserId, "coach");
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/coach/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const messages = await listCoachAthleteThreadMessages(String(request.params.thread_id), coachUserId, "coach");
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.post(
  "/coach/athletes/:athlete_user_id/send",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await sendCoachAthleteMessage(
      "coach",
      coachUserId,
      String(request.params.athlete_user_id),
      request.body?.body_text,
      request.body?.client_request_id
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

messagingRouter.get(
  "/athlete/threads",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const threads = await listCoachAthleteThreads(athleteUserId, "athlete");
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/athlete/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const messages = await listCoachAthleteThreadMessages(String(request.params.thread_id), athleteUserId, "athlete");
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.post(
  "/athlete/coaches/:coach_user_id/send",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const result = await sendCoachAthleteMessage(
      "athlete",
      athleteUserId,
      String(request.params.coach_user_id),
      request.body?.body_text,
      request.body?.client_request_id
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

// CoachAthleteMessagingError is not an ApiError, so without this
// router-scoped handler it would otherwise reach the generic error
// mapper, which mistakes the string message for a Postgres error code and
// returns a misleading 500 instead of the correct status (mirrors the
// identical, deliberate pattern in product_admin.routes.ts / org_owner.routes.ts).
messagingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (!(error instanceof CoachAthleteMessagingError)) {
      next(error);
      return;
    }
    response.status(error.status).json({ error: error.message });
  }
);
