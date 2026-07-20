
// DEV NOTE: BETA-E2E-01 immutable beta product-record persistence.
// This store persists validated application records only. It does not import
// engine code, alter canonical inputs, infer decisions or broaden runtime scope.

import { pool } from "../db/pool.js";

type JsonRecord =
  Record<string, unknown>;

type SupportedRecordType =
  | "beta16_auth"
  | "beta16_acknowledgement"
  | "beta16_phase1_declaration"
  | "beta17_coach_profile"
  | "beta17_coach_relationship"
  | "beta17_assignment_trigger"
  | "beta18_programme_template";

type ProductRecordMetadata =
  Readonly<{
    record_type: SupportedRecordType;
    record_id: string;
    subject_user_id: string;
    actor_user_id: string;
    effective_at_iso8601: string;
    record_sha256: string;
  }>;

const supportedRecordTypes =
  new Set<SupportedRecordType>([
    "beta16_auth",
    "beta16_acknowledgement",
    "beta16_phase1_declaration",
    "beta17_coach_profile",
    "beta17_coach_relationship",
    "beta17_assignment_trigger",
    "beta18_programme_template"
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

function requiredString(
  record: JsonRecord,
  key: string,
  reason: string
): string {
  const value =
    cleanString(record[key]);

  if (!value) {
    throw new Error(
      `beta_product_record_${reason}`
    );
  }

  return value;
}

function supportedRecordType(
  value: unknown
): SupportedRecordType {
  const recordType =
    cleanString(value) as SupportedRecordType;

  if (
    !supportedRecordTypes.has(
      recordType
    )
  ) {
    throw new Error(
      "beta_product_record_type_unsupported"
    );
  }

  return recordType;
}

function recordMetadata(
  record: unknown
): ProductRecordMetadata {
  if (!isRecord(record)) {
    throw new Error(
      "beta_product_record_invalid"
    );
  }

  const recordType =
    supportedRecordType(
      record.record_type
    );

  const recordSha256 =
    requiredString(
      record,
      "record_sha256",
      "hash_required"
    );

  if (
    !/^[a-f0-9]{64}$/u.test(
      recordSha256
    )
  ) {
    throw new Error(
      "beta_product_record_hash_invalid"
    );
  }

  switch (recordType) {
    case "beta16_auth": {
      const userId =
        requiredString(
          record,
          "user_id",
          "auth_user_id_required"
        );

      return {
        record_type: recordType,
        record_id: userId,
        subject_user_id: userId,
        actor_user_id: userId,
        effective_at_iso8601:
          requiredString(
            record,
            "created_at_iso8601",
            "auth_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

    case "beta16_acknowledgement": {
      const userId =
        requiredString(
          record,
          "user_id",
          "acknowledgement_user_id_required"
        );

      return {
        record_type: recordType,
        record_id:
          requiredString(
            record,
            "acknowledgement_id",
            "acknowledgement_id_required"
          ),
        subject_user_id: userId,
        actor_user_id: userId,
        effective_at_iso8601:
          requiredString(
            record,
            "accepted_at_iso8601",
            "acknowledgement_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

    case "beta16_phase1_declaration": {
      const userId =
        requiredString(
          record,
          "declared_by_user_id",
          "declaration_user_id_required"
        );

      return {
        record_type: recordType,
        record_id:
          requiredString(
            record,
            "declaration_id",
            "declaration_id_required"
          ),
        subject_user_id:
          requiredString(
            record,
            "subject_user_id",
            "declaration_subject_required"
          ),
        actor_user_id: userId,
        effective_at_iso8601:
          requiredString(
            record,
            "declared_at_iso8601",
            "declaration_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

    case "beta17_coach_profile": {
      const coachUserId =
        requiredString(
          record,
          "coach_user_id",
          "coach_user_id_required"
        );

      return {
        record_type: recordType,
        record_id: coachUserId,
        subject_user_id: coachUserId,
        actor_user_id: coachUserId,
        effective_at_iso8601:
          requiredString(
            record,
            "created_at_iso8601",
            "coach_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

    case "beta17_coach_relationship": {
      return {
        record_type: recordType,
        record_id:
          requiredString(
            record,
            "relationship_id",
            "relationship_id_required"
          ),
        subject_user_id:
          requiredString(
            record,
            "athlete_user_id",
            "relationship_athlete_required"
          ),
        actor_user_id:
          requiredString(
            record,
            "coach_user_id",
            "relationship_coach_required"
          ),
        effective_at_iso8601:
          requiredString(
            record,
            "updated_at_iso8601",
            "relationship_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

    case "beta17_assignment_trigger": {
      return {
        record_type: recordType,
        record_id:
          requiredString(
            record,
            "assignment_id",
            "assignment_id_required"
          ),
        subject_user_id:
          requiredString(
            record,
            "assigned_athlete_id",
            "assignment_athlete_required"
          ),
        actor_user_id:
          requiredString(
            record,
            "assigned_by_coach_id",
            "assignment_coach_required"
          ),
        effective_at_iso8601:
          requiredString(
            record,
            "requested_at_iso8601",
            "assignment_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }
    case "beta18_programme_template": {
      const coachUserId =
        requiredString(
          record,
          "coach_user_id",
          "template_coach_required"
        );

      return {
        record_type: recordType,
        record_id:
          requiredString(
            record,
            "template_id",
            "template_id_required"
          ),
        subject_user_id:
          coachUserId,
        actor_user_id:
          coachUserId,
        effective_at_iso8601:
          requiredString(
            record,
            "updated_at_iso8601",
            "template_effective_at_required"
          ),
        record_sha256: recordSha256
      };
    }

  }
}

async function storedExactRecord(
  metadata: ProductRecordMetadata
): Promise<JsonRecord | null> {
  const result =
    await pool.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type = $1
        AND record_id = $2
        AND record_sha256 = $3
      LIMIT 1
      `,
      [
        metadata.record_type,
        metadata.record_id,
        metadata.record_sha256
      ]
    );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? payload
    : null;
}

/**
 * FUNCTION NOTE:
 * Purpose: Persists one validated immutable beta product record.
 * Boundary: Stores application state only; never calls the engine.
 * Determinism: The record factory hash is retained unchanged.
 * Failure: Unsupported or malformed records fail closed.
 */
export async function persistBetaProductRecord(
  record: unknown
): Promise<Readonly<JsonRecord>> {
  const metadata =
    recordMetadata(record);

  const recordPayload =
    JSON.stringify(record);

  await pool.query(
    `
    INSERT INTO beta_product_records (
      record_type,
      record_id,
      subject_user_id,
      actor_user_id,
      effective_at,
      record_sha256,
      record_payload
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::timestamptz,
      $6,
      $7::jsonb
    )
    ON CONFLICT (
      record_type,
      record_id,
      record_sha256
    )
    DO NOTHING
    `,
    [
      metadata.record_type,
      metadata.record_id,
      metadata.subject_user_id,
      metadata.actor_user_id,
      metadata.effective_at_iso8601,
      metadata.record_sha256,
      recordPayload
    ]
  );

  const stored =
    await storedExactRecord(metadata);

  if (!stored) {
    throw new Error(
      "beta_product_record_persist_readback_failed"
    );
  }

  return Object.freeze(stored);
}

/**
 * FUNCTION NOTE:
 * Purpose: Loads the latest immutable record for a subject and optional actor.
 * Boundary: Read-only product-state query.
 * Determinism: Ordering uses effective timestamp and immutable identifiers.
 * Failure: Invalid selectors fail closed.
 */
export async function loadLatestBetaProductRecord(
  recordTypeInput: string,
  subjectUserIdInput: string,
  actorUserIdInput?: string
): Promise<Readonly<JsonRecord> | null> {
  const recordType =
    supportedRecordType(
      recordTypeInput
    );

  const subjectUserId =
    cleanString(
      subjectUserIdInput
    );

  const actorUserId =
    cleanString(
      actorUserIdInput
    );

  if (!subjectUserId) {
    throw new Error(
      "beta_product_record_subject_required"
    );
  }

  const values: string[] = [
    recordType,
    subjectUserId
  ];

  let actorClause = "";

  if (actorUserId) {
    values.push(actorUserId);

    actorClause =
      "AND actor_user_id = $3";
  }

  const result =
    await pool.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type = $1
        AND subject_user_id = $2
        ${actorClause}
      ORDER BY
        effective_at DESC,
        created_at DESC,
        record_id DESC,
        record_sha256 DESC
      LIMIT 1
      `,
      values
    );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? Object.freeze(payload)
    : null;
}

/**
 * FUNCTION NOTE:
 * Purpose: Loads stored athlete records used by existing BETA-16 admission.
 * Boundary: Does not validate Phase 1 or call compile.
 * Determinism: Returns the latest immutable records by effective timestamp.
 * Failure: Returns null unless the complete context exists.
 */
export async function loadBeta16StoredCompileContext(
  userId: string
): Promise<
  Readonly<{
    auth_record: Readonly<JsonRecord>;
    acknowledgement_record:
      Readonly<JsonRecord>;
    declaration_record:
      Readonly<JsonRecord>;
  }> |
  null
> {
  const [
    authRecord,
    acknowledgementRecord,
    declarationRecord
  ] = await Promise.all([
    loadLatestBetaProductRecord(
      "beta16_auth",
      userId,
      userId
    ),
    loadLatestBetaProductRecord(
      "beta16_acknowledgement",
      userId,
      userId
    ),
    loadLatestBetaProductRecord(
      "beta16_phase1_declaration",
      userId,
      userId
    )
  ]);

  if (
    !authRecord ||
    !acknowledgementRecord ||
    !declarationRecord
  ) {
    return null;
  }

  return Object.freeze({
    auth_record: authRecord,
    acknowledgement_record:
      acknowledgementRecord,
    declaration_record:
      declarationRecord
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Loads stored coach profile and latest relationship state.
 * Boundary: Does not grant access; existing BETA-17 guards remain authoritative.
 * Determinism: Returns immutable stored records only.
 * Failure: Returns null unless both records exist.
 */
export async function loadBeta17StoredCoachContext(
  coachUserId: string,
  athleteUserId: string
): Promise<
  Readonly<{
    coach_profile: Readonly<JsonRecord>;
    relationship: Readonly<JsonRecord>;
  }> |
  null
> {
  const [
    coachProfile,
    relationship
  ] = await Promise.all([
    loadLatestBetaProductRecord(
      "beta17_coach_profile",
      coachUserId,
      coachUserId
    ),
    loadLatestBetaProductRecord(
      "beta17_coach_relationship",
      athleteUserId,
      coachUserId
    )
  ]);

  if (
    !coachProfile ||
    !relationship
  ) {
    return null;
  }

  return Object.freeze({
    coach_profile: coachProfile,
    relationship
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Loads the latest stored assignment for one coach-athlete pair.
 * Boundary: Read-only product-state query.
 * Determinism: Uses immutable assignment records and effective timestamp ordering.
 * Failure: Returns null when no assignment exists.
 */
export async function loadLatestBeta17StoredAssignment(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord> | null> {
  return loadLatestBetaProductRecord(
    "beta17_assignment_trigger",
    athleteUserId,
    coachUserId
  );
}
