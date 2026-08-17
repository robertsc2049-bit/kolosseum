// DEV NOTE: FULL-UI-32 - coach-side video feedback routes, mounted at
// /coach-workspace (mirrors product_review.routes.ts being its own file
// rather than folding into coach_workspace.routes.ts). Read/reply only -
// a coach can never create a submission, only review one an athlete
// already uploaded.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { authenticatedCoach } from "./coach_session_auth.js";
import {
  VideoFeedbackError,
  addFeedback,
  getSubmissionDetailForCoach,
  listCoachQueue,
  resolveSubmissionFileForCoach
} from "./video_feedback_service.js";
import { sendVideoSubmissionFile } from "./video_submission_storage.js";

export const videoFeedbackCoachRouter = Router();

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

videoFeedbackCoachRouter.get(
  "/video-feedback/queue",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const submissions = await listCoachQueue(coachUserId);
    return response.status(200).json({ ok: true, submissions });
  })
);

videoFeedbackCoachRouter.get(
  "/video-feedback/submissions/:submission_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const submission = await getSubmissionDetailForCoach(coachUserId, String(request.params.submission_id));
    return response.status(200).json({ ok: true, submission });
  })
);

videoFeedbackCoachRouter.post(
  "/video-feedback/submissions/:submission_id/feedback",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const submission = await addFeedback(coachUserId, String(request.params.submission_id), request.body?.feedback_text);
    return response.status(201).json({ ok: true, submission });
  })
);

videoFeedbackCoachRouter.get(
  "/video-feedback/submissions/:submission_id/media",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const file = await resolveSubmissionFileForCoach(coachUserId, String(request.params.submission_id), "media");
    if (!file) return response.status(404).json({ error: "video_feedback_submission_not_found" });
    return sendVideoSubmissionFile(response, file);
  })
);

videoFeedbackCoachRouter.get(
  "/video-feedback/submissions/:submission_id/thumbnail",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const file = await resolveSubmissionFileForCoach(coachUserId, String(request.params.submission_id), "thumbnail");
    if (!file) return response.status(404).json({ error: "video_feedback_thumbnail_not_found" });
    return sendVideoSubmissionFile(response, file);
  })
);

// Maps this router's own typed errors before falling through to the global
// apiErrorMiddleware, mirroring progress_photos.routes.ts's identical shape.
videoFeedbackCoachRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof VideoFeedbackError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
