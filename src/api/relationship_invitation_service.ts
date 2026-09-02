// DEV NOTE: FULL-UI-24 lawful, non-opaque-ID coach-athlete invitation.
// A coach invites an athlete by the athlete's own email address, never by
// typing the athlete's internal user_id. The athlete accepts through their
// own authenticated session using only a relationship_id their own pending-
// invitations list already supplied - never typed, never opaque. This
// reuses the existing beta17_coach_relationship record type and its append-
// only state-transition write path; it adds no new table.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  createBeta17RelationshipRecord
} from "./beta17_coach_managed_service.js";
import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  assertPublicLaunchCoachCapacity
} from "./public_launch_billing_service.js";

type JsonRecord = Record<string, unknown>;

export class RelationshipInvitationError extends Error {
  readonly reason: string;
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`relationship_invitation_${reason}`);
    this.name = "RelationshipInvitationError";
    this.reason = reason;
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase();

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new RelationshipInvitationError("athlete_email_invalid");
  }

  return email;
}

async function findActiveAthleteByEmail(
  email: string
): Promise<Readonly<{ user_id: string; display_name: string }>> {
  const result = await pool.query(
    `
    SELECT user_id, display_name
    FROM product_accounts
    WHERE
      email_canonical = $1
      AND actor_type = 'athlete'
      AND account_state = 'active'
    `,
    [email]
  );

  const row = result.rows[0];

  if (!row) {
    throw new RelationshipInvitationError("athlete_not_found", 404);
  }

  return Object.freeze({
    user_id: String(row.user_id),
    display_name: String(row.display_name)
  });
}

async function requireActiveCoachProfile(
  coachUserId: string
): Promise<Readonly<JsonRecord>> {
  const profile = await loadLatestBetaProductRecord(
    "beta17_coach_profile",
    coachUserId,
    coachUserId
  );

  if (
    !profile ||
    profile.account_role !== "coach" ||
    profile.account_state !== "active"
  ) {
    throw new RelationshipInvitationError("coach_not_active", 403);
  }

  return profile;
}

async function latestRelationshipRecord(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_coach_relationship'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, athleteUserId]
  );

  const row = result.rows[0];
  return row && isRecord(row.record_payload) ? row.record_payload : null;
}

async function relationshipRecordById(
  relationshipId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_coach_relationship'
      AND record_id = $1
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [relationshipId]
  );

  const row = result.rows[0];
  return row && isRecord(row.record_payload) ? row.record_payload : null;
}

function writeRelationshipTransition(
  input: Readonly<{
    relationship_id: string;
    coach_user_id: string;
    athlete_user_id: string;
    relationship_state: "invited" | "accepted" | "declined" | "revoked";
    created_at_iso8601: string;
    updated_at_iso8601: string;
    accepted_at_iso8601: string | null;
    revoked_at_iso8601?: string | null;
  }>
): Promise<Readonly<JsonRecord>> {
  const result = createBeta17RelationshipRecord({
    relationship_id: input.relationship_id,
    coach_user_id: input.coach_user_id,
    athlete_user_id: input.athlete_user_id,
    relationship_state: input.relationship_state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: input.accepted_at_iso8601,
    created_at_iso8601: input.created_at_iso8601,
    updated_at_iso8601: input.updated_at_iso8601,
    revoked_at_iso8601: input.revoked_at_iso8601 ?? null,
    expires_at_iso8601: null
  });

  if (
    result.status !== 201 ||
    result.body.ok !== true ||
    !isRecord(result.body.relationship)
  ) {
    throw new RelationshipInvitationError(
      cleanString(result.body.reason) || "invitation_rejected"
    );
  }

  return persistBetaProductRecord(result.body.relationship);
}

// Coach action: invite an athlete by their own email address. The coach
// never sees or types the athlete's internal user_id.
export async function createRelationshipInvitationByEmail(
  coachUserId: string,
  athleteEmailInput: unknown
): Promise<Readonly<JsonRecord>> {
  const coachUserIdClean = cleanString(coachUserId);
  if (!coachUserIdClean) {
    throw new RelationshipInvitationError("coach_user_id_required");
  }

  await requireActiveCoachProfile(coachUserIdClean);
  const email = canonicalEmail(athleteEmailInput);
  const athlete = await findActiveAthleteByEmail(email);

  const existing = await latestRelationshipRecord(coachUserIdClean, athlete.user_id);

  if (existing && existing.relationship_state === "accepted") {
    throw new RelationshipInvitationError("relationship_already_accepted", 409);
  }

  const timestamp = new Date().toISOString();
  const relationshipId =
    (existing ? cleanString(existing.relationship_id) : "") ||
    `relationship_${crypto.randomUUID().replaceAll("-", "")}`;

  return writeRelationshipTransition({
    relationship_id: relationshipId,
    coach_user_id: coachUserIdClean,
    athlete_user_id: athlete.user_id,
    relationship_state: "invited",
    created_at_iso8601: existing ? cleanString(existing.created_at_iso8601) || timestamp : timestamp,
    updated_at_iso8601: timestamp,
    accepted_at_iso8601: null
  });
}

async function latestRelationshipRecordsForAthlete(
  athleteUserId: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (actor_user_id)
      actor_user_id,
      record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_coach_relationship'
      AND subject_user_id = $1
    ORDER BY
      actor_user_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((relationship): relationship is JsonRecord => relationship !== null);
}

function relationshipExpired(relationship: Readonly<JsonRecord>): boolean {
  if (relationship.relationship_state !== "invited") return false;
  const expiresAt = cleanString(relationship.expires_at_iso8601);
  return Boolean(expiresAt) && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now();
}

async function withCoachDisplay(
  relationship: Readonly<JsonRecord>
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(relationship.coach_user_id);

  let coachProfile = null;
  let brandPreference = null;
  try {
    [coachProfile, brandPreference] = await Promise.all([
      loadLatestBetaProductRecord(
        "beta17_coach_profile",
        coachUserId,
        coachUserId
      ),
      loadLatestBetaProductRecord(
        "coach_brand_preference",
        coachUserId,
        coachUserId
      )
    ]);
  }
  catch {
    // One malformed/temporarily unavailable coach display record must not
    // hide every other relationship from the athlete's list.
  }

  return Object.freeze({
    relationship_id: cleanString(relationship.relationship_id),
    coach_user_id: coachUserId,
    coach_display_name: cleanString(coachProfile?.display_name) || coachUserId,
    coach_email: cleanString(coachProfile?.email) || null,
    coach_brand_color: cleanString(brandPreference?.brand_color) || null,
    coach_brand_tagline: cleanString(brandPreference?.brand_tagline) || null,
    relationship_state: relationshipExpired(relationship) ? "expired" : relationship.relationship_state,
    created_at_iso8601: cleanString(relationship.created_at_iso8601),
    accepted_at_iso8601: cleanString(relationship.accepted_at_iso8601) || null,
    revoked_at_iso8601: cleanString(relationship.revoked_at_iso8601) || null,
    updated_at_iso8601: cleanString(relationship.updated_at_iso8601)
  });
}

export async function listPendingRelationshipInvitationsForAthlete(
  athleteUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const athleteUserId = cleanString(athleteUserIdInput);
  if (!athleteUserId) {
    throw new RelationshipInvitationError("athlete_user_id_required");
  }

  const all = await latestRelationshipRecordsForAthlete(athleteUserId);
  const pending = all.filter(
    (relationship) => relationship.relationship_state === "invited" && !relationshipExpired(relationship)
  );

  return Promise.all(pending.map(withCoachDisplay));
}

export async function listRelationshipsForAthlete(
  athleteUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const athleteUserId = cleanString(athleteUserIdInput);
  if (!athleteUserId) {
    throw new RelationshipInvitationError("athlete_user_id_required");
  }

  const all = await latestRelationshipRecordsForAthlete(athleteUserId);
  const relevant = all.filter((relationship) => relationship.relationship_state !== "invited");

  return Promise.all(relevant.map(withCoachDisplay));
}

export async function acceptRelationshipInvitation(
  athleteUserIdInput: string,
  relationshipIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const athleteUserId = cleanString(athleteUserIdInput);
  const relationshipId = cleanString(relationshipIdInput);

  if (!athleteUserId || !relationshipId) {
    throw new RelationshipInvitationError("relationship_identity_required");
  }

  const current = await relationshipRecordById(relationshipId);

  if (
    !current ||
    cleanString(current.athlete_user_id) !== athleteUserId ||
    current.relationship_state !== "invited"
  ) {
    throw new RelationshipInvitationError("invitation_not_pending", 404);
  }

  // LAUNCH-04 hard commercial-cap gate. The check is server-authoritative
  // and occurs before an accepted relationship transition is persisted.
  // When LAUNCH-04 is disabled the helper is a no-op, preserving historical
  // controlled-launch behaviour and proofs.
  await assertPublicLaunchCoachCapacity(
    cleanString(current.coach_user_id)
  );

  const timestamp = new Date().toISOString();

  return writeRelationshipTransition({
    relationship_id: relationshipId,
    coach_user_id: cleanString(current.coach_user_id),
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    created_at_iso8601: cleanString(current.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp,
    accepted_at_iso8601: timestamp
  });
}

export async function declineRelationshipInvitation(
  athleteUserIdInput: string,
  relationshipIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const athleteUserId = cleanString(athleteUserIdInput);
  const relationshipId = cleanString(relationshipIdInput);

  if (!athleteUserId || !relationshipId) {
    throw new RelationshipInvitationError("relationship_identity_required");
  }

  const current = await relationshipRecordById(relationshipId);

  if (
    !current ||
    cleanString(current.athlete_user_id) !== athleteUserId ||
    current.relationship_state !== "invited"
  ) {
    throw new RelationshipInvitationError("invitation_not_pending", 404);
  }

  const timestamp = new Date().toISOString();

  return writeRelationshipTransition({
    relationship_id: relationshipId,
    coach_user_id: cleanString(current.coach_user_id),
    athlete_user_id: athleteUserId,
    relationship_state: "declined",
    created_at_iso8601: cleanString(current.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp,
    accepted_at_iso8601: null,
    revoked_at_iso8601: timestamp
  });
}

export async function athleteEndsRelationship(
  athleteUserIdInput: string,
  relationshipIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const athleteUserId = cleanString(athleteUserIdInput);
  const relationshipId = cleanString(relationshipIdInput);

  if (!athleteUserId || !relationshipId) {
    throw new RelationshipInvitationError("relationship_identity_required");
  }

  const current = await relationshipRecordById(relationshipId);

  if (
    !current ||
    cleanString(current.athlete_user_id) !== athleteUserId ||
    current.relationship_state !== "accepted"
  ) {
    throw new RelationshipInvitationError("relationship_not_active", 404);
  }

  const timestamp = new Date().toISOString();

  return writeRelationshipTransition({
    relationship_id: relationshipId,
    coach_user_id: cleanString(current.coach_user_id),
    athlete_user_id: athleteUserId,
    relationship_state: "revoked",
    created_at_iso8601: cleanString(current.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp,
    accepted_at_iso8601: cleanString(current.accepted_at_iso8601) || null,
    revoked_at_iso8601: timestamp
  });
}
