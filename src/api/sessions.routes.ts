
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import {
  appendRuntimeEvent,
  createBeta16Acknowledgement,
  createBeta16Auth,
  createBeta16Declaration,
  createBeta17Assignment,
  createBeta17CoachNote,
  createBeta17CoachProfile,
  createBeta17Relationship,
  getAthleteHistoryDetail,
  getAthleteHistoryExport,
  getAthleteTodayView,
  getBeta17CoachArtefacts,
  getBetaAthleteHistory,
  getDecisionSummaryByRunId,
  getSessionState,
  listRuntimeEvents,
  planSession,
  postSessionSubstitutionRequest,
  startSession
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

sessionsRouter.post(
  "/beta-auth",
  asyncHandler(createBeta16Auth)
);

sessionsRouter.post(
  "/beta-acknowledgement",
  asyncHandler(
    createBeta16Acknowledgement
  )
);

sessionsRouter.post(
  "/beta-declaration",
  asyncHandler(createBeta16Declaration)
);

sessionsRouter.post(
  "/beta-coach-profile",
  asyncHandler(createBeta17CoachProfile)
);

sessionsRouter.post(
  "/beta-coach-relationship",
  asyncHandler(createBeta17Relationship)
);

sessionsRouter.post(
  "/beta-coach-assignment",
  asyncHandler(createBeta17Assignment)
);

sessionsRouter.post(
  "/beta-coach-artefacts",
  asyncHandler(getBeta17CoachArtefacts)
);

sessionsRouter.post(
  "/beta-coach-notes",
  asyncHandler(createBeta17CoachNote)
);

sessionsRouter.post(
  "/beta-athlete-history",
  asyncHandler(getBetaAthleteHistory)
);

sessionsRouter.post(
  "/beta-athlete-history-detail",
  asyncHandler(getAthleteHistoryDetail)
);

sessionsRouter.post(
  "/beta-athlete-history-export",
  asyncHandler(getAthleteHistoryExport)
);

sessionsRouter.post(
  "/beta-athlete-today",
  asyncHandler(getAthleteTodayView)
);

sessionsRouter.post("/plan", asyncHandler(planSession));
sessionsRouter.get("/decision-summary/:run_id", asyncHandler(getDecisionSummaryByRunId));
sessionsRouter.post("/:session_id/start", asyncHandler(startSession));
sessionsRouter.post("/:session_id/events", asyncHandler(appendRuntimeEvent));
sessionsRouter.get("/:session_id/events", asyncHandler(listRuntimeEvents));
sessionsRouter.get("/:session_id/state", asyncHandler(getSessionState));
sessionsRouter.post("/:session_id/substitution-request", asyncHandler(postSessionSubstitutionRequest));
