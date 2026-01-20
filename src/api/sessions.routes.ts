// src/api/sessions.routes.ts
import { Router } from "express";
import {
  startSession,
  appendRuntimeEvent,
  listRuntimeEvents,
  getSessionState
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

sessionsRouter.post("/:session_id/start", startSession);
sessionsRouter.post("/:session_id/events", appendRuntimeEvent);
sessionsRouter.get("/:session_id/events", listRuntimeEvents);
sessionsRouter.get("/:session_id/state", getSessionState);
