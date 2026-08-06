// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.2) - coach-side org membership routes. Mounted at /coach-workspace
// alongside the coach's existing session-authenticated surface. A coach
// accepts or leaves an org membership using only a membership_id their own
// GET /coach-workspace/org-memberships list already supplied - never an
// org owner's internal user_id or org_id typed directly. Coach identity is
// derived only from the resolved coach session cookie (authenticatedCoach),
// never a client-supplied id.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { MulterError } from "multer";

import { authenticatedCoach } from "./coach_session_auth.js";
import {
  OrgRosterError,
  acceptOrgMembershipInvitation,
  leaveOrganisation,
  listOrgMembershipsForCoach
} from "./org_roster_service.js";
import {
  OrgCoachMessagingError,
  listOrgCoachThreadMessagesForCoach,
  listOrgCoachThreadsForCoach,
  resolveOrgCoachMessageAttachmentForCoach,
  resolveOrgCoachMessageAttachmentThumbnailForCoach,
  sendOrgCoachMessageFromCoach
} from "./org_coach_messaging_service.js";
import {
  MessageAttachmentError,
  attachmentUpload,
  sendAttachmentFile,
  validateStagedUpload
} from "./message_attachment_storage.js";

export const coachOrgMembershipRouter = Router();

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

coachOrgMembershipRouter.get(
  "/org-memberships",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const memberships = await listOrgMembershipsForCoach(coachUserId);
    return response.status(200).json({ ok: true, memberships });
  })
);

coachOrgMembershipRouter.post(
  "/org-memberships/:membership_id/accept",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await acceptOrgMembershipInvitation(
      coachUserId,
      String(request.params.membership_id),
      request.body?.request_id
    );
    return response.status(200).json({ ok: true, membership: result.membership });
  })
);

coachOrgMembershipRouter.post(
  "/org-memberships/:membership_id/leave",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await leaveOrganisation(
      coachUserId,
      String(request.params.membership_id),
      request.body?.request_id
    );
    return response.status(200).json({ ok: true, membership: result.membership });
  })
);

coachOrgMembershipRouter.get(
  "/org-messages/threads",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const threads = await listOrgCoachThreadsForCoach(coachUserId);
    return response.status(200).json({ ok: true, threads });
  })
);

coachOrgMembershipRouter.get(
  "/org-messages/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const messages = await listOrgCoachThreadMessagesForCoach(String(request.params.thread_id), coachUserId);
    return response.status(200).json({ ok: true, messages });
  })
);

coachOrgMembershipRouter.post(
  "/org-messages/organisations/:org_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendOrgCoachMessageFromCoach(
      coachUserId,
      String(request.params.org_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

coachOrgMembershipRouter.get(
  "/org-messages/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const attachment = await resolveOrgCoachMessageAttachmentForCoach(String(request.params.message_id), coachUserId);
    if (!attachment) return response.status(404).json({ error: "org_coach_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

coachOrgMembershipRouter.get(
  "/org-messages/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const thumbnail = await resolveOrgCoachMessageAttachmentThumbnailForCoach(String(request.params.message_id), coachUserId);
    if (!thumbnail) return response.status(404).json({ error: "org_coach_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

// OrgRosterError/OrgCoachMessagingError/MessageAttachmentError are not
// ApiError, so without this router-scoped handler they would otherwise
// reach the generic error mapper, which mistakes the string message for a
// Postgres error code and returns a misleading 500 instead of the correct
// status (mirrors the identical, deliberate pattern in
// product_admin.routes.ts / org_owner.routes.ts). MulterError is mapped
// the same way, for the same reason.
coachOrgMembershipRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof OrgRosterError || error instanceof OrgCoachMessagingError || error instanceof MessageAttachmentError) {
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
