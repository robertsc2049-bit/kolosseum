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

import { authenticatedCoach } from "./coach_session_auth.js";
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

coachBrandingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof CoachBrandingError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
