// DEV NOTE: Medical stand-down, coach side, mounted at /stand-down. A coach
// sees, records or ends (once medically cleared) their own athlete's
// stand-down; the relationship is re-checked on every request.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { rateLimit } from "express-rate-limit";

import { authenticatedCoach } from "./coach_session_auth.js";
import {
  StandDownError,
  describeStandDownForCoach,
  endStandDownForCoach,
  recordStandDownForCoach
} from "./medical_stand_down_service.js";

export const standDownRouter = Router();

// Rate-limited like every newly-added authorising route (CodeQL
// js/missing-rate-limiting).
const standDownRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;
function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

standDownRouter.get(
  "/coach/:athlete_user_id",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    return response.status(200).json(await describeStandDownForCoach(coachUserId, String(request.params.athlete_user_id)));
  })
);

standDownRouter.post(
  "/coach/:athlete_user_id",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(200).json(await recordStandDownForCoach(coachUserId, String(request.params.athlete_user_id), request.body));
  })
);

standDownRouter.post(
  "/coach/:athlete_user_id/end",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(200).json(await endStandDownForCoach(coachUserId, String(request.params.athlete_user_id), request.body));
  })
);

standDownRouter.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (error instanceof StandDownError) {
    response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
    return;
  }
  next(error);
});
