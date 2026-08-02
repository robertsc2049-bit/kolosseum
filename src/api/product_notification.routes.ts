// DEV NOTE: FULL-UI-18 factual in-product notifications. Session-authenticated
// exactly like every other account-scoped surface (product_account.routes.ts) -
// this file never accepts a caller-supplied recipient id.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import {
  getUnreadNotificationCount,
  listNotificationsForRecipient,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  ProductNotificationError
} from "./product_notification_service.js";
import { badRequest, notFound } from "./http_errors.js";

export const productNotificationRouter = Router();

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

function cookieValue(request: Request, name: string): string {
  const cookieHeader = String(request.headers.cookie ?? "");

  for (const item of cookieHeader.split(";")) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = item.slice(0, separatorIndex).trim();
    if (key === name) {
      return decodeURIComponent(item.slice(separatorIndex + 1).trim());
    }
  }

  return "";
}

function sessionToken(request: Request): string {
  const token = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!token) {
    throw new ProductAccountError("account_session_missing", 401);
  }
  return token;
}

function assertMutationAuthorised(request: Request, token: string): void {
  assertProductCsrf(token, request.get("x-kolosseum-csrf"));
}

function rethrowNotificationError(error: unknown): never {
  if (error instanceof ProductNotificationError) {
    throw error.status === 404
      ? notFound(error.message, { failure_token: error.message })
      : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

productNotificationRouter.get(
  "/notifications",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    const session = await resolveProductSession(token);
    const result = await listNotificationsForRecipient(session.account_row.user_id);
    return response.status(200).json(result);
  })
);

productNotificationRouter.get(
  "/notifications/unread-count",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    const session = await resolveProductSession(token);
    const unread_count = await getUnreadNotificationCount(session.account_row.user_id);
    return response.status(200).json({ unread_count });
  })
);

productNotificationRouter.post(
  "/notifications/:notification_id/read",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    assertMutationAuthorised(request, token);
    const session = await resolveProductSession(token);

    try {
      await markNotificationRead(
        session.account_row.user_id,
        String(request.params.notification_id)
      );
    }
    catch (error) {
      rethrowNotificationError(error);
    }

    return response.status(200).json({ ok: true });
  })
);

productNotificationRouter.post(
  "/notifications/:notification_id/unread",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    assertMutationAuthorised(request, token);
    const session = await resolveProductSession(token);

    try {
      await markNotificationUnread(
        session.account_row.user_id,
        String(request.params.notification_id)
      );
    }
    catch (error) {
      rethrowNotificationError(error);
    }

    return response.status(200).json({ ok: true });
  })
);

productNotificationRouter.post(
  "/notifications/mark-all-read",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    assertMutationAuthorised(request, token);
    const session = await resolveProductSession(token);

    await markAllNotificationsRead(session.account_row.user_id);

    return response.status(200).json({ ok: true });
  })
);
