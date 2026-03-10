/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

import {
  deriveTrace,
  normalizeSummary
} from "@kolosseum/engine/runtime/session_summary.js";

import {
  badRequest,
  notFound
} from "./http_errors.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  loadSessionStateRow,
  projectSessionStatePayload,
  readCachedSessionState,
  writeCachedSessionState
} from "./session_state_read_model.js";
import {
  appendRuntimeEventMutation,
  extractRawEventFromBody,
  startSessionMutation
} from "./session_state_write_service.js";
import { planSessionService } from "./plan_session_service.js";
import { listRuntimeEventsQuery } from "./session_events_query_service.js";

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

  const cached = readCachedSessionState(session_id);
  if (cached) return res.json(cached);

  const client = await pool.connect();
  try {
    const row = await loadSessionStateRow(client, session_id);
    if (!row) throw notFound("Session not found");

    const planned = row.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, row.session_state_summary);

    const upgraded = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist = needsUpgrade || upgraded.changed;

    if (shouldPersist) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(upgraded.summary)]
      );
    }

    const derivedTrace = deriveTrace(upgraded.summary as any) as any;
    const payload = projectSessionStatePayload(session_id, planned, upgraded.summary, derivedTrace);

    writeCachedSessionState(session_id, payload);
    return res.json(payload);
  } finally {
    client.release();
  }
}