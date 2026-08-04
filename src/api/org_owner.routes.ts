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
  OrgRosterError,
  createOrganisation,
  inviteCoachToOrganisation,
  listOrganisationRoster,
  listOrganisationsForOwner,
  removeCoachMembership
} from "./org_roster_service.js";

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
    const result = await createOrganisation(user_id, request.body?.org_name);
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

// OrgOwnerAuthError/OrgRosterError are not ApiError, so without this
// router-scoped handler they would otherwise reach the generic error
// mapper, which mistakes the string message for a Postgres error code and
// returns a misleading 500 instead of the correct status (mirrors the
// identical, deliberate pattern in product_admin.routes.ts).
orgOwnerRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof OrgOwnerAuthError || error instanceof OrgRosterError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
