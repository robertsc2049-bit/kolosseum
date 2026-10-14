// DEV NOTE: BETA-19 coach programme workspace routes.

import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { asyncHandler } from "./async_handler.js";
import { authenticatedCoach } from "./coach_session_auth.js";
import {
  ExerciseDemoVideoError,
  listExerciseDemoVideos,
  removeExerciseDemoVideo,
  setExerciseDemoUpload,
  setExerciseDemoVideo
} from "./exercise_demo_video_service.js";
import {
  ExerciseDemoUploadError,
  discardStagedDemoUpload,
  exerciseDemoUpload,
  finalizeDemoUpload,
  validateStagedDemoUpload
} from "./exercise_demo_video_storage.js";
import { badRequest, conflict, notFound } from "./http_errors.js";
import { OrgHandoverError, acceptOrgHandover, listPendingOrgHandovers } from "./org_handover_service.js";
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
  getAthleteActivityChangeStateHandler,
  getAthletePositionChangeStateHandler,
  previewEventProgrammeCalendar,
  proposeAthleteActivityChangeHandler,
  proposeAthletePositionChangeHandler,
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

// DEV NOTE: rate-limited (unlike this file's older neighbours) because
// CodeQL's js/missing-rate-limiting query flags newly-added authorising
// routes - see coach_onboarding.routes.ts's own accessibilityPreferencesRateLimit
// for the identical precedent this mirrors.
const athleteActivityChangeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

coachWorkspaceRouter.get(
  "/athlete-activity-change",
  athleteActivityChangeRateLimit,
  asyncHandler(getAthleteActivityChangeStateHandler)
);

coachWorkspaceRouter.post(
  "/athlete-activity-change-proposal",
  athleteActivityChangeRateLimit,
  asyncHandler(proposeAthleteActivityChangeHandler)
);

coachWorkspaceRouter.get(
  "/athlete-position-change",
  athleteActivityChangeRateLimit,
  asyncHandler(getAthletePositionChangeStateHandler)
);

coachWorkspaceRouter.post(
  "/athlete-position-change-proposal",
  athleteActivityChangeRateLimit,
  asyncHandler(proposeAthletePositionChangeHandler)
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

// A coach's own exercise demo videos (exercise_demo_video_service.ts): a
// YouTube/Vimeo link shown to them and their athletes instead of the default.
const exerciseDemoVideoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

function rethrowDemoVideoError(error: unknown): never {
  if (error instanceof ExerciseDemoVideoError || error instanceof ExerciseDemoUploadError) {
    throw error.status === 404
      ? notFound(error.message, { failure_token: error.message })
      : badRequest(error.message, { failure_token: error.message });
  }
  throw error;
}

coachWorkspaceRouter.get(
  "/exercise-demo-videos",
  exerciseDemoVideoRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    return res.status(200).json({ ok: true, demo_videos: await listExerciseDemoVideos(coachUserId) });
  })
);

coachWorkspaceRouter.put(
  "/exercise-demo-videos/:exercise_id",
  exerciseDemoVideoRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    try {
      const demo = await setExerciseDemoVideo(String(req.params.exercise_id), coachUserId, coachUserId, req.body?.video_url);
      return res.status(200).json({ ok: true, demo_video: demo });
    }
    catch (error) {
      return rethrowDemoVideoError(error);
    }
  })
);

coachWorkspaceRouter.delete(
  "/exercise-demo-videos/:exercise_id",
  exerciseDemoVideoRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    await removeExerciseDemoVideo(String(req.params.exercise_id), coachUserId);
    return res.status(200).json({ ok: true });
  })
);

// A coach's own clip of the exercise (MP4/MOV from their phone). The session
// and CSRF are checked before the upload is accepted at all; a rejected or
// failed upload never leaves its staged file behind.
coachWorkspaceRouter.post(
  "/exercise-demo-videos/:exercise_id/upload",
  exerciseDemoVideoRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    authenticatedCoach(req, true).then((coachUserId) => {
      res.locals.coachUserId = coachUserId;
      next();
    }, next);
  },
  exerciseDemoUpload.single("video"),
  asyncHandler(async (req, res) => {
    const staged = req.file ? { path: req.file.path } : undefined;
    let pending = null;
    try {
      pending = await validateStagedDemoUpload(staged);
      const stored = await finalizeDemoUpload(pending);
      pending = null;
      const demo = await setExerciseDemoUpload(String(req.params.exercise_id), String(res.locals.coachUserId), stored);
      return res.status(201).json({ ok: true, demo_video: demo });
    }
    catch (error) {
      await discardStagedDemoUpload(pending);
      return rethrowDemoVideoError(error);
    }
  })
);

// Organisations handed to this coach after their owner was erased
// (org_handover_service.ts): listed on their workspace, taken over by
// choosing a password for the organisation app.
const orgHandoverRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

coachWorkspaceRouter.get(
  "/org-handovers",
  orgHandoverRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    return res.status(200).json({ ok: true, handovers: await listPendingOrgHandovers(coachUserId) });
  })
);

coachWorkspaceRouter.post(
  "/org-handovers/:org_id/accept",
  orgHandoverRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    try {
      const result = await acceptOrgHandover(coachUserId, String(req.params.org_id), req.body?.password);
      return res.status(200).json({ ok: true, handover: result });
    }
    catch (error) {
      if (error instanceof OrgHandoverError) {
        throw error.status === 404
          ? notFound(error.message, { failure_token: error.message })
          : error.status === 409
            ? conflict(error.message, { failure_token: error.message })
            : badRequest(error.message, { failure_token: error.message });
      }
      throw error;
    }
  })
);

