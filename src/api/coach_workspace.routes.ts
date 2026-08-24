// DEV NOTE: BETA-19 coach programme workspace routes.

import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import {
  acceptAthleteRelationshipInvitationHandler,
  createAthleteProfileAssignment,
  createCoachEventHandler,
  createCoachRelationshipInvitationHandler,
  declineAthleteRelationshipInvitationHandler,
  endAthleteRelationshipHandler,
  exportCoachAthleteRosterCsv,
  getAthleteEventLinks,
  getAthleteStrengthProfile,
  getCoachAssignments,
  getCoachAthleteRelationships,
  getCoachEvents,
  getCoachEventsCalendar,
  getAthleteOrgContextHandler,
  getConnectedCoachAthletes,
  listAthleteOwnRelationshipsHandler,
  listAthleteRelationshipInvitationsHandler,
  previewEventProgrammeCalendar,
  saveAthleteStrengthProfileHandler
} from "./coach_workspace.handlers.js";
import {
  archiveStandaloneEventHandler,
  cancelStandaloneEventHandler,
  createStandaloneEventHandler,
  createStandaloneEventVersionHandler,
  getStandaloneEventDetailHandler,
  getStandaloneEventLibraryHandler,
  linkStandaloneEventAthleteHandler,
  unlinkStandaloneEventAthleteHandler
} from "./full_ui_09c_event_lifecycle.handlers.js";

// FULL-UI-04B athlete-detail handler import.
import {
  getCoachAthleteDetail
} from "./coach_workspace.handlers.js";

export const coachWorkspaceRouter = Router();

coachWorkspaceRouter.get(
  "/relationships",
  asyncHandler(getCoachAthleteRelationships)
);

coachWorkspaceRouter.get(
  "/relationships/export.csv",
  asyncHandler(exportCoachAthleteRosterCsv)
);

coachWorkspaceRouter.get(
  "/athletes",
  asyncHandler(getConnectedCoachAthletes)
);

coachWorkspaceRouter.get(
  "/assignments",
  asyncHandler(getCoachAssignments)
);

// Existing BETA-19 routes remain available for earlier slice compatibility.
coachWorkspaceRouter.get(
  "/events",
  asyncHandler(getCoachEvents)
);
coachWorkspaceRouter.post(
  "/events",
  asyncHandler(createCoachEventHandler)
);

// Calendar export must be registered before the /events/:event_id param
// route below, or "calendar.ics" would be swallowed as an event_id.
coachWorkspaceRouter.get(
  "/events/calendar.ics",
  asyncHandler(getCoachEventsCalendar)
);

// FULL-UI-09C authenticated standalone event lifecycle.
coachWorkspaceRouter.get(
  "/events/library",
  asyncHandler(getStandaloneEventLibraryHandler)
);
coachWorkspaceRouter.post(
  "/events/create",
  asyncHandler(createStandaloneEventHandler)
);
coachWorkspaceRouter.get(
  "/events/:event_id",
  asyncHandler(getStandaloneEventDetailHandler)
);
coachWorkspaceRouter.post(
  "/events/:event_id/version",
  asyncHandler(createStandaloneEventVersionHandler)
);
coachWorkspaceRouter.post(
  "/events/:event_id/cancel",
  asyncHandler(cancelStandaloneEventHandler)
);
coachWorkspaceRouter.post(
  "/events/:event_id/archive",
  asyncHandler(archiveStandaloneEventHandler)
);
coachWorkspaceRouter.post(
  "/events/:event_id/athletes/:athlete_id/link",
  asyncHandler(linkStandaloneEventAthleteHandler)
);
coachWorkspaceRouter.post(
  "/events/:event_id/athletes/:athlete_id/unlink",
  asyncHandler(unlinkStandaloneEventAthleteHandler)
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

coachWorkspaceRouter.get(
  "/athlete-detail",
  asyncHandler(getCoachAthleteDetail)
);

// FULL-UI-24 lawful, non-opaque-ID coach-athlete invitation.
coachWorkspaceRouter.post(
  "/relationship-invitations",
  asyncHandler(createCoachRelationshipInvitationHandler)
);
coachWorkspaceRouter.get(
  "/relationship-invitations",
  asyncHandler(listAthleteRelationshipInvitationsHandler)
);
coachWorkspaceRouter.post(
  "/relationship-invitations/:relationship_id/accept",
  asyncHandler(acceptAthleteRelationshipInvitationHandler)
);
coachWorkspaceRouter.post(
  "/relationship-invitations/:relationship_id/decline",
  asyncHandler(declineAthleteRelationshipInvitationHandler)
);

// FULL-UI-25 athlete-initiated relationship lifecycle: reading their own
// current+past relationships, and ending an accepted one from their profile.
coachWorkspaceRouter.get(
  "/relationships/mine",
  asyncHandler(listAthleteOwnRelationshipsHandler)
);
coachWorkspaceRouter.post(
  "/relationships/:relationship_id/end",
  asyncHandler(endAthleteRelationshipHandler)
);

// Part O.6 - athlete-facing team/org context (org_id, org_name,
// visibility_mode only, never a teammate roster), scoped to accepted
// relationships with an active org coach.
coachWorkspaceRouter.get(
  "/org-context/mine",
  asyncHandler(getAthleteOrgContextHandler)
);
