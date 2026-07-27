// DEV NOTE: FULL-UI-07 durable coach review state.
// Review records are immutable product state stored separately from session artefacts.
// They never enter deterministic engine input and cannot override session truth.

import crypto from "node:crypto";

import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { asyncHandler } from "./async_handler.js";
import { loadBeta17StoredCoachContext } from "./beta_product_record_store.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound
} from "./http_errors.js";

type JsonRecord = Record<string, unknown>;

type ReviewWriteInput = Readonly<{
  request_id: string;
  requested_at_iso8601: string;
  coach_user_id: string;
  athlete_user_id: string;
  artefact_id: string;
  review_status: "reviewed" | "unreviewed";
}>;

const OPEN_SESSION_STATUSES =
  new Set([
    "created",
    "not_started",
    "in_progress",
    "split",
    "stopped",
    "returned",
    "returnable",
    "paused"
  ]);

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanIso8601(
  value: unknown,
  field: string
): string {
  const raw = cleanString(value);
  const parsed = Date.parse(raw);

  if (
    !raw ||
    !Number.isFinite(parsed)
  ) {
    throw badRequest(
      `${field} must be a valid ISO-8601 timestamp.`
    );
  }

  return new Date(parsed).toISOString();
}

function sha256(
  value: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function statusIsOpen(
  status: unknown
): boolean {
  return OPEN_SESSION_STATUSES.has(
    cleanString(status).toLowerCase()
  );
}

function relationshipRecord(
  context: Awaited<
    ReturnType<
      typeof loadBeta17StoredCoachContext
    >
  >
): JsonRecord {
  if (!context) {
    throw forbidden(
      "An accepted current coach-athlete relationship is required."
    );
  }

  const profile =
    isRecord(context.coach_profile)
      ? context.coach_profile
      : {};

  const relationship =
    isRecord(context.relationship)
      ? context.relationship
      : {};

  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    relationship.relationship_state !==
      "accepted"
  ) {
    throw forbidden(
      "An accepted current coach-athlete relationship is required."
    );
  }

  return relationship;
}

async function requireAcceptedAccess(
  coachUserId: string,
  athleteUserId: string
): Promise<JsonRecord> {
  const context =
    await loadBeta17StoredCoachContext(
      coachUserId,
      athleteUserId
    );

  const relationship =
    relationshipRecord(context);

  if (
    cleanString(
      relationship.coach_user_id
    ) !== coachUserId ||
    cleanString(
      relationship.athlete_user_id
    ) !== athleteUserId
  ) {
    throw forbidden(
      "The relationship does not grant access to this athlete."
    );
  }

  return relationship;
}

function reviewWriteInput(
  req: Request
): ReviewWriteInput {
  const body =
    isRecord(req.body)
      ? req.body
      : {};

  const requestId =
    cleanString(body.request_id);

  const coachUserId =
    cleanString(body.coach_user_id);

  const athleteUserId =
    cleanString(body.athlete_user_id);

  const artefactId =
    cleanString(body.artefact_id);

  const reviewStatus =
    cleanString(body.review_status);

  if (
    !requestId ||
    !coachUserId ||
    !athleteUserId ||
    !artefactId
  ) {
    throw badRequest(
      "Request, coach, athlete and artefact identifiers are required."
    );
  }

  if (
    reviewStatus !== "reviewed" &&
    reviewStatus !== "unreviewed"
  ) {
    throw badRequest(
      "Review status must be reviewed or unreviewed."
    );
  }

  return Object.freeze({
    request_id: requestId,
    requested_at_iso8601:
      cleanIso8601(
        body.requested_at_iso8601,
        "requested_at_iso8601"
      ),
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    artefact_id: artefactId,
    review_status: reviewStatus
  });
}

async function latestReviewRows(
  coachUserId: string,
  sessionIds: string[]
): Promise<Map<string, JsonRecord>> {
  const output =
    new Map<string, JsonRecord>();

  if (sessionIds.length === 0) {
    return output;
  }

  const result =
    await pool.query(
      `
      SELECT DISTINCT ON (session_id)
        session_id,
        review_payload
      FROM product_session_reviews
      WHERE
        coach_user_id = $1
        AND session_id =
          ANY($2::text[])
      ORDER BY
        session_id,
        recorded_at DESC,
        review_record_id DESC
      `,
      [
        coachUserId,
        sessionIds
      ]
    );

  for (const row of result.rows) {
    if (isRecord(row.review_payload)) {
      output.set(
        String(row.session_id),
        row.review_payload
      );
    }
  }

  return output;
}

async function coachNoteRows(
  coachUserId: string,
  sessionIds: string[]
): Promise<Map<string, JsonRecord[]>> {
  const output =
    new Map<string, JsonRecord[]>();

  if (sessionIds.length === 0) {
    return output;
  }

  const result =
    await pool.query(
      `
      SELECT
        session_id,
        note_payload,
        created_at
      FROM product_coach_notes
      WHERE
        coach_user_id = $1
        AND session_id =
          ANY($2::text[])
      ORDER BY
        created_at DESC,
        note_id DESC
      `,
      [
        coachUserId,
        sessionIds
      ]
    );

  for (const row of result.rows) {
    if (!isRecord(row.note_payload)) {
      continue;
    }

    const sessionId =
      String(row.session_id);

    const records =
      output.get(sessionId) ?? [];

    records.push({
      ...row.note_payload,
      created_at:
        new Date(
          row.created_at
        ).toISOString()
    });

    output.set(
      sessionId,
      records
    );
  }

  return output;
}

async function assignmentRows(
  assignmentIds: string[]
): Promise<Map<string, JsonRecord>> {
  const output =
    new Map<string, JsonRecord>();

  if (assignmentIds.length === 0) {
    return output;
  }

  const result =
    await pool.query(
      `
      SELECT DISTINCT ON (record_id)
        record_id,
        record_payload
      FROM beta_product_records
      WHERE
        record_type =
          'beta17_assignment_trigger'
        AND record_id =
          ANY($1::text[])
      ORDER BY
        record_id,
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      `,
      [assignmentIds]
    );

  for (const row of result.rows) {
    if (isRecord(row.record_payload)) {
      output.set(
        String(row.record_id),
        row.record_payload
      );
    }
  }

  return output;
}

async function eventLinkRows(
  coachUserId: string,
  assignmentIds: string[]
): Promise<Map<string, JsonRecord>> {
  const output =
    new Map<string, JsonRecord>();

  if (assignmentIds.length === 0) {
    return output;
  }

  const result =
    await pool.query(
      `
      SELECT DISTINCT ON (
        record_payload->>'assignment_id'
      )
        record_payload
      FROM beta_product_records
      WHERE
        record_type =
          'beta19_event_athlete_link'
        AND actor_user_id = $1
        AND record_payload->>'assignment_id' =
          ANY($2::text[])
      ORDER BY
        record_payload->>'assignment_id',
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      `,
      [
        coachUserId,
        assignmentIds
      ]
    );

  for (const row of result.rows) {
    if (!isRecord(row.record_payload)) {
      continue;
    }

    const assignmentId =
      cleanString(
        row.record_payload.assignment_id
      );

    if (assignmentId) {
      output.set(
        assignmentId,
        row.record_payload
      );
    }
  }

  return output;
}

async function listReviewRecords(
  req: Request,
  res: Response
) {
  const coachUserId =
    cleanString(
      req.query.coach_user_id
    );

  const requestedAthleteId =
    cleanString(
      req.query.athlete_user_id
    );

  if (!coachUserId) {
    throw badRequest(
      "Coach user ID is required."
    );
  }

  if (requestedAthleteId) {
    await requireAcceptedAccess(
      coachUserId,
      requestedAthleteId
    );
  }

  const values: string[] = [
    coachUserId
  ];

  let athleteClause = "";

  if (requestedAthleteId) {
    values.push(
      requestedAthleteId
    );

    athleteClause =
      "AND s.beta_subject_user_id = $2";
  }

  const sessionResult =
    await pool.query(
      `
      SELECT
        s.session_id,
        s.block_id,
        s.status,
        s.planned_session,
        s.beta_subject_user_id,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at,
        count(re.seq)::integer
          AS runtime_event_count
      FROM sessions s
      LEFT JOIN runtime_events re
        ON re.session_id =
          s.session_id
      WHERE
        s.beta_coach_user_id = $1
        ${athleteClause}
      GROUP BY
        s.session_id,
        s.block_id,
        s.status,
        s.planned_session,
        s.beta_subject_user_id,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at
      ORDER BY
        s.updated_at DESC,
        s.session_id DESC
      `,
      values
    );

  const accessCache =
    new Map<string, boolean>();

  const accessibleRows:
    JsonRecord[] = [];

  for (const row of sessionResult.rows) {
    const athleteUserId =
      cleanString(
        row.beta_subject_user_id
      );

    if (!athleteUserId) {
      continue;
    }

    if (!accessCache.has(athleteUserId)) {
      try {
        await requireAcceptedAccess(
          coachUserId,
          athleteUserId
        );

        accessCache.set(
          athleteUserId,
          true
        );
      }
      catch {
        accessCache.set(
          athleteUserId,
          false
        );
      }
    }

    if (
      accessCache.get(athleteUserId) ===
      true
    ) {
      accessibleRows.push(row);
    }
  }

  const sessionIds =
    accessibleRows.map(
      (row) =>
        String(row.session_id)
    );

  const assignmentIds =
    [
      ...new Set(
        accessibleRows
          .map((row) =>
            cleanString(
              row.beta_assignment_id
            )
          )
          .filter(Boolean)
      )
    ];

  const [
    reviews,
    notes,
    assignments,
    eventLinks
  ] = await Promise.all([
    latestReviewRows(
      coachUserId,
      sessionIds
    ),
    coachNoteRows(
      coachUserId,
      sessionIds
    ),
    assignmentRows(
      assignmentIds
    ),
    eventLinkRows(
      coachUserId,
      assignmentIds
    )
  ]);

  const records =
    accessibleRows.map((row) => {
      const sessionId =
        String(row.session_id);

      const athleteUserId =
        cleanString(
          row.beta_subject_user_id
        );

      const assignmentId =
        cleanString(
          row.beta_assignment_id
        );

      const plannedSession =
        isRecord(row.planned_session)
          ? row.planned_session
          : {};

      const latestReview =
        reviews.get(sessionId) ?? null;

      const open =
        statusIsOpen(row.status);

      const reviewStatus =
        open
          ? "open"
          : cleanString(
              latestReview
                ?.review_status
            ) || "unreviewed";

      const workItems =
        Array.isArray(
          plannedSession.work_items
        )
          ? plannedSession.work_items
          : Array.isArray(
              plannedSession.exercises
            )
            ? plannedSession.exercises
            : [];

      return Object.freeze({
        session_id: sessionId,
        artefact_id:
          `beta_e2e_artefact_${sessionId}`,
        athlete_user_id:
          athleteUserId,
        block_id:
          cleanString(row.block_id),
        session_title:
          cleanString(
            plannedSession.title
          ) ||
          cleanString(
            plannedSession.name
          ) ||
          "Training session",
        session_status:
          cleanString(row.status) ||
          "recorded",
        runtime_event_count:
          Number(
            row.runtime_event_count ?? 0
          ),
        planned_work_item_count:
          workItems.length,
        assignment_id:
          assignmentId || null,
        assignment_provenance:
          assignmentId
            ? assignments.get(
                assignmentId
              ) ?? {
                assignment_id:
                  assignmentId
              }
            : null,
        event_provenance:
          assignmentId
            ? eventLinks.get(
                assignmentId
              ) ?? null
            : null,
        review_status:
          reviewStatus,
        awaiting_review:
          !open &&
          reviewStatus ===
            "unreviewed",
        reviewed_at_iso8601:
          cleanString(
            latestReview
              ?.reviewed_at_iso8601
          ) || null,
        latest_review:
          latestReview,
        notes:
          notes.get(sessionId) ?? [],
        note_count:
          (
            notes.get(sessionId) ??
            []
          ).length,
        created_at:
          new Date(
            String(row.created_at)
          ).toISOString(),
        updated_at:
          new Date(
            String(row.updated_at)
          ).toISOString(),
        live_status_read_only:
          open,
        factual_record_only: true,
        read_only: true,
        calls_engine: false,
        engine_visible: false
      });
    });

  const counts = {
    all: records.length,
    open:
      records.filter(
        (record) =>
          record.review_status ===
          "open"
      ).length,
    awaiting_review:
      records.filter(
        (record) =>
          record.review_status ===
          "unreviewed"
      ).length,
    reviewed:
      records.filter(
        (record) =>
          record.review_status ===
          "reviewed"
      ).length
  };

  return res.status(200).json({
    ok: true,
    coach_user_id: coachUserId,
    athlete_user_id:
      requestedAthleteId || null,
    records,
    counts,
    factual_records_only: true,
    read_only: true,
    calls_engine: false,
    engine_visible: false
  });
}

async function latestSessionReview(
  client: PoolClient,
  coachUserId: string,
  sessionId: string
): Promise<Readonly<{
  payload: JsonRecord | null;
  recorded_at: string;
}>> {
  const result =
    await client.query(
      `
      SELECT
        review_payload,
        recorded_at
      FROM product_session_reviews
      WHERE
        coach_user_id = $1
        AND session_id = $2
      ORDER BY
        recorded_at DESC,
        review_record_id DESC
      LIMIT 1
      `,
      [
        coachUserId,
        sessionId
      ]
    );

  const row =
    result.rows?.[0];

  return Object.freeze({
    payload:
      isRecord(row?.review_payload)
        ? row.review_payload
        : null,
    recorded_at:
      row?.recorded_at
        ? new Date(
            row.recorded_at
          ).toISOString()
        : ""
  });
}

async function setSessionReview(
  req: Request,
  res: Response
) {
  const sessionId =
    cleanString(
      req.params.session_id
    );

  if (!sessionId) {
    throw badRequest(
      "Session ID is required."
    );
  }

  const input =
    reviewWriteInput(req);

  const relationship =
    await requireAcceptedAccess(
      input.coach_user_id,
      input.athlete_user_id
    );

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionResult =
      await client.query(
        `
        SELECT
          session_id,
          status,
          beta_subject_user_id,
          beta_coach_user_id
        FROM sessions
        WHERE
          session_id = $1
        FOR UPDATE
        `,
        [sessionId]
      );

    const session =
      sessionResult.rows?.[0];

    if (!session) {
      throw notFound(
        "The session record was not found."
      );
    }

    if (
      cleanString(
        session.beta_coach_user_id
      ) !== input.coach_user_id ||
      cleanString(
        session.beta_subject_user_id
      ) !== input.athlete_user_id
    ) {
      throw forbidden(
        "The session does not belong to this coach-athlete relationship."
      );
    }

    const expectedArtefactId =
      `beta_e2e_artefact_${sessionId}`;

    if (
      input.artefact_id !==
      expectedArtefactId
    ) {
      throw conflict(
        "The artefact identifier does not match the session record."
      );
    }

    if (statusIsOpen(session.status)) {
      throw conflict(
        "Open sessions cannot be marked reviewed."
      );
    }

    const previous =
      await latestSessionReview(
        client,
        input.coach_user_id,
        sessionId
      );

    const requestedAt =
      Date.parse(
        input.requested_at_iso8601
      );

    const previousAt =
      Date.parse(
        previous.recorded_at
      );

    if (
      Number.isFinite(previousAt) &&
      requestedAt < previousAt
    ) {
      throw conflict(
        "This review action is stale. Refresh the review record."
      );
    }

    const relationshipId =
      cleanString(
        relationship.relationship_id
      );

    const withoutHash: JsonRecord = {
      record_type:
        "product_session_review",
      request_id:
        input.request_id,
      requested_at_iso8601:
        input.requested_at_iso8601,
      coach_user_id:
        input.coach_user_id,
      athlete_user_id:
        input.athlete_user_id,
      relationship_id:
        relationshipId,
      session_id:
        sessionId,
      artefact_id:
        input.artefact_id,
      review_status:
        input.review_status,
      reviewed_at_iso8601:
        input.review_status ===
          "reviewed"
          ? input
              .requested_at_iso8601
          : null,
      previous_review_status:
        cleanString(
          previous.payload
            ?.review_status
        ) || "unreviewed",
      non_binding: true,
      product_record_only: true,
      stored_separately_from_artefact:
        true,
      included_in_engine_input:
        false,
      changes_engine_output:
        false,
      engine_visible: false
    };

    const recordSha256 =
      sha256(withoutHash);

    const reviewRecordId =
      `session_review_${recordSha256.slice(
        0,
        24
      )}`;

    const reviewRecord = {
      review_record_id:
        reviewRecordId,
      ...withoutHash,
      record_sha256:
        recordSha256
    };

    await client.query(
      `
      INSERT INTO product_session_reviews (
        review_record_id,
        coach_user_id,
        athlete_user_id,
        relationship_id,
        session_id,
        artefact_id,
        review_status,
        reviewed_at,
        recorded_at,
        record_sha256,
        review_payload
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::timestamptz,
        $9::timestamptz,
        $10,
        $11::jsonb
      )
      ON CONFLICT (
        review_record_id
      )
      DO NOTHING
      `,
      [
        reviewRecordId,
        input.coach_user_id,
        input.athlete_user_id,
        relationshipId,
        sessionId,
        input.artefact_id,
        input.review_status,
        input.review_status ===
          "reviewed"
          ? input
              .requested_at_iso8601
          : null,
        input.requested_at_iso8601,
        recordSha256,
        JSON.stringify(
          reviewRecord
        )
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      review: reviewRecord,
      calls_engine: false,
      engine_visible: false
    });
  }
  catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => undefined);

    throw error;
  }
  finally {
    client.release();
  }
}

export const productReviewRouter =
  Router();

productReviewRouter.get(
  "/reviews",
  asyncHandler(listReviewRecords)
);

productReviewRouter.post(
  "/session-review/:session_id",
  asyncHandler(setSessionReview)
);
