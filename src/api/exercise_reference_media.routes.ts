// DEV NOTE: FULL-UI-30 - read-only exercise reference-media routes, mounted
// at /exercises. Identity is resolved from the session cookie only, never a
// client-supplied user_id, mirroring the identical pattern duplicated in
// messaging.routes.ts and progress_photos.routes.ts. Unlike those surfaces,
// this data is not athlete-scoped - it is global exercise reference data -
// so a single route accepts either actor type rather than splitting into
// athlete/coach paths. There is no POST/PUT/DELETE anywhere in this file.

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
import { cookieValue } from "./coach_session_auth.js";
import {
  ExerciseReferenceMediaError,
  getExerciseReferenceMedia
} from "./exercise_reference_media_service.js";

export const exerciseReferenceMediaRouter = Router();

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

async function authenticatedAthleteOrCoach(request: Request): Promise<void> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  try {
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete" && session.account_row.actor_type !== "coach") {
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: "athlete_or_coach_account_required" });
    }
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

exerciseReferenceMediaRouter.get(
  "/:exercise_id/reference-media",
  asyncHandler(async (request, response) => {
    await authenticatedAthleteOrCoach(request);
    const result = await getExerciseReferenceMedia(String(request.params.exercise_id));
    return response.status(200).json({ ok: true, ...result });
  })
);

exerciseReferenceMediaRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof ExerciseReferenceMediaError) {
      response.status(error.status).json({ error: error.code });
      return;
    }
    next(error);
  }
);
