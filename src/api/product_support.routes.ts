// DEV NOTE: FULL-UI-20 factual status, support and error-reporting. Session-
// authenticated exactly like every other account-scoped surface
// (product_account.routes.ts, product_notification.routes.ts) - this file
// never accepts a caller-supplied recipient id.

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
  createSupportReport,
  listSupportReportsForUser,
  ProductSupportError
} from "./product_support_service.js";
import { badRequest, conflict } from "./http_errors.js";

export const productSupportRouter = Router();

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

function rethrowSupportError(error: unknown): never {
  if (error instanceof ProductSupportError) {
    throw error.status === 409
      ? conflict(error.message, { failure_token: error.message })
      : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

productSupportRouter.post(
  "/support/reports",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    assertMutationAuthorised(request, token);
    const session = await resolveProductSession(token);

    try {
      const report = await createSupportReport(session.account_row.user_id, request.body);
      return response.status(201).json({ ok: true, report });
    }
    catch (error) {
      rethrowSupportError(error);
    }
  })
);

productSupportRouter.get(
  "/support/reports",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    const session = await resolveProductSession(token);
    const reports = await listSupportReportsForUser(session.account_row.user_id);
    return response.status(200).json({ reports });
  })
);

// ProductAccountError is not an ApiError, so without this router-scoped
// handler it would otherwise reach the generic error mapper, which
// mistakes its string `code` field for a Postgres error code and returns a
// misleading 500 instead of the correct 401/423.
productSupportRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (!(error instanceof ProductAccountError)) {
      next(error);
      return;
    }

    response.status(error.status).json({
      error: error.code,
      account_state: error.account_state ?? null
    });
  }
);
