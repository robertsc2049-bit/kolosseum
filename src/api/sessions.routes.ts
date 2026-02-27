// src/api/sessions.routes.ts
import { Router } from "express";
import { asyncHandler } from "./async_handler.js";
import {
  startSession,
  appendRuntimeEvent,
  listRuntimeEvents,
  getSessionState,
  planSession
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

// Vertical slice: plan session via engine(dist)
sessionsRouter.post("/plan", asyncHandler(planSession));

// Existing session runtime endpoints
sessionsRouter.post("/:session_id/start", asyncHandler(startSession));
sessionsRouter.post("/:session_id/events", asyncHandler(appendRuntimeEvent));
sessionsRouter.get("/:session_id/events", asyncHandler(listRuntimeEvents));
sessionsRouter.get("/:session_id/state", asyncHandler(getSessionState));