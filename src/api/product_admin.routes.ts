// DEV NOTE: FULL-UI-21 founder/admin operations. Mounted at its own top-
// level /admin prefix - never under /account, /coach-workspace or /sessions
// - and every route resolves identity from authenticatedAdmin (the admin
// session cookie) only. An athlete or coach session cookie is never even
// read by this file, so it structurally cannot satisfy any route here.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  AdminAuthError,
  signInAdminAccount,
  signOutAdminSession
} from "./product_admin_account_service.js";
import { adminCookieValue, authenticatedAdmin } from "./product_admin_auth.js";
import {
  changeAccountState,
  changeSupportRequestStatus,
  AdminActionError,
  setTestAccountMarking
} from "./product_admin_action_service.js";
import {
  getAdminAccountDetail,
  listAdminAuditRecords,
  listAdminCommercialRecords,
  listAdminDataDeletionRequests,
  listAdminDataExportRequests,
  listAdminSupportRequests,
  searchAdminAccounts
} from "./product_admin_review_service.js";
import { badRequest, conflict, notFound } from "./http_errors.js";

export const productAdminRouter = Router();

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

function setAdminSessionCookie(response: Response, rawToken: string): void {
  response.cookie(ADMIN_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS * 1000
  });
}

function clearAdminSessionCookie(response: Response): void {
  response.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

function rethrowActionError(error: unknown): never {
  if (error instanceof AdminActionError) {
    throw error.status === 404
      ? notFound(error.message, { failure_token: error.message })
      : error.status === 409
        ? conflict(error.message, { failure_token: error.message })
        : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

productAdminRouter.post(
  "/sign-in",
  asyncHandler(async (request, response) => {
    const session = await signInAdminAccount(request.body);
    setAdminSessionCookie(response, session.raw_session_token);
    return response.status(200).json({
      admin: session.admin,
      csrf_token: session.csrf_token,
      session_expires_at_iso8601: session.expires_at_iso8601
    });
  })
);

productAdminRouter.post(
  "/sign-out",
  asyncHandler(async (request, response) => {
    const rawToken = adminCookieValue(request, ADMIN_SESSION_COOKIE);
    await signOutAdminSession(rawToken);
    clearAdminSessionCookie(response);
    return response.status(200).json({ ok: true });
  })
);

productAdminRouter.get(
  "/accounts",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const accounts = await searchAdminAccounts(request.query.query);
    return response.status(200).json({ accounts });
  })
);

productAdminRouter.get(
  "/accounts/:user_id",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const detail = await getAdminAccountDetail(String(request.params.user_id));
    if (!detail) throw notFound("ADMIN_ACCOUNT_NOT_FOUND", { failure_token: "admin_account_not_found" });
    return response.status(200).json({ account: detail });
  })
);

productAdminRouter.post(
  "/accounts/:user_id/state",
  asyncHandler(async (request, response) => {
    const admin = await authenticatedAdmin(request, true);
    const body = request.body ?? {};

    try {
      const outcome = await changeAccountState(
        admin.user_id,
        String(body.correlation_id ?? ""),
        String(request.params.user_id),
        String(body.account_state ?? "")
      );
      return response.status(200).json({ ok: true, audit: outcome });
    }
    catch (error) {
      rethrowActionError(error);
    }
  })
);

productAdminRouter.post(
  "/accounts/:user_id/test-marking",
  asyncHandler(async (request, response) => {
    const admin = await authenticatedAdmin(request, true);
    const body = request.body ?? {};

    try {
      const outcome = await setTestAccountMarking(
        admin.user_id,
        String(body.correlation_id ?? ""),
        String(request.params.user_id),
        body.marked === true,
        body.reason
      );
      return response.status(200).json({ ok: true, audit: outcome });
    }
    catch (error) {
      rethrowActionError(error);
    }
  })
);

productAdminRouter.get(
  "/commercial",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const records = await listAdminCommercialRecords(request.query.user_id);
    return response.status(200).json({ records });
  })
);

productAdminRouter.get(
  "/support-requests",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const reports = await listAdminSupportRequests(request.query.status);
    return response.status(200).json({ reports });
  })
);

productAdminRouter.post(
  "/support-requests/:correlation_id/status",
  asyncHandler(async (request, response) => {
    const admin = await authenticatedAdmin(request, true);
    const body = request.body ?? {};

    try {
      const outcome = await changeSupportRequestStatus(
        admin.user_id,
        String(body.correlation_id ?? ""),
        String(request.params.correlation_id),
        String(body.status ?? "")
      );
      return response.status(200).json({ ok: true, audit: outcome });
    }
    catch (error) {
      rethrowActionError(error);
    }
  })
);

productAdminRouter.get(
  "/data-rights/exports",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const requests = await listAdminDataExportRequests(request.query.user_id);
    return response.status(200).json({ requests });
  })
);

productAdminRouter.get(
  "/data-rights/deletions",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const requests = await listAdminDataDeletionRequests(request.query.user_id);
    return response.status(200).json({ requests });
  })
);

productAdminRouter.get(
  "/audit-records",
  asyncHandler(async (request, response) => {
    await authenticatedAdmin(request, false);
    const records = await listAdminAuditRecords(request.query.user_id);
    return response.status(200).json({ records });
  })
);

// AdminAuthError is not an ApiError, so without this router-scoped handler
// it would otherwise reach the generic error mapper, which mistakes its
// string message for a Postgres error code and returns a misleading 500
// instead of the correct 401/403/423/429.
productAdminRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (!(error instanceof AdminAuthError)) {
      next(error);
      return;
    }
    response.status(error.status).json({ error: error.message });
  }
);
