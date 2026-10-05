// DEV NOTE: BETA-18 coach programme template product routes.

import {
  Router
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
import { authenticatedCoach } from "./coach_session_auth.js";
import { StarterTemplateError, createKolosseumStarterTemplate } from "./kolosseum_starter_template_service.js";
import { ProgrammeCatalogueError, copyProgrammeForCoach, getProgrammeListingForTemplate, listProgrammesForCoaches, saveProgrammeListing } from "./programme_catalogue_service.js";

export const templatesRouter =
  Router();

// "Start from a Kolosseum programme": a draft template built from the
// engine's programme for a sport, level and days a week. The coach comes
// from their session, not the request body; rate-limited like every newly-
// added authorising route (CodeQL js/missing-rate-limiting).
const starterRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
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
const coachCatalogueRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
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
const catalogueRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
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
