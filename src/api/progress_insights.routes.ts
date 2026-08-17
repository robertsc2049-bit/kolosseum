// DEV NOTE: FULL-UI-36 Progress Insights routes, mounted at
// /progress-insights. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in body_metrics.routes.ts/progress_photos.routes.ts/
// messaging.routes.ts - neither side ever trusts a client-supplied
// user_id. Both routes are read-only (GET only): this slice persists
// nothing new.

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
  ProgressInsightsError,
  getProgressInsightsForAthlete,
  getProgressInsightsForCoach
} from "./progress_insights_service.js";

export const progressInsightsRouter = Router();

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

progressInsightsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request);
    const insights = await getProgressInsightsForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, insights });
  })
);

progressInsightsRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const insights = await getProgressInsightsForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, insights });
  })
);

progressInsightsRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof ProgressInsightsError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
