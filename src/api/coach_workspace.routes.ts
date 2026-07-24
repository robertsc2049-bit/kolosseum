// DEV NOTE: BETA-19 coach programme workspace routes.

import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import {
  createAthleteProfileAssignment,
  createCoachEventHandler,
  getAthleteEventLinks,
  getAthleteStrengthProfile,
  getCoachAssignments,
  getCoachEvents,
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
  "/events",
  asyncHandler(getCoachEvents)
);

coachWorkspaceRouter.post(
  "/events",
  asyncHandler(createCoachEventHandler)
);

coachWorkspaceRouter.get(
  "/athlete-event-links",
  asyncHandler(getAthleteEventLinks)
);

coachWorkspaceRouter.post(
  "/athlete-assignment",
  asyncHandler(createAthleteProfileAssignment)
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
