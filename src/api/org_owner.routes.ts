// DEV NOTE: Organisation/team billing commercial expansion (part B) - org
// owner identity routes. Mounted at its own top-level /org prefix - never
// under /account, /coach-workspace, /sessions, or /admin - and every
// mutating/protected route resolves identity from authenticatedOrgOwner
// (the org owner session cookie) only. An athlete, coach, or admin session
// cookie is never even read by this file, so it structurally cannot satisfy
// any route here.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { MulterError } from "multer";

import {
  ORG_OWNER_SESSION_COOKIE,
  ORG_OWNER_SESSION_MAX_AGE_SECONDS,
  OrgOwnerAuthError,
  registerAndSignInOrgOwnerAccount,
  signInOrgOwnerAccount,
  signOutOrgOwnerSession
} from "./org_owner_account_service.js";
import { authenticatedOrgOwner, orgOwnerCookieValue } from "./org_owner_auth.js";
import {
  OrgBillingError,
  changeOrgSeatPlan,
  getOrgBillingStatus
} from "./org_billing_service.js";
import {
  OrgRosterError,
  createOrganisation,
  inviteCoachToOrganisation,
  listOrgAuditLog,
  listOrganisationRoster,
  listOrganisationsForOwner,
  removeCoachMembership
} from "./org_roster_service.js";
import {
  OrgVisibilityError,
  getOrgAthleteVisibility
} from "./org_visibility_service.js";
import { getOrgProgressRollup } from "./org_progress_rollup_service.js";
import {
  OrgCoachMessagingError,
  listOrgCoachThreadMessagesForOwner,
  listOrgCoachThreadsForOwner,
  resolveOrgCoachMessageAttachmentForOwner,
  resolveOrgCoachMessageAttachmentThumbnailForOwner,
  sendOrgCoachMessageFromOwner
} from "./org_coach_messaging_service.js";
import {
  OrgAthleteMessagingError,
  listOrgAthleteThreadMessagesForOwner,
  listOrgAthleteThreadsForOwner,
  resolveOrgAthleteMessageAttachmentForOwner,
  resolveOrgAthleteMessageAttachmentThumbnailForOwner,
  sendOrgAthleteMessageFromOwner
} from "./org_athlete_messaging_service.js";
import {
  MessageAttachmentError,
  attachmentUpload,
  sendAttachmentFile,
  validateStagedUpload
} from "./message_attachment_storage.js";

export const orgOwnerRouter = Router();

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

function setOrgOwnerSessionCookie(response: Response, rawToken: string): void {
  response.cookie(ORG_OWNER_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORG_OWNER_SESSION_MAX_AGE_SECONDS * 1000
  });
}

function clearOrgOwnerSessionCookie(response: Response): void {
  response.clearCookie(ORG_OWNER_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

orgOwnerRouter.post(
  "/register",
  asyncHandler(async (request, response) => {
    const session = await registerAndSignInOrgOwnerAccount(request.body);
    setOrgOwnerSessionCookie(response, session.raw_session_token);
    return response.status(201).json({
      org_owner: session.org_owner,
      csrf_token: session.csrf_token,
      session_expires_at_iso8601: session.expires_at_iso8601
    });
  })
);

orgOwnerRouter.post(
  "/sign-in",
  asyncHandler(async (request, response) => {
    const session = await signInOrgOwnerAccount(request.body);
    setOrgOwnerSessionCookie(response, session.raw_session_token);
    return response.status(200).json({
      org_owner: session.org_owner,
      csrf_token: session.csrf_token,
      session_expires_at_iso8601: session.expires_at_iso8601
    });
  })
);

orgOwnerRouter.post(
  "/sign-out",
  asyncHandler(async (request, response) => {
    const rawToken = orgOwnerCookieValue(request, ORG_OWNER_SESSION_COOKIE);
    await signOutOrgOwnerSession(rawToken);
    clearOrgOwnerSessionCookie(response);
    return response.status(200).json({ ok: true });
  })
);

orgOwnerRouter.get(
  "/session",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    return response.status(200).json({ ok: true, user_id });
  })
);

orgOwnerRouter.post(
  "/organisations",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const result = await createOrganisation(user_id, request.body?.org_name, request.body?.visibility_mode);
    return response.status(201).json({ ok: true, organisation: result.organisation });
  })
);

orgOwnerRouter.get(
  "/organisations",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const organisations = await listOrganisationsForOwner(user_id);
    return response.status(200).json({ ok: true, organisations });
  })
);

orgOwnerRouter.post(
  "/organisations/:org_id/roster/invite",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const result = await inviteCoachToOrganisation(
      user_id,
      String(request.params.org_id),
      request.body?.coach_email,
      request.body?.request_id
    );
    return response.status(201).json({ ok: true, membership: result.membership });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/roster",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const roster = await listOrganisationRoster(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, roster });
  })
);

orgOwnerRouter.post(
  "/organisations/:org_id/roster/:membership_id/remove",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const result = await removeCoachMembership(
      user_id,
      String(request.params.org_id),
      String(request.params.membership_id),
      request.body?.request_id
    );
    return response.status(200).json({ ok: true, membership: result.membership });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/billing",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const billing = await getOrgBillingStatus(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, billing });
  })
);

orgOwnerRouter.post(
  "/organisations/:org_id/billing/seat-plan",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const result = await changeOrgSeatPlan(
      user_id,
      String(request.params.org_id),
      request.body?.seat_limit,
      request.body?.request_id
    );
    return response.status(200).json({ ok: true, billing: result });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/athlete-visibility",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const visibility = await getOrgAthleteVisibility(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, visibility });
  })
);

// Progress graphs slices 4 & 5: an org-wide progress rollup - a real
// per-athlete roster for 'shared'-mode ("team") organisations, or an
// aggregate-only adherence trend (never any individual athlete's
// identity) for 'individual'-mode ("gym") organisations - see
// org_progress_rollup_service.ts's own DEV NOTE.
orgOwnerRouter.get(
  "/organisations/:org_id/progress-rollup",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const rollup = await getOrgProgressRollup(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, rollup });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/audit-log",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const auditLog = await listOrgAuditLog(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, audit_log: auditLog });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/messages/threads",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const threads = await listOrgCoachThreadsForOwner(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, threads });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/messages/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const messages = await listOrgCoachThreadMessagesForOwner(String(request.params.thread_id), user_id);
    return response.status(200).json({ ok: true, messages });
  })
);

orgOwnerRouter.post(
  "/organisations/:org_id/messages/coaches/:coach_user_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendOrgCoachMessageFromOwner(
      user_id,
      String(request.params.org_id),
      String(request.params.coach_user_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/messages/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const attachment = await resolveOrgCoachMessageAttachmentForOwner(String(request.params.message_id), user_id);
    if (!attachment) return response.status(404).json({ error: "org_coach_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/messages/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const thumbnail = await resolveOrgCoachMessageAttachmentThumbnailForOwner(String(request.params.message_id), user_id);
    if (!thumbnail) return response.status(404).json({ error: "org_coach_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/athlete-messages/threads",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const threads = await listOrgAthleteThreadsForOwner(user_id, String(request.params.org_id));
    return response.status(200).json({ ok: true, threads });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/athlete-messages/threads/:thread_id",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const messages = await listOrgAthleteThreadMessagesForOwner(String(request.params.thread_id), user_id);
    return response.status(200).json({ ok: true, messages });
  })
);

orgOwnerRouter.post(
  "/organisations/:org_id/athlete-messages/athletes/:athlete_user_id/send",
  attachmentUpload.single("attachment"),
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    const attachment = await validateStagedUpload(request.file);
    const result = await sendOrgAthleteMessageFromOwner(
      user_id,
      String(request.params.org_id),
      String(request.params.athlete_user_id),
      request.body?.body_text,
      request.body?.client_request_id,
      attachment
    );
    return response.status(201).json({ ok: true, thread: result.thread, message: result.message });
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/athlete-messages/attachments/:message_id",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const attachment = await resolveOrgAthleteMessageAttachmentForOwner(String(request.params.message_id), user_id);
    if (!attachment) return response.status(404).json({ error: "org_athlete_messaging_attachment_not_found" });
    return sendAttachmentFile(response, attachment);
  })
);

orgOwnerRouter.get(
  "/organisations/:org_id/athlete-messages/attachments/:message_id/thumbnail",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const thumbnail = await resolveOrgAthleteMessageAttachmentThumbnailForOwner(String(request.params.message_id), user_id);
    if (!thumbnail) return response.status(404).json({ error: "org_athlete_messaging_thumbnail_not_found" });
    return sendAttachmentFile(response, thumbnail);
  })
);

// OrgOwnerAuthError/OrgRosterError/OrgBillingError/OrgVisibilityError/
// OrgCoachMessagingError/OrgAthleteMessagingError/MessageAttachmentError
// are not ApiError, so without this router-scoped handler they would
// otherwise reach the generic error mapper, which mistakes the string
// message for a Postgres error code and returns a misleading 500 instead
// of the correct status (mirrors the identical, deliberate pattern in
// product_admin.routes.ts). MulterError is mapped the same way, for the
// same reason.
orgOwnerRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (
      error instanceof OrgOwnerAuthError ||
      error instanceof OrgRosterError ||
      error instanceof OrgBillingError ||
      error instanceof OrgVisibilityError ||
      error instanceof OrgCoachMessagingError ||
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
