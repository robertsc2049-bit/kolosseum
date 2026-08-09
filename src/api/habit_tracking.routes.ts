// DEV NOTE: FULL-UI-29 - athlete habit/streak routes, mounted at /habits.
// Athlete identity is resolved via a local authenticatedAthlete helper
// mirroring the identical pattern already duplicated in
// progress_photos.routes.ts and messaging.routes.ts. The coach-facing
// surface here is deliberately read-only - list only, via GET
// /habits/coach/:athlete_user_id - there is no POST/PUT/DELETE anywhere
// in this file reachable by a coach. A habit is the athlete's own report.

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
  HabitTrackingError,
  archiveHabitDefinition,
  createHabitDefinition,
  listHabitsForCoach,
  listHabitsWithStreaksForAthlete,
  logHabitCompletion
} from "./habit_tracking_service.js";

export const habitTrackingRouter = Router();

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

// Athlete self-service only - there is no equivalent coach-facing route.
habitTrackingRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await createHabitDefinition(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, habit: record });
  })
);

habitTrackingRouter.post(
  "/:habit_id/archive",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await archiveHabitDefinition(athleteUserId, String(request.params.habit_id));
    return response.status(200).json({ ok: true, habit: record });
  })
);

habitTrackingRouter.post(
  "/:habit_id/completions",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await logHabitCompletion(
      athleteUserId,
      String(request.params.habit_id),
      request.body ?? {}
    );
    return response.status(201).json({ ok: true, completion: record });
  })
);

habitTrackingRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const habits = await listHabitsWithStreaksForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, habits });
  })
);

// Coach-facing surface is read-only - list only, no POST/PUT/DELETE.
habitTrackingRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const habits = await listHabitsForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, habits });
  })
);

habitTrackingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof HabitTrackingError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
