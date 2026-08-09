// DEV NOTE: FULL-UI-29 - athlete body-metric routes, mounted at
// /body-metrics. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in progress_photos.routes.ts and messaging.routes.ts -
// neither side ever trusts a client-supplied user_id. Unlike progress
// photos, an accepted coach DOES have a write path here (logging a
// body-metric entry on the athlete's behalf) - the service layer, not
// this router, is what forces source to "coach_entered" for that path.

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
  BodyMetricsError,
  listBodyMetricHistoryForAthlete,
  listBodyMetricHistoryForCoach,
  logBodyMetricEntryAsAthlete,
  logBodyMetricEntryAsCoach
} from "./body_metrics_service.js";

export const bodyMetricsRouter = Router();

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

bodyMetricsRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await logBodyMetricEntryAsAthlete(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, entry: record });
  })
);

bodyMetricsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const entries = await listBodyMetricHistoryForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, entries });
  })
);

bodyMetricsRouter.post(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const record = await logBodyMetricEntryAsCoach(
      coachUserId,
      String(request.params.athlete_user_id),
      request.body ?? {}
    );
    return response.status(201).json({ ok: true, entry: record });
  })
);

bodyMetricsRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const entries = await listBodyMetricHistoryForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, entries });
  })
);

bodyMetricsRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof BodyMetricsError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
