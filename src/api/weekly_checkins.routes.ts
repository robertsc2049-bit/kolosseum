// DEV NOTE: FULL-UI-64 - athlete weekly check-in routes, mounted at
// /weekly-checkins. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in athlete_goals.routes.ts/habit_tracking.routes.ts - neither
// side ever trusts a client-supplied user_id. There is no coach write path
// here at all, mirroring athlete_goals.routes.ts - a check-in is the
// athlete's own self-report, never something a coach submits on their
// behalf.

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
  WeeklyCheckinError,
  listWeeklyCheckinsForAthlete,
  listWeeklyCheckinsForCoach,
  submitWeeklyCheckin
} from "./weekly_checkin_service.js";

export const weeklyCheckinsRouter = Router();

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

weeklyCheckinsRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await submitWeeklyCheckin(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, checkin: record });
  })
);

weeklyCheckinsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const checkins = await listWeeklyCheckinsForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, checkins });
  })
);

weeklyCheckinsRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const checkins = await listWeeklyCheckinsForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, checkins });
  })
);

weeklyCheckinsRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof WeeklyCheckinError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
