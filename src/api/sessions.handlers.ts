
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/sessions.handlers.ts
import type { Request, Response } from "express";

import { pool } from "../db/pool.js";

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
import {
  createBeta16AcknowledgementRecord,
  createBeta16AuthRecord,
  createBeta16Phase1DeclarationRecord
} from "./beta16_app_path_service.js";
import {
  buildBeta17CoachArtefactView,
  createBeta17AssignmentRecord,
  createBeta17CoachNoteRecord,
  createBeta17CoachProfileRecord,
  createBeta17RelationshipRecord
} from "./beta17_coach_managed_service.js";
import {
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  buildStoredBeta17CoachArtefactResult,
  buildStoredBetaAthleteHistoryResult,
  createStoredBeta17AssignmentResult
} from "./beta_product_journey_service.js";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

type BetaHttpResult =
  Readonly<{
    status: number;
    body: Readonly<JsonRecord>;
  }>;

async function persistBetaHttpResult(
  result: BetaHttpResult,
  recordKey: string
): Promise<BetaHttpResult> {
  if (
    result.status === 201 &&
    result.body.ok === true
  ) {
    await persistBetaProductRecord(
      result.body[recordKey]
    );
  }

  return result;
}

/**
 * FUNCTION NOTE:
 * Purpose: Exposes the existing beta athlete product/auth record path.
 * Boundary: Persists the validated product record; no credential provider or engine mutation.
 */
export async function createBeta16Auth(
  req: Request,
  res: Response
) {
  const result =
    await persistBetaHttpResult(
      createBeta16AuthRecord(req.body),
      "auth_record"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records explicit beta and jurisdiction acknowledgement.
 * Boundary: Persists validated product state only; engine-inert.
 */
export async function createBeta16Acknowledgement(
  req: Request,
  res: Response
) {
  const result =
    await persistBetaHttpResult(
      createBeta16AcknowledgementRecord(
        req.body
      ),
      "acknowledgement_record"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records the Phase 1 declaration used by BETA-16 compile admission.
 * Boundary: Persists the validated declaration; does not compile or mutate engine state.
 */
export async function createBeta16Declaration(
  req: Request,
  res: Response
) {
  const result =
    await persistBetaHttpResult(
      createBeta16Phase1DeclarationRecord(
        req.body
      ),
      "declaration_record"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records bounded coach product-auth state.
 * Boundary: Persists validated coach product-auth state; does not authenticate credentials or enter engine input.
 */
export async function createBeta17CoachProfile(
  req: Request,
  res: Response
) {
  const result =
    await persistBetaHttpResult(
      createBeta17CoachProfileRecord(
        req.body
      ),
      "coach_profile"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records invited, accepted or revoked individual relationship state.
 * Boundary: Persists validated product permission state only.
 */
export async function createBeta17Relationship(
  req: Request,
  res: Response
) {
  const result =
    await persistBetaHttpResult(
      createBeta17RelationshipRecord(
        req.body
      ),
      "relationship"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records an existing-contract coach assignment trigger.
 * Boundary: Persists the validated assignment trigger; does not compile, edit declarations, alter registries or override engine decisions.
 */
export async function createBeta17Assignment(
  req: Request,
  res: Response
) {
  const body =
    isRecord(req.body)
      ? req.body
      : {};

  const storedMode =
    Object.prototype.hasOwnProperty.call(
      body,
      "coach_user_id"
    ) &&
    !Object.prototype.hasOwnProperty.call(
      body,
      "coach_profile"
    );

  const generated =
    storedMode
      ? await createStoredBeta17AssignmentResult(
          body
        )
      : createBeta17AssignmentRecord(
          req.body
        );

  const result =
    await persistBetaHttpResult(
      generated,
      "assignment"
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns assigned-coach factual artefact records.
 * Boundary: Read-only and note-free.
 */
export async function getBeta17CoachArtefacts(
  req: Request,
  res: Response
) {
  const body =
    isRecord(req.body)
      ? req.body
      : {};

  const storedMode =
    Object.prototype.hasOwnProperty.call(
      body,
      "coach_user_id"
    ) &&
    Object.prototype.hasOwnProperty.call(
      body,
      "athlete_user_id"
    ) &&
    !Object.prototype.hasOwnProperty.call(
      body,
      "artefacts"
    );

  const result =
    storedMode
      ? await buildStoredBeta17CoachArtefactResult(
          body
        )
      : buildBeta17CoachArtefactView(
          req.body
        );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns persisted factual history for an active beta athlete.
 * Boundary: Read-only product/runtime projection and engine-inert.
 */
export async function getBetaAthleteHistory(
  req: Request,
  res: Response
) {
  const result =
    await buildStoredBetaAthleteHistoryResult(
      req.body
    );

  return res
    .status(result.status)
    .json(result.body);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records an exact non-binding coach note.
 * Boundary: Product record only and engine-inert.
 */
export async function createBeta17CoachNote(
  req: Request,
  res: Response
) {
  const result =
    createBeta17CoachNoteRecord(
      req.body
    );

  if (
    result.status === 201 &&
    result.body.ok === true &&
    isRecord(
      result.body.coach_note
    )
  ) {
    const note =
      result.body.coach_note;

    // DEV NOTE: Coach notes are persisted in a dedicated product table.
    // They remain separate from session artefacts and never enter engine input.
    await pool.query(
      `
      INSERT INTO product_coach_notes (
        note_id,
        coach_user_id,
        athlete_user_id,
        relationship_id,
        session_id,
        artefact_id,
        note_text,
        visibility,
        record_sha256,
        note_payload
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb
      )
      ON CONFLICT (note_id)
      DO NOTHING
      `,
      [
        String(note.note_id),
        String(note.coach_user_id),
        String(note.athlete_user_id),
        String(note.relationship_id),
        String(note.session_id),
        String(note.artefact_id),
        String(note.note_text),
        String(note.visibility),
        String(note.record_sha256),
        JSON.stringify(note)
      ]
    );
  }

  return res
    .status(result.status)
    .json(result.body);
}

export async function planSession(req: Request, res: Response) {
  const bodyUnknown = req.body as unknown;

  let input: any;
  if (isRecord(bodyUnknown)) {
    const body = bodyUnknown as JsonRecord;
    const hasTopLevelInput = Object.prototype.hasOwnProperty.call(body, "input");
    const undeclaredTopLevelFields = hasTopLevelInput
      ? Object.keys(body).filter((key) => key !== "input").sort()
      : [];

    if (undeclaredTopLevelFields.length > 0) {
      throw badRequest(`Unexpected top-level field(s): ${undeclaredTopLevelFields.join(", ")}`);
    }

    input = (body as any).input ?? body;
  } else if (typeof bodyUnknown === "undefined" || bodyUnknown === null) {
    input = {};
  } else {
    throw badRequest("Invalid JSON body (expected object)");
  }

  const out = await planSessionService(input);

  return res.status(200).json({
    ok: out?.ok === true,
    session: out?.result?.session ?? null,
    trace: out?.trace ?? null
  });
}

export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const result = await startSessionMutation(session_id);
  return res.status(200).json(result);
}

/**
 * DEV NOTE: Runtime event handler delegation boundary.
 * Purpose: validate transport-level session id input, delegate event persistence,
 * then read back the projected factual session state.
 * Boundary: this handler does not apply engine runtime rules directly; reducer
 * behaviour lives in the engine package and write service.
 * Determinism: response state is read after mutation so the API surface reflects
 * the stored event sequence rather than local handler state.
 * Failure: missing session id and service-level runtime failures are mapped by
 * delegated services into stable HTTP error responses.
 */
export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const raw = extractRawEventFromBody(req.body);
  const result = await appendRuntimeEventMutation(session_id, raw);
  const statePayload = await getSessionStateQuery(session_id);

  return res.status(201).json({
    ...statePayload,
    ok: result?.ok === true,
    session_id: result?.session_id ?? session_id,
    seq: result?.seq ?? null
  });
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
