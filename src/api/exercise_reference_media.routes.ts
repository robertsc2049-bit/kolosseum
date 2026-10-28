// DEV NOTE: FULL-UI-30 - read-only exercise reference-media routes, mounted
// at /exercises. Identity is resolved from the session cookie only, never a
// client-supplied user_id, mirroring the identical pattern duplicated in
// messaging.routes.ts and progress_photos.routes.ts. Unlike those surfaces,
// this data is not athlete-scoped - it is global exercise reference data -
// so a single route accepts either actor type rather than splitting into
// athlete/coach paths. There is no POST/PUT/DELETE anywhere in this file.

import { rateLimit } from "express-rate-limit";
import { accountRateLimitKey } from "./rate_limit_key.js";
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
import { demoUploadForViewer, resolveExerciseDemoVideo } from "./exercise_demo_video_service.js";
import { resolveDemoUploadPath, sendDemoUploadFile } from "./exercise_demo_video_storage.js";
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

async function authenticatedAthleteOrCoach(request: Request): Promise<Readonly<{ userId: string; actorType: string }>> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  try {
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete" && session.account_row.actor_type !== "coach") {
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: "athlete_or_coach_account_required" });
    }
    return Object.freeze({ userId: session.account_row.user_id, actorType: session.account_row.actor_type });
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

// Opening an exercise's how-to reads this; generous, but bounded now that it
// resolves the viewer's coach from the database.
const referenceMediaRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });

exerciseReferenceMediaRouter.get(
  "/:exercise_id/reference-media",
  referenceMediaRateLimit,
  asyncHandler(async (request, response) => {
    const viewer = await authenticatedAthleteOrCoach(request);
    const result = await getExerciseReferenceMedia(String(request.params.exercise_id));
    // The demo this viewer sees: their coach's, else the platform default,
    // else the curated video (exercise_demo_video_service.ts).
    const demo = await resolveExerciseDemoVideo(result.exercise_id, viewer);
    return response.status(200).json({
      ok: true,
      exercise_id: result.exercise_id,
      reference_media: demo
        ? {
          video_url: demo.video_url,
          embed_url: demo.embed_url,
          provider: demo.provider,
          source: demo.source,
          ...(demo.poster_url ? { poster_url: demo.poster_url } : {})
        }
        : null
    });
  })
);

// A coach's uploaded demo clip and its poster frame - served only to a
// viewer whose demo for this exercise resolves to exactly this upload (the
// coach and their athletes). Range requests are answered, so phones can play
// and seek it.
async function sendDemoUpload(request: Request, response: Response, part: "video" | "poster"): Promise<unknown> {
  const viewer = await authenticatedAthleteOrCoach(request);
  const upload = await demoUploadForViewer(String(request.params.exercise_id), String(request.params.upload_id), viewer);
  const key = part === "video" ? upload?.storage_key : upload?.poster_key;
  const filePath = key ? resolveDemoUploadPath(key) : null;
  if (!filePath) return response.status(404).json({ error: "demo_upload_not_found" });
  return sendDemoUploadFile(response, filePath, part === "video" ? "video/mp4" : "image/jpeg");
}

exerciseReferenceMediaRouter.get(
  "/:exercise_id/demo-uploads/:upload_id",
  referenceMediaRateLimit,
  asyncHandler((request, response) => sendDemoUpload(request, response, "video"))
);

exerciseReferenceMediaRouter.get(
  "/:exercise_id/demo-uploads/:upload_id/poster",
  referenceMediaRateLimit,
  asyncHandler((request, response) => sendDemoUpload(request, response, "poster"))
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
