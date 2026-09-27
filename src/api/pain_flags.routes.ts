// DEV NOTE: Pain carry-forward, coach side, mounted at /pain-flags. A coach
// sees their athlete's open pain flags and can clear one (e.g. after
// assessing it in person). The coach's identity comes from their session
// and the coach-athlete relationship is re-checked on every request; a
// client-supplied coach id is never trusted.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { rateLimit } from "express-rate-limit";

import { authenticatedCoach } from "./coach_session_auth.js";
import { PainFlagError, clearPainFlagForCoach, getPainFlagsForCoach } from "./pain_flag_service.js";

export const painFlagsRouter = Router();

// Rate-limited like every newly-added authorising route (CodeQL
// js/missing-rate-limiting); generous enough for a coach reviewing a roster.
const painFlagsRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

painFlagsRouter.get(
  "/coach/:athlete_user_id",
  painFlagsRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    return response.status(200).json(await getPainFlagsForCoach(coachUserId, String(request.params.athlete_user_id)));
  })
);

painFlagsRouter.post(
  "/coach/:athlete_user_id/clear",
  painFlagsRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(200).json(await clearPainFlagForCoach(coachUserId, String(request.params.athlete_user_id), request.body));
  })
);

painFlagsRouter.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (error instanceof PainFlagError) {
    response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
    return;
  }
  next(error);
});
