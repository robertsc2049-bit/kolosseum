// DEV NOTE: FULL-UI-32 - athlete-side video feedback routes, mounted at
// /video-feedback. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in progress_photos.routes.ts/messaging.routes.ts - never a
// client-supplied user_id. Upload/list/read only for the athlete; the
// coach-facing queue and feedback-write surface lives in the sibling
// video_feedback_coach.routes.ts, mounted at /coach-workspace.

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
import { cookieValue } from "./coach_session_auth.js";
import {
  VideoFeedbackError,
  createVideoSubmission,
  getSubmissionDetailForAthlete,
  listMySubmissions,
  resolveSubmissionFileForAthlete
} from "./video_feedback_service.js";
import {
  VideoSubmissionError,
  sendVideoSubmissionFile,
  validateStagedVideoUpload,
  videoSubmissionUpload
} from "./video_submission_storage.js";

export const videoFeedbackRouter = Router();

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

videoFeedbackRouter.post(
  "/",
  videoSubmissionUpload.single("video"),
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const pending = await validateStagedVideoUpload(request.file);
    const submission = await createVideoSubmission(athleteUserId, pending, {
      sessionId: request.body?.session_id,
      workItemId: request.body?.work_item_id,
      exerciseLabel: request.body?.exercise_label,
      caption: request.body?.caption,
      clientRequestId: request.body?.client_request_id
    });
    return response.status(201).json({ ok: true, submission });
  })
);

videoFeedbackRouter.get(
  "/submissions",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const sessionId = typeof request.query.session_id === "string" ? request.query.session_id : undefined;
    const submissions = await listMySubmissions(athleteUserId, sessionId);
    return response.status(200).json({ ok: true, submissions });
  })
);

videoFeedbackRouter.get(
  "/submissions/:submission_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const submission = await getSubmissionDetailForAthlete(athleteUserId, String(request.params.submission_id));
    return response.status(200).json({ ok: true, submission });
  })
);

videoFeedbackRouter.get(
  "/submissions/:submission_id/media",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const file = await resolveSubmissionFileForAthlete(athleteUserId, String(request.params.submission_id), "media");
    if (!file) return response.status(404).json({ error: "video_feedback_submission_not_found" });
    return sendVideoSubmissionFile(response, file);
  })
);

videoFeedbackRouter.get(
  "/submissions/:submission_id/thumbnail",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const file = await resolveSubmissionFileForAthlete(athleteUserId, String(request.params.submission_id), "thumbnail");
    if (!file) return response.status(404).json({ error: "video_feedback_thumbnail_not_found" });
    return sendVideoSubmissionFile(response, file);
  })
);

// Maps this router's own typed errors before falling through to the global
// apiErrorMiddleware, mirroring progress_photos.routes.ts's identical shape.
videoFeedbackRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof VideoFeedbackError || error instanceof VideoSubmissionError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof MulterError) {
      response.status(400).json({ error: `video_feedback_upload_${error.code.toLowerCase()}` });
      return;
    }
    next(error);
  }
);
