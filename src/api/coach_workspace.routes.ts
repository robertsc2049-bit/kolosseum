// DEV NOTE: BETA-19 coach programme workspace routes.

import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { accountRateLimitKey } from "./rate_limit_key.js";

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
import { loadCoachAthleteProgramme } from "./athlete_my_programme_service.js";
import { analyseAthleteForCoach, analyseRosterForCoach } from "./coach_analysis_service.js";
import { AthleteTestInputError, listTestResultsForCoach, recordTestResult, removeTestResult } from "./athlete_tests_service.js";
import { InjuryInputError, listInjuriesForCoach, recordInjury, removeInjury, updateInjury } from "./injury_log_service.js";
import { ProgrammeOverrideError, clearProgrammeOverride, setProgrammeOverride } from "./athlete_programme_override_service.js";
import { analyseAthleteForHeadCoach } from "./team_analysis_service.js";
import { SquadEntryError, importExternalLoad, recordSquadSession, recordTestDay } from "./squad_entry_service.js";
import { CoachReportInputError, CoachReportNotFoundError, listCoachReports, loadCoachReport, previewAthleteReport, sendAthleteReport } from "./coach_report_service.js";
import { Beta19CoachWorkspaceError } from "./beta19_coach_workspace_service.js";

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
  keyGenerator: accountRateLimitKey,
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
  keyGenerator: accountRateLimitKey,
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
  keyGenerator: accountRateLimitKey,
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


// The coach's printable copy of an athlete's current programme - with the
// % of max behind every weight, the athlete's maxes and bodyweight history
// (athlete_my_programme_service.ts). Only for the coach who assigned it.
const coachProgrammePrintRateLimit = rateLimit({
  keyGenerator: accountRateLimitKey,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

coachWorkspaceRouter.get(
  "/athletes/:athlete_id/programme-print",
  coachProgrammePrintRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try {
      return res.status(200).json(await loadCoachAthleteProgramme(coachUserId, String(req.params.athlete_id)));
    }
    catch (error) {
      if (error instanceof Beta19CoachWorkspaceError) return res.status(403).json({ ok: false, error: error.message });
      throw error;
    }
  })
);

// Coach Analysis (coach_analysis_service.ts): every connected athlete ranked
// by how much needs a look, and one athlete's pattern trends over 4-26 weeks.
const coachAnalysisRateLimit = rateLimit({
  keyGenerator: accountRateLimitKey,
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

coachWorkspaceRouter.get(
  "/analysis",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    return res.status(200).json(await analyseRosterForCoach(coachUserId));
  })
);

coachWorkspaceRouter.get(
  "/athletes/:athlete_id/analysis",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try {
      return res.status(200).json(await analyseAthleteForCoach(coachUserId, String(req.params.athlete_id), req.query.weeks));
    }
    catch (error) {
      if (error instanceof Beta19CoachWorkspaceError) {
        // A team's head coach can open a teammate who isn't theirs.
        const weeks = [4, 8, 12, 26].includes(Number(req.query.weeks)) ? Number(req.query.weeks) : 12;
        const asHead = await analyseAthleteForHeadCoach(coachUserId, String(req.params.athlete_id), weeks);
        if (asHead) return res.status(200).json(asHead);
        return res.status(403).json({ ok: false, error: error.message });
      }
      throw error;
    }
  })
);

// Progress reports: every week, programme block, training cycle, programme
// and year the athlete has trained in, and one of them compiled.
coachWorkspaceRouter.get(
  "/athletes/:athlete_id/reports",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try {
      return res.status(200).json(await listCoachReports(coachUserId, String(req.params.athlete_id)));
    }
    catch (error) {
      if (error instanceof Beta19CoachWorkspaceError) return res.status(403).json({ ok: false, error: error.message });
      throw error;
    }
  })
);

coachWorkspaceRouter.get(
  "/athletes/:athlete_id/reports/:report_type/:report_id",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try {
      return res.status(200).json(await loadCoachReport(coachUserId, String(req.params.athlete_id), String(req.params.report_type), String(req.params.report_id)));
    }
    catch (error) {
      if (error instanceof Beta19CoachWorkspaceError) return res.status(403).json({ ok: false, error: error.message });
      if (error instanceof CoachReportNotFoundError) return res.status(404).json({ ok: false, error: error.message });
      throw error;
    }
  })
);

// Performance tests the coach records for their athlete (athlete_tests_service.ts).
const testErrorStatus = (error: unknown) =>
  error instanceof Beta19CoachWorkspaceError ? 403 : error instanceof AthleteTestInputError ? error.status : null;

coachWorkspaceRouter.get(
  "/athletes/:athlete_id/tests",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try { return res.status(200).json(await listTestResultsForCoach(coachUserId, String(req.params.athlete_id))); }
    catch (error) { const status = testErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
  })
);

coachWorkspaceRouter.post(
  "/athletes/:athlete_id/tests",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    try { return res.status(200).json(await recordTestResult(coachUserId, String(req.params.athlete_id), req.body)); }
    catch (error) { const status = testErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
  })
);

coachWorkspaceRouter.post(
  "/athletes/:athlete_id/tests/remove",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    try { return res.status(200).json(await removeTestResult(coachUserId, String(req.params.athlete_id), req.body)); }
    catch (error) { const status = testErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
  })
);

// Adjusting the coach's programme for one athlete (athlete_programme_override_service.ts).
const overrideErrorStatus = (error: unknown) =>
  error instanceof Beta19CoachWorkspaceError ? 403 : error instanceof ProgrammeOverrideError ? error.status : null;
const overrideHandler = (work: (coachUserId: string, req: Request) => Promise<unknown>) => asyncHandler(async (req, res) => {
  const coachUserId = await authenticatedCoach(req, true);
  try { return res.status(200).json(await work(coachUserId, req)); }
  catch (error) { const status = overrideErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
});
coachWorkspaceRouter.post("/athletes/:athlete_id/programme-overrides", coachAnalysisRateLimit, overrideHandler((coachUserId, req) => setProgrammeOverride(coachUserId, String(req.params.athlete_id), req.body)));
coachWorkspaceRouter.post("/athletes/:athlete_id/programme-overrides/clear", coachAnalysisRateLimit, overrideHandler((coachUserId, req) => clearProgrammeOverride(coachUserId, String(req.params.athlete_id), req.body)));

// The injury log (injury_log_service.ts): the athlete's own coach or a
// team's head coach records an injury, moves it on, or removes a mistake.
const injuryErrorStatus = (error: unknown) =>
  error instanceof Beta19CoachWorkspaceError ? 403 : error instanceof InjuryInputError ? error.status : null;
const injuryHandler = (work: (coachUserId: string, req: Request) => Promise<unknown>) => asyncHandler(async (req, res) => {
  const coachUserId = await authenticatedCoach(req, true);
  try { return res.status(200).json(await work(coachUserId, req)); }
  catch (error) { const status = injuryErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
});
coachWorkspaceRouter.get("/athletes/:athlete_id/injuries", coachAnalysisRateLimit, asyncHandler(async (req, res) => {
  const coachUserId = await authenticatedCoach(req, false);
  try { return res.status(200).json(await listInjuriesForCoach(coachUserId, String(req.params.athlete_id))); }
  catch (error) { const status = injuryErrorStatus(error); if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); throw error; }
}));
coachWorkspaceRouter.post("/athletes/:athlete_id/injuries", coachAnalysisRateLimit, injuryHandler((coachUserId, req) => recordInjury(coachUserId, String(req.params.athlete_id), req.body)));
coachWorkspaceRouter.post("/athletes/:athlete_id/injuries/:injury_id/status", coachAnalysisRateLimit, injuryHandler((coachUserId, req) => updateInjury(coachUserId, String(req.params.athlete_id), String(req.params.injury_id), req.body)));
coachWorkspaceRouter.post("/athletes/:athlete_id/injuries/:injury_id/remove", coachAnalysisRateLimit, injuryHandler((coachUserId, req) => removeInjury(coachUserId, String(req.params.athlete_id), String(req.params.injury_id))));

// Getting a squad's data in at once (squad_entry_service.ts): a squad
// session's effort, a test day, a GPS / heart-rate import.
const squadEntryRateLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
// Each route is written out (not generated) so the route catalog guard sees it.
const squadHandler = (work: (coachUserId: string, body: unknown) => Promise<unknown>) => asyncHandler(async (req, res) => {
  const coachUserId = await authenticatedCoach(req, true);
  try { return res.status(200).json(await work(coachUserId, req.body)); }
  catch (error) { if (error instanceof SquadEntryError) return res.status(error.status).json({ ok: false, error: error.message }); throw error; }
});
coachWorkspaceRouter.post("/squad/sessions", squadEntryRateLimit, squadHandler(recordSquadSession));
coachWorkspaceRouter.post("/squad/test-day", squadEntryRateLimit, squadHandler(recordTestDay));
coachWorkspaceRouter.post("/squad/external-load", squadEntryRateLimit, squadHandler(importExternalLoad));

const reportErrorStatus = (error: unknown) =>
  error instanceof Beta19CoachWorkspaceError ? 403 : error instanceof CoachReportNotFoundError ? 404 : error instanceof CoachReportInputError ? 400 : null;

// The athlete's copy of a report, as they would get it (no estimated maxes,
// load ratios or flags), and sending it to them with the coach's message.
coachWorkspaceRouter.get(
  "/athletes/:athlete_id/reports/:report_type/:report_id/athlete-copy",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, false);
    try {
      return res.status(200).json(await previewAthleteReport(coachUserId, String(req.params.athlete_id), String(req.params.report_type), String(req.params.report_id)));
    }
    catch (error) {
      const status = reportErrorStatus(error);
      if (status) return res.status(status).json({ ok: false, error: (error as Error).message });
      throw error;
    }
  })
);

coachWorkspaceRouter.post(
  "/athletes/:athlete_id/reports/:report_type/:report_id/send",
  coachAnalysisRateLimit,
  asyncHandler(async (req, res) => {
    const coachUserId = await authenticatedCoach(req, true);
    try {
      return res.status(200).json(await sendAthleteReport(coachUserId, String(req.params.athlete_id), String(req.params.report_type), String(req.params.report_id), req.body));
    }
    catch (error) {
      const status = reportErrorStatus(error);
      if (status) return res.status(status).json({ ok: false, error: (error as Error).message });
      throw error;
    }
  })
);
