/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/sessions.handlers.ts
import type { Request, Response } from "express";

import { badRequest } from "./http_errors.js";
import {
  appendRuntimeEventMutation,
  extractRawEventFromBody,
  startSessionMutation
} from "./session_state_write_service.js";
import { planSessionService } from "./plan_session_service.js";
import { listRuntimeEventsQuery } from "./session_events_query_service.js";
import {
  getDecisionSummaryByRunIdQuery,
  getSessionStateQuery
} from "./session_state_query_service.js";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function planSession(req: Request, res: Response) {
  const bodyUnknown = req.body as unknown;

  let input: any;
  if (isRecord(bodyUnknown)) input = (bodyUnknown as any).input ?? bodyUnknown;
  else if (typeof bodyUnknown === "undefined" || bodyUnknown === null) input = {};
  else throw badRequest("Invalid JSON body (expected object)");

  const out = await planSessionService(input);
  return res.status(200).json(out);
}

export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const result = await startSessionMutation(session_id);
  return res.status(200).json(result);
}

export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const raw = extractRawEventFromBody(req.body);
  const result = await appendRuntimeEventMutation(session_id, raw);
  return res.status(201).json(result);
}

export async function listRuntimeEvents(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const payload = await listRuntimeEventsQuery(session_id);
  return res.json(payload);
}

export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const payload = await getSessionStateQuery(session_id);
  return res.json(payload);
}

export async function getDecisionSummaryByRunId(req: Request, res: Response) {
  const run_id = asString(req.params?.run_id);
  if (!run_id) throw badRequest("Missing run_id");

  const payload = await getDecisionSummaryByRunIdQuery(run_id);
  return res.json(payload);
}
