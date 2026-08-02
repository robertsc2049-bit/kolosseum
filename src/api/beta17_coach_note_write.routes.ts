
// DEV NOTE: P152 coach-notes boundary. Kept as its own narrow module, separate from
// sessions.routes.ts/sessions.handlers.ts, so this concern never sits in the same file
// as a direct import of any engine/session truth-reading or truth-writing service.
// Mounted at the same "/sessions" prefix as sessionsRouter so the public endpoint
// path is unchanged.

import { Router } from "express";
import type { Request, Response } from "express";

import { pool } from "../db/pool.js";
import { asyncHandler } from "./async_handler.js";
import { createBeta17CoachNoteRecord } from "./beta17_coach_managed_service.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

export const beta17CoachNoteWriteRouter = Router();

beta17CoachNoteWriteRouter.post(
  "/beta-coach-notes",
  asyncHandler(createBeta17CoachNote)
);
