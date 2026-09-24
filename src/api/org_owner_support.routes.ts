// DEV NOTE: FULL-UI-95 org-owner support/error-reporting parity routes.
// Mounted at its own /org prefix, alongside orgOwnerRouter - every route
// resolves identity from authenticatedOrgOwner (the org owner session
// cookie) only, exactly like every other org-scoped route file. Mirrors
// product_support.routes.ts (FULL-UI-20) exactly.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { rateLimit } from "express-rate-limit";

import { authenticatedOrgOwner } from "./org_owner_auth.js";
import {
  OrgOwnerSupportError,
  createOrgOwnerSupportReport,
  listOrgOwnerSupportReportsForUser
} from "./org_owner_support_service.js";
import { notifySupportRequestCreated } from "./support_alert_notifier.js";
import { badRequest, conflict } from "./http_errors.js";

export const orgOwnerSupportRouter = Router();

// CodeQL's js/missing-rate-limiting query flags newly-added authorising
// routes, including GET - matches the existing orgOwnerDataRightsRateLimit/
// orgOwnerAdminRateLimit precedent in org_owner.routes.ts/product_admin.routes.ts.
const orgOwnerSupportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

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

function rethrowSupportError(error: unknown): never {
  if (error instanceof OrgOwnerSupportError) {
    throw error.status === 409
      ? conflict(error.message, { failure_token: error.message })
      : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

orgOwnerSupportRouter.post(
  "/support/reports",
  orgOwnerSupportRateLimit,
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, true);

    try {
      const report = await createOrgOwnerSupportReport(user_id, request.body);
      await notifySupportRequestCreated({
        actor_type: "org_owner",
        correlation_id: String(report.correlation_id),
        user_id,
        description: String(report.description)
      });
      return response.status(201).json({ ok: true, report });
    }
    catch (error) {
      rethrowSupportError(error);
    }
  })
);

orgOwnerSupportRouter.get(
  "/support/reports",
  orgOwnerSupportRateLimit,
  asyncHandler(async (request, response) => {
    const { user_id } = await authenticatedOrgOwner(request, false);
    const reports = await listOrgOwnerSupportReportsForUser(user_id);
    return response.status(200).json({ reports });
  })
);
