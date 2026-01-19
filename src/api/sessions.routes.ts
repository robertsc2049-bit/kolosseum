import { Router } from "express";
import {
  createSession,
  startSession,
  appendRuntimeEvent,
  getSessionState
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

sessionsRouter.post("/", createSession);
sessionsRouter.post("/:session_id/start", startSession);
sessionsRouter.post("/:session_id/events", appendRuntimeEvent);
sessionsRouter.get("/:session_id/state", getSessionState);
