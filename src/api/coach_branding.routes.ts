// DEV NOTE: FULL-UI-65 - coach branding preference routes, mounted at
// /coach-branding. Coach identity is resolved via the shared
// authenticatedCoach helper (coach_session_auth.js) - never a
// client-supplied user_id. There is no athlete-facing route here at all;
// an athlete reads their coach's brand preference through the existing
// relationship endpoint (relationship_invitation_service.ts's
// withCoachDisplay), the same access path already used for coach_display_
// name/coach_email.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { rateLimit } from "express-rate-limit";

import { authenticatedCoach } from "./coach_session_auth.js";
import { accountRateLimitKey } from "./rate_limit_key.js";
import { searchGyms } from "./gym_listing_service.js";
import { addCoachGym, CoachGymError, linkCoachGym, listCoachGyms, removeCoachGym } from "./coach_gym_service.js";
import {
  CoachBrandingError,
  loadCoachBrandPreference,
  saveCoachBrandPreference
} from "./coach_branding_service.js";

export const coachBrandingRouter = Router();

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

coachBrandingRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const record = await saveCoachBrandPreference(coachUserId, request.body ?? {});
    return response.status(201).json({ ok: true, brand_preference: record });
  })
);

coachBrandingRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const record = await loadCoachBrandPreference(coachUserId);
    return response.status(200).json({ ok: true, brand_preference: record });
  })
);

// The gyms the coach works out of (coach_gym_service.ts).
coachBrandingRouter.get(
  "/gyms",
  rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    return response.status(200).json(await listCoachGyms(coachUserId));
  })
);

coachBrandingRouter.get(
  "/gyms/search",
  rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    await authenticatedCoach(request, false);
    return response.status(200).json({ ok: true, gyms: await searchGyms(request.query.q) });
  })
);

coachBrandingRouter.post(
  "/gyms",
  rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(201).json(await addCoachGym(coachUserId, request.body));
  })
);

coachBrandingRouter.post(
  "/gyms/:coach_gym_id/link",
  rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(200).json(await linkCoachGym(coachUserId, String(request.params.coach_gym_id), request.body));
  })
);

coachBrandingRouter.delete(
  "/gyms/:coach_gym_id",
  rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    return response.status(200).json(await removeCoachGym(coachUserId, String(request.params.coach_gym_id)));
  })
);

coachBrandingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof CoachGymError) {
      response.status(error.status).json({ ok: false, error: error.code, field_errors: error.fieldErrors });
      return;
    }
    if (error instanceof CoachBrandingError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
