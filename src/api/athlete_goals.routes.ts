// DEV NOTE: FULL-UI-37 - athlete goal-setting routes, mounted at
// /athlete-goals. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in body_metrics.routes.ts/habit_tracking.routes.ts - neither
// side ever trusts a client-supplied user_id. There is no coach write
// path here at all, mirroring habit_tracking.routes.ts - a goal is the
// athlete's own declared target, never something a coach sets or
// resolves on their behalf.

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
  AthleteGoalsError,
  createAthleteGoal,
  listAthleteGoalsForAthlete,
  listAthleteGoalsForCoach,
  resolveAthleteGoal
} from "./athlete_goals_service.js";

export const athleteGoalsRouter = Router();

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

athleteGoalsRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await createAthleteGoal(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, goal: record });
  })
);

athleteGoalsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const goals = await listAthleteGoalsForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, goals });
  })
);

athleteGoalsRouter.post(
  "/:goal_id/resolve",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await resolveAthleteGoal(
      athleteUserId,
      String(request.params.goal_id),
      request.body ?? {}
    );
    return response.status(200).json({ ok: true, goal: record });
  })
);

athleteGoalsRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const goals = await listAthleteGoalsForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, goals });
  })
);

athleteGoalsRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof AthleteGoalsError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
