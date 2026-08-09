// DEV NOTE: FULL-UI-28 - athlete progress photos. Each photo is an
// independent immutable beta_product_records fact (record_type
// "beta_progress_photo"), not a chained "profile" - there is no
// optimistic-concurrency chain the way beta19_athlete_strength_profile has,
// since uploads never supersede each other. Ownership/relationship checks
// are duplicated locally here rather than shared, mirroring every other
// service in this file family (beta19_coach_workspace_service.ts,
// coach_athlete_messaging_service.ts).

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  cleanupProgressPhotoFiles,
  finalizeProgressPhoto,
  resolveProgressPhotoPath,
  type PendingProgressPhotoUpload
} from "./progress_photo_storage.js";

type JsonRecord = Record<string, unknown>;

export class ProgressPhotoError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`progress_photo_${reason}`);
    this.name = "ProgressPhotoError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (isRecord(value)) {
    const output: JsonRecord = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalise(value[key]);
    }
    return output;
  }
  return value;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

const MAX_CAPTION_LENGTH = 280;
const ISO8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u;

async function requireCoachAthleteAccess(coachUserId: string, athleteUserId: string): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new ProgressPhotoError("relationship_access_denied", 403);
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  const relationship = isRecord(context.relationship) ? context.relationship : {};

  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    relationship.relationship_state !== "accepted" ||
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId
  ) {
    throw new ProgressPhotoError("relationship_access_denied", 403);
  }
}

function normaliseTakenAt(input: unknown): string {
  if (input === undefined || input === null || input === "") {
    return new Date().toISOString();
  }
  const takenAt = cleanString(input);
  if (!ISO8601_PATTERN.test(takenAt)) {
    throw new ProgressPhotoError("taken_at_invalid");
  }
  return takenAt;
}

function normaliseCaption(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return null;
  const caption = cleanString(input);
  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new ProgressPhotoError("caption_too_long");
  }
  return caption;
}

type ProgressPhotoRecord = Readonly<{
  record_type: "beta_progress_photo";
  contract_version: string;
  photo_id: string;
  athlete_user_id: string;
  uploaded_by_user_id: string;
  storage_key: string;
  media_type: "image";
  mime_type: string;
  byte_size: number;
  taken_at_iso8601: string;
  caption: string | null;
  uploaded_at_iso8601: string;
  ordering_time_authority: "postgres_server_clock";
  factual_user_supplied_state: true;
  immutable_reference_history: true;
  inference_applied: false;
  readiness_semantics: false;
  safety_semantics: false;
  suitability_semantics: false;
  recommendation_semantics: false;
  engine_visible: false;
  compile_reference_visible: false;
  record_sha256: string;
}>;

export async function uploadProgressPhoto(
  athleteUserId: string,
  pending: PendingProgressPhotoUpload,
  input: { taken_at_iso8601?: unknown; caption?: unknown }
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new ProgressPhotoError("athlete_identity_required");
  }

  const takenAt = normaliseTakenAt(input.taken_at_iso8601);
  const caption = normaliseCaption(input.caption);

  const photoId = `beta_progress_photo_${sha256({
    athleteUserId: athlete,
    stagedFilePath: pending.stagedFilePath,
    at: new Date().toISOString()
  }).slice(0, 24)}`;

  let storageKey: string;
  try {
    const finalized = await finalizeProgressPhoto(pending, athlete, photoId);
    storageKey = finalized.storageKey;
  }
  catch {
    throw new ProgressPhotoError("storage_failed", 500);
  }

  try {
    const recordWithoutHash = {
      record_type: "beta_progress_photo" as const,
      contract_version: "full_ui_28.1.0.0",
      photo_id: photoId,
      athlete_user_id: athlete,
      uploaded_by_user_id: athlete,
      storage_key: storageKey,
      media_type: "image" as const,
      mime_type: pending.mimeType,
      byte_size: pending.byteSize,
      taken_at_iso8601: takenAt,
      caption,
      uploaded_at_iso8601: new Date().toISOString(),
      ordering_time_authority: "postgres_server_clock" as const,
      factual_user_supplied_state: true as const,
      immutable_reference_history: true as const,
      inference_applied: false as const,
      readiness_semantics: false as const,
      safety_semantics: false as const,
      suitability_semantics: false as const,
      recommendation_semantics: false as const,
      engine_visible: false as const,
      compile_reference_visible: false as const
    };

    const record: ProgressPhotoRecord = deepFreeze({
      ...recordWithoutHash,
      record_sha256: sha256(recordWithoutHash)
    });

    const stored = await persistBetaProductRecord(record);
    return serializePhotoForAthlete(stored);
  }
  catch (error) {
    await cleanupProgressPhotoFiles(athlete, photoId);
    throw error instanceof ProgressPhotoError ? error : new ProgressPhotoError("persist_failed", 500);
  }
}

// Maps the stored record's internal storage_key to a fetchable route path
// and drops it from the response - mirrors how coach_athlete_messaging_
// service.ts computes attachment.url rather than exposing storage_key
// directly to a client.
function serializePhotoForAthlete(record: Readonly<JsonRecord>): Readonly<JsonRecord> {
  const { storage_key: _storageKey, ...rest } = record;
  return Object.freeze({
    ...rest,
    url: `/progress-photos/${encodeURIComponent(cleanString(record.photo_id))}/file`
  });
}

function serializePhotoForCoach(athleteUserId: string, record: Readonly<JsonRecord>): Readonly<JsonRecord> {
  const { storage_key: _storageKey, ...rest } = record;
  return Object.freeze({
    ...rest,
    url: `/progress-photos/coach/${encodeURIComponent(athleteUserId)}/${encodeURIComponent(cleanString(record.photo_id))}/file`
  });
}

async function listProgressPhotoRecords(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'beta_progress_photo'
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_id DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const photos: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      photos.push(Object.freeze(row.record_payload));
    }
  }
  return photos;
}

export async function listProgressPhotosForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new ProgressPhotoError("athlete_identity_required");
  }
  const records = await listProgressPhotoRecords(athlete);
  return records.map(serializePhotoForAthlete);
}

export async function listProgressPhotosForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new ProgressPhotoError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  const records = await listProgressPhotoRecords(athlete);
  return records.map((record) => serializePhotoForCoach(athlete, record));
}

async function loadPhotoRecordOwnedBy(photoId: string, athleteUserId: string): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta_progress_photo'
      AND record_id = $1
      AND subject_user_id = $2
    LIMIT 1
    `,
    [photoId, athleteUserId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? Object.freeze(payload) : null;
}

export async function resolveProgressPhotoFileForAthlete(
  photoId: string,
  athleteUserId: string
): Promise<Readonly<{ absolutePath: string; mimeType: string }> | null> {
  const athlete = cleanString(athleteUserId);
  const id = cleanString(photoId);
  if (!athlete || !id) return null;

  const record = await loadPhotoRecordOwnedBy(id, athlete);
  if (!record) return null;

  const absolutePath = resolveProgressPhotoPath(cleanString(record.storage_key));
  if (!absolutePath) return null;

  return Object.freeze({ absolutePath, mimeType: cleanString(record.mime_type) || "application/octet-stream" });
}

export async function resolveProgressPhotoFileForCoach(
  photoId: string,
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<{ absolutePath: string; mimeType: string }> | null> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  const id = cleanString(photoId);
  if (!coach || !athlete || !id) return null;

  await requireCoachAthleteAccess(coach, athlete);

  const record = await loadPhotoRecordOwnedBy(id, athlete);
  if (!record) return null;

  const absolutePath = resolveProgressPhotoPath(cleanString(record.storage_key));
  if (!absolutePath) return null;

  return Object.freeze({ absolutePath, mimeType: cleanString(record.mime_type) || "application/octet-stream" });
}
