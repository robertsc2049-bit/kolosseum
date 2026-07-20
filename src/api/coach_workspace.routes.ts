// DEV NOTE: BETA-19 coach programme workspace routes.

import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import {
  getAthleteStrengthProfile,
  getCoachAssignments,
  getConnectedCoachAthletes,
  previewEventProgrammeCalendar,
  saveAthleteStrengthProfileHandler
} from "./coach_workspace.handlers.js";

export const coachWorkspaceRouter = Router();

coachWorkspaceRouter.get(
  "/athletes",
  asyncHandler(getConnectedCoachAthletes)
);

coachWorkspaceRouter.get(
  "/assignments",
  asyncHandler(getCoachAssignments)
);

coachWorkspaceRouter.get(
  "/athlete-strength-profile",
  asyncHandler(getAthleteStrengthProfile)
);

coachWorkspaceRouter.post(
  "/athlete-strength-profile",
  asyncHandler(saveAthleteStrengthProfileHandler)
);


coachWorkspaceRouter.post(
  "/event-compile-preview",
  asyncHandler(previewEventProgrammeCalendar)
);
