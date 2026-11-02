// DEV NOTE: Check-in call routes (coach_checkin_service.ts), mounted at
// /check-ins. Coach routes resolve the coach from their session
// (authenticatedCoach); athlete routes resolve the athlete the same way -
// neither trusts a client-supplied user id for who is acting.
import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { PRODUCT_SESSION_COOKIE, ProductAccountError, assertProductCsrf, resolveProductSession } from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import { accountRateLimitKey } from "./rate_limit_key.js";
import {
  CoachCheckinError,
  cancelCheckin,
  getCoachCallSettings,
  listAthleteCheckins,
  listCoachCheckinsForAthlete,
  moveCheckin,
  respondToCheckin,
  saveCoachCallSettings,
  scheduleCheckin
} from "./coach_checkin_service.js";

export const coachCheckinRouter = Router();

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

async function authenticatedAthlete(request: Request, mutation: boolean): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  try {
    if (mutation) assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete") throw forbidden("ATHLETE_ACCOUNT_REQUIRED", { failure_token: "athlete_account_required" });
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

const readLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const writeLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// How the coach's athletes reach them for a call.
coachCheckinRouter.get("/call-settings", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await getCoachCallSettings(coachUserId));
}));

coachCheckinRouter.put("/call-settings", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await saveCoachCallSettings(coachUserId, request.body));
}));

// The coach's check-ins with one athlete, and booking new ones.
coachCheckinRouter.get("/athletes/:athlete_user_id", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await listCoachCheckinsForAthlete(coachUserId, request.params.athlete_user_id));
}));

coachCheckinRouter.post("/", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(201).json(await scheduleCheckin(coachUserId, request.body));
}));

coachCheckinRouter.post("/:checkin_id/cancel", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await cancelCheckin(coachUserId, String(request.params.checkin_id), request.body));
}));

coachCheckinRouter.post("/:checkin_id/move", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await moveCheckin(coachUserId, String(request.params.checkin_id), request.body));
}));

// The athlete's upcoming check-ins, and confirming or asking to move one.
coachCheckinRouter.get("/mine", readLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, false);
  return response.status(200).json(await listAthleteCheckins(athleteUserId));
}));

coachCheckinRouter.post("/:checkin_id/respond", writeLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, true);
  return response.status(200).json(await respondToCheckin(athleteUserId, String(request.params.checkin_id), request.body));
}));

coachCheckinRouter.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (error instanceof CoachCheckinError) {
    response.status(error.status).json({ ok: false, error: error.code, field_errors: error.fieldErrors });
    return;
  }
  next(error);
});
