// DEV NOTE: FULL-UI-32 video feedback. coach_user_id is never client-
// supplied for an athlete's upload - it is re-derived server-side from
// the sessions table's own beta_coach_user_id column (see
// resolveSessionOwnership below), the same "never trust a client-echoed
// relationship" posture used throughout this file family
// (coach_athlete_messaging_service.ts, progress_photo_service.ts).
// Ownership/relationship checks are duplicated locally here rather than
// shared, matching every other service in this family.

import crypto from "node:crypto";
import fs from "node:fs";

import { pool } from "../db/pool.js";
import { loadBeta17StoredCoachContext } from "./beta_product_record_store.js";
import {
  cleanupVideoSubmissionFiles,
  finalizeVideoSubmission,
  resolveVideoSubmissionPath,
  type PendingVideoSubmissionUpload
} from "./video_submission_storage.js";

// The route layer stages the upload via multer before this function ever
// runs, so an idempotent-replay request (client_request_id already seen)
// still needs its now-redundant staged file removed - it was never
// finalized into a submission directory, so cleanupVideoSubmissionFiles
// (which targets a finalized submission_id dir) does not apply here.
async function cleanupStagedUpload(pending: PendingVideoSubmissionUpload): Promise<void> {
  await fs.promises.rm(pending.stagedFilePath, { force: true }).catch(() => {});
}

type JsonRecord = Record<string, unknown>;

export class VideoFeedbackError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`video_feedback_${reason}`);
    this.name = "VideoFeedbackError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

const MAX_EXERCISE_LABEL_LENGTH = 200;
const MAX_CAPTION_LENGTH = 4000;
const MAX_FEEDBACK_LENGTH = 4000;

async function requireAcceptedCoachAthleteRelationship(
  coachUserId: string,
  athleteUserId: string
): Promise<string> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new VideoFeedbackError("relationship_not_found", 403);
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    profile.product_auth_state_only !== true ||
    profile.engine_visible !== false
  ) {
    throw new VideoFeedbackError("coach_profile_not_active", 403);
  }

  const relationship = isRecord(context.relationship) ? context.relationship : {};
  if (
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId ||
    relationship.relationship_scope !== "individual_coach_athlete" ||
    relationship.relationship_state !== "accepted" ||
    relationship.revoked_at_iso8601 !== null ||
    relationship.expires_at_iso8601 !== null ||
    relationship.product_permission_state_only !== true ||
    relationship.engine_visible !== false
  ) {
    throw new VideoFeedbackError("relationship_not_accepted", 403);
  }

  const relationshipId = cleanString(relationship.relationship_id);
  if (!relationshipId) {
    throw new VideoFeedbackError("relationship_not_accepted", 403);
  }
  return relationshipId;
}

// Resolves and authorizes the coach for a session an athlete is
// submitting a video against. The session row's own beta_coach_user_id/
// beta_subject_user_id columns are the only source of truth for this -
// never a client-supplied coach id (mirrors product_review.routes.ts's
// session -> coach resolution).
async function resolveAthleteSessionCoach(
  sessionId: string,
  athleteUserId: string
): Promise<Readonly<{ coachUserId: string; relationshipId: string }>> {
  const result = await pool.query(
    `SELECT beta_subject_user_id, beta_coach_user_id FROM sessions WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );

  const row = result.rows?.[0];
  if (!row) {
    throw new VideoFeedbackError("session_not_found", 404);
  }

  if (cleanString(row.beta_subject_user_id) !== athleteUserId) {
    throw new VideoFeedbackError("session_not_owned_by_athlete", 403);
  }

  const coachUserId = cleanString(row.beta_coach_user_id);
  if (!coachUserId) {
    throw new VideoFeedbackError("session_not_coach_managed", 400);
  }

  const relationshipId = await requireAcceptedCoachAthleteRelationship(coachUserId, athleteUserId);
  return Object.freeze({ coachUserId, relationshipId });
}

function attachmentUrlsFor(row: JsonRecord): Readonly<{ url: string; thumbnail_url: string | null }> {
  const submissionId = cleanString(row.submission_id);
  return Object.freeze({
    url: `/video-feedback/submissions/${encodeURIComponent(submissionId)}/media`,
    thumbnail_url: row.attachment_thumbnail_storage_key
      ? `/video-feedback/submissions/${encodeURIComponent(submissionId)}/thumbnail`
      : null
  });
}

function serializeSubmissionForAthlete(row: JsonRecord): Readonly<JsonRecord> {
  const {
    attachment_storage_key: _storageKey,
    attachment_thumbnail_storage_key: _thumbnailKey,
    coach_user_id: _coachUserId,
    relationship_id: _relationshipId,
    ...rest
  } = row;
  return Object.freeze({ ...rest, ...attachmentUrlsFor(row) });
}

function serializeSubmissionForCoach(row: JsonRecord): Readonly<JsonRecord> {
  const {
    attachment_storage_key: _storageKey,
    attachment_thumbnail_storage_key: _thumbnailKey,
    ...rest
  } = row;
  return Object.freeze({
    ...rest,
    ...attachmentUrlsFor(row),
    url: `/coach-workspace/video-feedback/submissions/${encodeURIComponent(cleanString(row.submission_id))}/media`,
    thumbnail_url: row.attachment_thumbnail_storage_key
      ? `/coach-workspace/video-feedback/submissions/${encodeURIComponent(cleanString(row.submission_id))}/thumbnail`
      : null
  });
}

export type CreateVideoSubmissionInput = Readonly<{
  sessionId: unknown;
  workItemId: unknown;
  exerciseLabel: unknown;
  caption: unknown;
  clientRequestId: unknown;
}>;

export async function createVideoSubmission(
  athleteUserId: string,
  pending: PendingVideoSubmissionUpload,
  input: CreateVideoSubmissionInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const sessionId = cleanString(input.sessionId);
  const workItemId = cleanString(input.workItemId);
  const exerciseLabel = cleanString(input.exerciseLabel);
  const clientRequestId = cleanString(input.clientRequestId);
  const caption = cleanString(input.caption) || null;

  if (!athlete) throw new VideoFeedbackError("athlete_identity_required", 401);
  if (!sessionId) throw new VideoFeedbackError("session_id_required");
  if (!workItemId) throw new VideoFeedbackError("work_item_id_required");
  if (!exerciseLabel || exerciseLabel.length > MAX_EXERCISE_LABEL_LENGTH) {
    throw new VideoFeedbackError("exercise_label_invalid");
  }
  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    throw new VideoFeedbackError("caption_too_long");
  }
  if (!clientRequestId) throw new VideoFeedbackError("client_request_id_required");

  const existing = await pool.query(
    `SELECT * FROM product_video_submissions WHERE athlete_user_id = $1 AND client_request_id = $2 LIMIT 1`,
    [athlete, clientRequestId]
  );
  if (existing.rows?.[0]) {
    await cleanupStagedUpload(pending);
    return serializeSubmissionForAthlete(existing.rows[0]);
  }

  const { coachUserId, relationshipId } = await resolveAthleteSessionCoach(sessionId, athlete);

  const submissionId = randomId("video_submission");
  const finalized = await finalizeVideoSubmission(pending, submissionId);

  try {
    const result = await pool.query(
      `
      INSERT INTO product_video_submissions (
        submission_id, athlete_user_id, coach_user_id, relationship_id,
        session_id, work_item_id, exercise_label, caption,
        attachment_mime_type, attachment_byte_size, attachment_storage_key, attachment_thumbnail_storage_key,
        client_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (athlete_user_id, client_request_id) DO NOTHING
      RETURNING *
      `,
      [
        submissionId,
        athlete,
        coachUserId,
        relationshipId,
        sessionId,
        workItemId,
        exerciseLabel,
        caption,
        pending.mimeType,
        pending.byteSize,
        finalized.storageKey,
        finalized.thumbnailStorageKey,
        clientRequestId
      ]
    );

    if (!result.rows?.[0]) {
      // Lost a idempotent-replay race - the row we tried to insert
      // already exists from a concurrent identical request. The files
      // we just finalized under this submissionId are now orphaned.
      await cleanupVideoSubmissionFiles(submissionId).catch(() => {});
      const replay = await pool.query(
        `SELECT * FROM product_video_submissions WHERE athlete_user_id = $1 AND client_request_id = $2 LIMIT 1`,
        [athlete, clientRequestId]
      );
      return serializeSubmissionForAthlete(replay.rows[0]);
    }

    return serializeSubmissionForAthlete(result.rows[0]);
  }
  catch (error) {
    await cleanupVideoSubmissionFiles(submissionId).catch(() => {});
    throw error instanceof VideoFeedbackError ? error : new VideoFeedbackError("persist_failed", 500);
  }
}

export async function listMySubmissions(
  athleteUserId: string,
  sessionId?: string
): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) throw new VideoFeedbackError("athlete_identity_required", 401);

  const session = cleanString(sessionId);
  const values: string[] = [athlete];
  let clause = "";
  if (session) {
    values.push(session);
    clause = "AND session_id = $2";
  }

  const result = await pool.query(
    `SELECT * FROM product_video_submissions WHERE athlete_user_id = $1 ${clause} ORDER BY created_at DESC`,
    values
  );

  const submissions = result.rows ?? [];
  const withFeedback = await attachFeedback(submissions);
  return withFeedback.map(serializeSubmissionForAthlete);
}

export async function listCoachQueue(coachUserId: string): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  if (!coach) throw new VideoFeedbackError("coach_identity_required", 401);

  const result = await pool.query(
    `SELECT * FROM product_video_submissions WHERE coach_user_id = $1 AND review_status = 'pending' ORDER BY created_at ASC`,
    [coach]
  );

  return (result.rows ?? []).map(serializeSubmissionForCoach);
}

async function loadSubmissionRow(submissionId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `SELECT * FROM product_video_submissions WHERE submission_id = $1 LIMIT 1`,
    [submissionId]
  );
  return result.rows?.[0] ?? null;
}

async function attachFeedback(rows: JsonRecord[]): Promise<JsonRecord[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((row) => cleanString(row.submission_id));
  const result = await pool.query(
    `SELECT * FROM product_video_submission_feedback WHERE submission_id = ANY($1) ORDER BY created_at ASC`,
    [ids]
  );

  const bySubmission = new Map<string, JsonRecord[]>();
  for (const feedbackRow of result.rows ?? []) {
    const key = cleanString(feedbackRow.submission_id);
    const list = bySubmission.get(key) ?? [];
    list.push(feedbackRow);
    bySubmission.set(key, list);
  }

  return rows.map((row) => ({
    ...row,
    feedback: bySubmission.get(cleanString(row.submission_id)) ?? []
  }));
}

export async function getSubmissionDetailForAthlete(
  athleteUserId: string,
  submissionId: string
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const id = cleanString(submissionId);
  if (!athlete || !id) throw new VideoFeedbackError("submission_not_found", 404);

  const row = await loadSubmissionRow(id);
  if (!row || cleanString(row.athlete_user_id) !== athlete) {
    throw new VideoFeedbackError("submission_not_found", 404);
  }

  const [withFeedback] = await attachFeedback([row]);
  return serializeSubmissionForAthlete(withFeedback);
}

export async function getSubmissionDetailForCoach(
  coachUserId: string,
  submissionId: string
): Promise<Readonly<JsonRecord>> {
  const coach = cleanString(coachUserId);
  const id = cleanString(submissionId);
  if (!coach || !id) throw new VideoFeedbackError("submission_not_found", 404);

  const row = await loadSubmissionRow(id);
  if (!row || cleanString(row.coach_user_id) !== coach) {
    throw new VideoFeedbackError("submission_not_found", 404);
  }

  const [withFeedback] = await attachFeedback([row]);
  return serializeSubmissionForCoach(withFeedback);
}

export async function addFeedback(
  coachUserId: string,
  submissionId: string,
  feedbackText: unknown
): Promise<Readonly<JsonRecord>> {
  const coach = cleanString(coachUserId);
  const id = cleanString(submissionId);
  const text = cleanString(feedbackText);

  if (!coach) throw new VideoFeedbackError("coach_identity_required", 401);
  if (!id) throw new VideoFeedbackError("submission_not_found", 404);
  if (!text || text.length > MAX_FEEDBACK_LENGTH) {
    throw new VideoFeedbackError("feedback_text_required");
  }

  const row = await loadSubmissionRow(id);
  if (!row || cleanString(row.coach_user_id) !== coach) {
    throw new VideoFeedbackError("submission_not_found", 404);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO product_video_submission_feedback (feedback_id, submission_id, coach_user_id, feedback_text)
       VALUES ($1, $2, $3, $4)`,
      [randomId("video_feedback"), id, coach, text]
    );

    await client.query(
      `UPDATE product_video_submissions SET review_status = 'reviewed', reviewed_at = now()
       WHERE submission_id = $1 AND review_status = 'pending'`,
      [id]
    );

    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error instanceof VideoFeedbackError ? error : new VideoFeedbackError("feedback_persist_failed", 500);
  }
  finally {
    client.release();
  }

  return getSubmissionDetailForCoach(coach, id);
}

export async function resolveSubmissionFileForAthlete(
  athleteUserId: string,
  submissionId: string,
  variant: "media" | "thumbnail"
): Promise<Readonly<{ absolutePath: string; mimeType: string }> | null> {
  const athlete = cleanString(athleteUserId);
  const id = cleanString(submissionId);
  if (!athlete || !id) return null;

  const row = await loadSubmissionRow(id);
  if (!row || cleanString(row.athlete_user_id) !== athlete) return null;

  return resolveSubmissionFile(row, variant);
}

export async function resolveSubmissionFileForCoach(
  coachUserId: string,
  submissionId: string,
  variant: "media" | "thumbnail"
): Promise<Readonly<{ absolutePath: string; mimeType: string }> | null> {
  const coach = cleanString(coachUserId);
  const id = cleanString(submissionId);
  if (!coach || !id) return null;

  const row = await loadSubmissionRow(id);
  if (!row || cleanString(row.coach_user_id) !== coach) return null;

  return resolveSubmissionFile(row, variant);
}

function resolveSubmissionFile(
  row: JsonRecord,
  variant: "media" | "thumbnail"
): Readonly<{ absolutePath: string; mimeType: string }> | null {
  const storageKey = variant === "media"
    ? cleanString(row.attachment_storage_key)
    : cleanString(row.attachment_thumbnail_storage_key);
  if (!storageKey) return null;

  const absolutePath = resolveVideoSubmissionPath(storageKey);
  if (!absolutePath) return null;

  return Object.freeze({
    absolutePath,
    mimeType: variant === "media" ? (cleanString(row.attachment_mime_type) || "video/mp4") : "image/jpeg"
  });
}
