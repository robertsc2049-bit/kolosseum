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
  duplicateCoachTemplate,
  getCoachTemplates,
  getTemplateExercises,
  saveCoachTemplate
} from "./templates.handlers.js";

export const templatesRouter =
  Router();

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
