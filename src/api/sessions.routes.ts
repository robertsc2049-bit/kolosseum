import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import {
  appendRuntimeEvent,
  getDecisionSummaryByRunId,
  getSessionState,
  listRuntimeEvents,
  planSession,
  startSession
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

sessionsRouter.post("/plan", asyncHandler(planSession));
sessionsRouter.get("/decision-summary/:run_id", asyncHandler(getDecisionSummaryByRunId));
sessionsRouter.post("/:session_id/start", asyncHandler(startSession));
sessionsRouter.post("/:session_id/events", asyncHandler(appendRuntimeEvent));
sessionsRouter.get("/:session_id/events", asyncHandler(listRuntimeEvents));
sessionsRouter.get("/:session_id/state", asyncHandler(getSessionState));
