// DEV NOTE: BETA-18 coach programme template product routes.

import {
  Router,
  type Response
} from "express";

import {
  asyncHandler
} from "./async_handler.js";
import {
  activateCoachTemplate,
  archiveCoachTemplate,
  bindCoachTemplateEvent,
  completeCoachTemplate,
  duplicateCoachTemplate,
  getCoachTemplateEventBinding,
  getCoachTemplates,
  getTemplateExercises,
  saveCoachTemplate
} from "./templates.handlers.js";

import { rateLimit } from "express-rate-limit";
import { accountRateLimitKey } from "./rate_limit_key.js";
import { authenticatedCoach } from "./coach_session_auth.js";
import { StarterTemplateError, createKolosseumStarterTemplate } from "./kolosseum_starter_template_service.js";
import { ProgrammeGrantError, giveProgrammeGrant, listCoachProgrammeGrants, revokeProgrammeGrant } from "./programme_grant_service.js";
import { ProgrammeCatalogueError, copyProgrammeForCoach, getProgrammeListingForTemplate, listProgrammesForCoaches, saveProgrammeListing } from "./programme_catalogue_service.js";

export const templatesRouter =
  Router();

// "Start from a Kolosseum programme": a draft template built from the
// engine's programme for a sport, level and days a week. The coach comes
// from their session, not the request body; rate-limited like every newly-
// added authorising route (CodeQL js/missing-rate-limiting).
const starterRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
templatesRouter.post(
  "/kolosseum-starter",
  starterRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    try {
      const template = await createKolosseumStarterTemplate(coachUserId, request.body);
      return response.status(201).json({ ok: true, template });
    }
    catch (error) {
      if (error instanceof StarterTemplateError) {
        return response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      }
      throw error;
    }
  })
);

// Kolosseum programmes for coaches: browse the listed ones, and copy one into
// your own library as a draft (programme_catalogue_service.ts).
const coachCatalogueRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
templatesRouter.get(
  "/kolosseum-programmes",
  coachCatalogueRateLimit,
  asyncHandler(async (request, response) => {
    await authenticatedCoach(request, false);
    return response.status(200).json(await listProgrammesForCoaches());
  })
);
templatesRouter.post(
  "/kolosseum-programmes/:listing_id/copy",
  coachCatalogueRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    try {
      return response.status(201).json({ ok: true, template: await copyProgrammeForCoach(coachUserId, request.params.listing_id) });
    }
    catch (error) {
      if (error instanceof ProgrammeCatalogueError) return response.status(error.status).json({ error: error.code });
      throw error;
    }
  })
);

// Programmes a coach sells outside the app and gives in it
// (programme_grant_service.ts): their grants and allowance, give one of their
// active programmes to an athlete by email, take back one not yet accepted.
const programmeGrantRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const programmeGrantError = (response: Response, error: unknown) => {
  if (error instanceof ProgrammeGrantError) return response.status(error.status).json({ ok: false, error: error.code });
  throw error;
};
templatesRouter.get(
  "/programme-grants",
  programmeGrantRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    return response.status(200).json(await listCoachProgrammeGrants(coachUserId));
  })
);
templatesRouter.post(
  "/:template_id/programme-grants",
  programmeGrantRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    try { return response.status(201).json(await giveProgrammeGrant(coachUserId, request.params.template_id, request.body)); }
    catch (error) { return programmeGrantError(response, error); }
  })
);
templatesRouter.post(
  "/programme-grants/:grant_id/revoke",
  programmeGrantRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    try { return response.status(200).json(await revokeProgrammeGrant(coachUserId, request.params.grant_id)); }
    catch (error) { return programmeGrantError(response, error); }
  })
);

templatesRouter.get(
  "/exercises",
  asyncHandler(
    getTemplateExercises
  )
);

templatesRouter.get(
  "/",
  asyncHandler(
    getCoachTemplates
  )
);

templatesRouter.post(
  "/",
  asyncHandler(
    saveCoachTemplate
  )
);

templatesRouter.post(
  "/:template_id/complete",
  asyncHandler(
    completeCoachTemplate
  )
);

// Kolosseum programmes: a catalogue author lists one of their active
// programmes for athletes without a coach (programme_catalogue_service.ts).
const catalogueRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
templatesRouter.get(
  "/:template_id/catalogue-listing",
  catalogueRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    return response.status(200).json(await getProgrammeListingForTemplate(coachUserId, String(request.params.template_id ?? "")));
  })
);
templatesRouter.put(
  "/:template_id/catalogue-listing",
  catalogueRateLimit,
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, true);
    try {
      return response.status(200).json({ listing: await saveProgrammeListing(coachUserId, String(request.params.template_id ?? ""), request.body) });
    }
    catch (error) {
      if (error instanceof ProgrammeCatalogueError) return response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      throw error;
    }
  })
);

templatesRouter.post(
  "/:template_id/activate",
  asyncHandler(
    activateCoachTemplate
  )
);

templatesRouter.post(
  "/:template_id/archive",
  asyncHandler(
    archiveCoachTemplate
  )
);

templatesRouter.post(
  "/:template_id/duplicate",
  asyncHandler(
    duplicateCoachTemplate
  )
);

templatesRouter.post(
  "/:template_id/bind-event",
  asyncHandler(
    bindCoachTemplateEvent
  )
);

templatesRouter.get(
  "/:template_id/event-binding",
  asyncHandler(
    getCoachTemplateEventBinding
  )
);
