// DEV NOTE: FULL-UI-28 - athlete progress photo routes, mounted at
// /progress-photos. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in messaging.routes.ts and coach_workspace.handlers.ts -
// neither side ever trusts a client-supplied user_id. This surface is
// deliberately upload/list only for the athlete and read-only for the
// coach - there is no coach-facing write route anywhere in this file.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { MulterError } from "multer";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import {
  ProgressPhotoError,
  listProgressPhotosForAthlete,
  listProgressPhotosForCoach,
  resolveProgressPhotoFileForAthlete,
  resolveProgressPhotoFileForCoach,
  uploadProgressPhoto
} from "./progress_photo_service.js";
import {
  ProgressPhotoStorageError,
  progressPhotoUpload,
  sendProgressPhotoFile,
  validateStagedProgressPhotoUpload
} from "./progress_photo_storage.js";

export const progressPhotosRouter = Router();

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

// Athlete self-upload only - there is no equivalent coach-facing route.
progressPhotosRouter.post(
  "/",
  progressPhotoUpload.single("photo"),
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const pending = await validateStagedProgressPhotoUpload(request.file);
    if (!pending) {
      return response.status(400).json({ error: "progress_photo_file_required" });
    }
    const record = await uploadProgressPhoto(athleteUserId, pending, {
      taken_at_iso8601: request.body?.taken_at_iso8601,
      caption: request.body?.caption
    });
    return response.status(201).json({ ok: true, photo: record });
  })
);

progressPhotosRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const photos = await listProgressPhotosForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, photos });
  })
);

progressPhotosRouter.get(
  "/:photo_id/file",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const file = await resolveProgressPhotoFileForAthlete(String(request.params.photo_id), athleteUserId);
    if (!file) return response.status(404).json({ error: "progress_photo_not_found" });
    return sendProgressPhotoFile(response, file);
  })
);

// Coach-facing surface is read-only - list and fetch-file only, no POST/PUT/DELETE.
progressPhotosRouter.get(
  "/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const photos = await listProgressPhotosForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, photos });
  })
);

progressPhotosRouter.get(
  "/coach/:athlete_user_id/:photo_id/file",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const file = await resolveProgressPhotoFileForCoach(
      String(request.params.photo_id),
      coachUserId,
      String(request.params.athlete_user_id)
    );
    if (!file) return response.status(404).json({ error: "progress_photo_not_found" });
    return sendProgressPhotoFile(response, file);
  })
);

// Maps this router's own typed errors before falling through to the global
// apiErrorMiddleware, mirroring messaging.routes.ts's local error handler.
progressPhotosRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof ProgressPhotoError || error instanceof ProgressPhotoStorageError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof MulterError) {
      response.status(400).json({ error: `progress_photo_upload_${error.code.toLowerCase()}` });
      return;
    }
    next(error);
  }
);
