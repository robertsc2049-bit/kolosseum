// DEV NOTE: FULL-UI-67/68 - programme template marketplace visibility
// and release routes, mounted at /programme-marketplace. Coach identity
// is resolved via the shared authenticatedCoach helper
// (coach_session_auth.js) - never a client-supplied user_id. The browse
// route is coach-only (this is coach-to-coach template design sharing,
// not an athlete-facing surface) and returns only summary fields - no
// full template_structure. The release route is the one place the full
// template content crosses to another coach, and only after the owning
// coach deliberately releases it to a specific buyer's account code -
// no payment of any kind is processed, held, or transmitted here.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { authenticatedCoach } from "./coach_session_auth.js";
import {
  ProgrammeTemplateSharingError,
  listMarketplaceSharedTemplates,
  listProgrammeTemplateReleases,
  loadProgrammeTemplateSharingPreference,
  releaseProgrammeTemplateToCoach,
  saveProgrammeTemplateSharingPreference
} from "./programme_template_sharing_service.js";

export const programmeTemplateSharingRouter = Router();

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

programmeTemplateSharingRouter.get(
  "/templates",
  asyncHandler(async (request, response) => {
    await authenticatedCoach(request, false);
    const templates = await listMarketplaceSharedTemplates();
    return response.status(200).json({ ok: true, templates });
  })
);

programmeTemplateSharingRouter.get(
  "/templates/:template_id/sharing",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const preference = await loadProgrammeTemplateSharingPreference(
      coachUserId,
      String(request.params.template_id)
    );
    return response.status(200).json({ ok: true, sharing_preference: preference });
  })
);

programmeTemplateSharingRouter.post(
  "/templates/:template_id/sharing",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const record = await saveProgrammeTemplateSharingPreference(
      coachUserId,
      String(request.params.template_id),
      request.body ?? {}
    );
    return response.status(201).json({ ok: true, sharing_preference: record });
  })
);

programmeTemplateSharingRouter.post(
  "/templates/:template_id/release",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    const result = await releaseProgrammeTemplateToCoach(
      coachUserId,
      String(request.params.template_id),
      request.body?.buyer_account_code
    );
    return response.status(201).json({ ok: true, ...result });
  })
);

programmeTemplateSharingRouter.get(
  "/templates/:template_id/releases",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const releases = await listProgrammeTemplateReleases(coachUserId, String(request.params.template_id));
    return response.status(200).json({ ok: true, releases });
  })
);

programmeTemplateSharingRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof ProgrammeTemplateSharingError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
