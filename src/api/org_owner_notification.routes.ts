// DEV NOTE: FULL-UI-91 org-owner bell notifications. Mirrors
// product_notification.routes.ts's 5 endpoints exactly, but resolves
// identity from authenticatedOrgOwner (the org owner session cookie) rather
// than the coach/athlete session - a client-supplied recipient id is never
// accepted. Mounted at the same /org prefix as org_owner.routes.ts's
// orgOwnerRouter, as its own separate router (mirroring how
// productNotificationRouter is a separate router from productAccountRouter,
// both sharing /account).

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { authenticatedOrgOwner } from "./org_owner_auth.js";
import {
  getUnreadNotificationCount,
  listNotificationsForRecipient,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  ProductNotificationError
} from "./product_notification_service.js";
import { badRequest, notFound } from "./http_errors.js";

export const orgOwnerNotificationRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ): void => {
    handler(request, response, next).catch(next);
  };
}

function rethrowNotificationError(error: unknown): never {
  if (error instanceof ProductNotificationError) {
    throw error.status === 404
      ? notFound(error.message, { failure_token: error.message })
      : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

orgOwnerNotificationRouter.get(
  "/notifications",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const result = await listNotificationsForRecipient(user_id);
    return response.status(200).json(result);
  })
);

orgOwnerNotificationRouter.get(
  "/notifications/unread-count",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const unread_count = await getUnreadNotificationCount(user_id);
    return response.status(200).json({ unread_count });
  })
);

orgOwnerNotificationRouter.post(
  "/notifications/:notification_id/read",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);

    try {
      await markNotificationRead(user_id, String(request.params.notification_id));
    }
    catch (error) {
      rethrowNotificationError(error);
    }

    return response.status(200).json({ ok: true });
  })
);

orgOwnerNotificationRouter.post(
  "/notifications/:notification_id/unread",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);

    try {
      await markNotificationUnread(user_id, String(request.params.notification_id));
    }
    catch (error) {
      rethrowNotificationError(error);
    }

    return response.status(200).json({ ok: true });
  })
);

orgOwnerNotificationRouter.post(
  "/notifications/mark-all-read",
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);
    await markAllNotificationsRead(user_id);
    return response.status(200).json({ ok: true });
  })
);
