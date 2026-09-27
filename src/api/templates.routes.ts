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
