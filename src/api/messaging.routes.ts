// DEV NOTE: Part D.1 - coach<->athlete messaging routes, mounted at
// /messages. Coach identity is resolved via the shared authenticatedCoach
// guard (coach_session_auth.ts). Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in coach_workspace.handlers.ts:454-478 - neither side ever
// trusts a client-supplied user_id.

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
  CoachAthleteMessagingError,
  listCoachAthleteThreadMessages,
  listCoachAthleteThreads,
  resolveCoachAthleteMessageAttachment,
  resolveCoachAthleteMessageAttachmentThumbnail,
  sendCoachAthleteMessage
} from "./coach_athlete_messaging_service.js";
import {
  CoachBroadcastMessagingError,
  getBroadcastReadStatus,
  sendCoachBroadcastMessage
} from "./coach_broadcast_messaging_service.js";
import {
  OrgAthleteMessagingError,
  listOrgAthleteThreadMessagesForAthlete,
  listOrgAthleteThreadMessagesForCoach,
  listOrgAthleteThreadsForAthlete,
  listOrgAthleteThreadsVisibleToCoach,
  resolveOrgAthleteMessageAttachmentForAthlete,
  resolveOrgAthleteMessageAttachmentForCoach,
  resolveOrgAthleteMessageAttachmentThumbnailForAthlete,
  resolveOrgAthleteMessageAttachmentThumbnailForCoach,
  sendOrgAthleteMessageFromAthlete
} from "./org_athlete_messaging_service.js";
import {
  MessageAttachmentError,
  attachmentUpload,
  sendAttachmentFile,
  validateStagedUpload
} from "./message_attachment_storage.js";

export const messagingRouter = Router();

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

messagingRouter.get(
  "/coach/threads",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const threads = await listCoachAthleteThreads(coachUserId, "coach");
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/coach/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const messages = await listCoachAthleteThreadMessages(String(request.params.thread_id), coachUserId, "coach");
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.post(
  "/coach/athletes/:athlete_user_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendCoachAthleteMessage(
      "coach",
      coachUserId,
      String(request.params.athlete_user_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

messagingRouter.post(
  "/coach/broadcast",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await sendCoachBroadcastMessage(coachUserId, request.body?.body_text);
    return response.status(201).json({ ok: true, ...result });
  })
);

messagingRouter.get(
  "/coach/broadcasts/:broadcast_id/read-status",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const status = await getBroadcastReadStatus(coachUserId, String(request.params.broadcast_id));
    return response.status(200).json({ ok: true, ...status });
  })
);

messagingRouter.get(
  "/coach/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const attachment = await resolveCoachAthleteMessageAttachment(String(request.params.message_id), coachUserId, "coach");
    if (!attachment) return response.status(404).json({ error: "coach_athlete_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

messagingRouter.get(
  "/coach/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const thumbnail = await resolveCoachAthleteMessageAttachmentThumbnail(String(request.params.message_id), coachUserId, "coach");
    if (!thumbnail) return response.status(404).json({ error: "coach_athlete_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

messagingRouter.get(
  "/athlete/threads",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const threads = await listCoachAthleteThreads(athleteUserId, "athlete");
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/athlete/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const messages = await listCoachAthleteThreadMessages(String(request.params.thread_id), athleteUserId, "athlete");
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.post(
  "/athlete/coaches/:coach_user_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendCoachAthleteMessage(
      "athlete",
      athleteUserId,
      String(request.params.coach_user_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

messagingRouter.get(
  "/athlete/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const attachment = await resolveCoachAthleteMessageAttachment(String(request.params.message_id), athleteUserId, "athlete");
    if (!attachment) return response.status(404).json({ error: "coach_athlete_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

messagingRouter.get(
  "/athlete/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const thumbnail = await resolveCoachAthleteMessageAttachmentThumbnail(String(request.params.message_id), athleteUserId, "athlete");
    if (!thumbnail) return response.status(404).json({ error: "coach_athlete_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

// Part D.4 - org-owner<->athlete messaging, athlete side. Nested under
// /athlete/org-messages/... so it can't collide with the coach<->athlete
// routes above (mirrors the coach-side /coach-workspace/org-messages/...
// differentiator already used for org-owner<->coach messaging).
messagingRouter.get(
  "/athlete/org-messages/threads",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const threads = await listOrgAthleteThreadsForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/athlete/org-messages/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const messages = await listOrgAthleteThreadMessagesForAthlete(String(request.params.thread_id), athleteUserId);
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.post(
  "/athlete/org-messages/organisations/:org_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendOrgAthleteMessageFromAthlete(
      athleteUserId,
      String(request.params.org_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

messagingRouter.get(
  "/athlete/org-messages/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const attachment = await resolveOrgAthleteMessageAttachmentForAthlete(String(request.params.message_id), athleteUserId);
    if (!attachment) return response.status(404).json({ error: "org_athlete_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

messagingRouter.get(
  "/athlete/org-messages/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const thumbnail = await resolveOrgAthleteMessageAttachmentThumbnailForAthlete(String(request.params.message_id), athleteUserId);
    if (!thumbnail) return response.status(404).json({ error: "org_athlete_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

// Part O.8 - coach visibility into an org owner's thread with their own
// athlete, read-only (no POST route - the coach never sends into this
// thread, it stays exactly two-party for writes). Nested under
// /coach/org-messages/... to mirror /athlete/org-messages/... symmetrically,
// and to avoid colliding with the D.1 /coach/threads,/coach/attachments/...
// family above (a different thread_type entirely) or the D.2
// /coach-workspace/org-messages/... family (coach_org_membership.routes.ts -
// the coach's OWN thread with the org owner, a different feature).
messagingRouter.get(
  "/coach/athletes/:athlete_user_id/org-messages/threads",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const threads = await listOrgAthleteThreadsVisibleToCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, threads });
  })
);

messagingRouter.get(
  "/coach/org-messages/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const messages = await listOrgAthleteThreadMessagesForCoach(String(request.params.thread_id), coachUserId);
    return response.status(200).json({ ok: true, messages });
  })
);

messagingRouter.get(
  "/coach/org-messages/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const attachment = await resolveOrgAthleteMessageAttachmentForCoach(String(request.params.message_id), coachUserId);
    if (!attachment) return response.status(404).json({ error: "org_athlete_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

messagingRouter.get(
  "/coach/org-messages/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const thumbnail = await resolveOrgAthleteMessageAttachmentThumbnailForCoach(String(request.params.message_id), coachUserId);
    if (!thumbnail) return response.status(404).json({ error: "org_athlete_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

// CoachAthleteMessagingError/OrgAthleteMessagingError/MessageAttachmentError
// are not ApiErrors, so without this router-scoped handler they would
// otherwise reach the generic error mapper, which mistakes the string
// message for a Postgres error code and returns a misleading 500 instead
// of the correct status (mirrors the identical, deliberate pattern in
// product_admin.routes.ts / org_owner.routes.ts). MulterError (e.g. an
// oversized upload exceeding the multer-level ceiling before content
// sniffing even runs) is mapped the same way, for the same reason.
messagingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (
      error instanceof CoachAthleteMessagingError ||
      error instanceof CoachBroadcastMessagingError ||
      error instanceof OrgAthleteMessagingError ||
      error instanceof MessageAttachmentError
    ) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof MulterError) {
      response.status(400).json({ error: `message_attachment_upload_${error.code.toLowerCase()}` });
      return;
    }
    next(error);
  }
);
