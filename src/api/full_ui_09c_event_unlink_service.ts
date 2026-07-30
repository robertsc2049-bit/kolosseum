// DEV NOTE: FULL-UI-09C immutable unlink transition.
// Kept as a narrow module so unlinking cannot delete assignment or session history.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  FullUi09cEventLifecycleError
} from "./full_ui_09c_event_lifecycle_service.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!isRecord(value)) return value;
  const output: JsonRecord = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalise(value[key]);
  return output;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
}

async function requireCoachAndRelationship(
  coachUserId: string,
  athleteUserId: string
): Promise<void> {
  const [profile, context] = await Promise.all([
    loadLatestBetaProductRecord(
      "beta17_coach_profile",
      coachUserId,
      coachUserId
    ),
    loadBeta17StoredCoachContext(coachUserId, athleteUserId)
  ]);

  if (
    !profile ||
    profile.account_role !== "coach" ||
    profile.account_state !== "active"
  ) {
    throw new FullUi09cEventLifecycleError("coach_access_denied");
  }
  if (!context || context.relationship.relationship_state !== "accepted") {
    throw new FullUi09cEventLifecycleError("relationship_access_denied");
  }
}

export async function unlinkAthleteFromStandaloneEventSafely(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new FullUi09cEventLifecycleError("event_unlink_input_invalid");
  }

  const allowed = new Set([
    "coach_user_id",
    "event_id",
    "athlete_user_id"
  ]);
  for (const key of Object.keys(inputValue)) {
    if (!allowed.has(key)) {
      throw new FullUi09cEventLifecycleError("event_unlink_unknown_field");
    }
  }

  const coachUserId = cleanString(inputValue.coach_user_id);
  const eventId = cleanString(inputValue.event_id);
  const athleteUserId = cleanString(inputValue.athlete_user_id);
  if (!coachUserId || !eventId || !athleteUserId) {
    throw new FullUi09cEventLifecycleError("event_unlink_identity_required");
  }

  await requireCoachAndRelationship(coachUserId, athleteUserId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`full_ui_09c_event_link:${coachUserId}:${athleteUserId}:${eventId}`]
    );

    const eventResult = await client.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type = 'beta19_coach_event'
        AND record_id = $1
        AND actor_user_id = $2
      ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
      LIMIT 1
      FOR UPDATE
      `,
      [eventId, coachUserId]
    );
    if (!isRecord(eventResult.rows?.[0]?.record_payload)) {
      const foreignResult = await client.query(
        `
        SELECT 1
        FROM beta_product_records
        WHERE
          record_type = 'beta19_coach_event'
          AND record_id = $1
          AND actor_user_id <> $2
        LIMIT 1
        `,
        [eventId, coachUserId]
      );
      throw new FullUi09cEventLifecycleError(
        (foreignResult.rowCount ?? 0) > 0
          ? "event_ownership_denied"
          : "event_not_found"
      );
    }

    const linkResult = await client.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type = 'beta19_event_athlete_link'
        AND actor_user_id = $1
        AND subject_user_id = $2
        AND record_payload ->> 'event_id' = $3
      ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
      LIMIT 1
      FOR UPDATE
      `,
      [coachUserId, athleteUserId, eventId]
    );
    const currentLink = linkResult.rows?.[0]?.record_payload;
    if (!isRecord(currentLink) || currentLink.link_state !== "linked") {
      throw new FullUi09cEventLifecycleError("event_link_not_found");
    }

    const clockResult = await client.query(
      `
      SELECT to_char(
        clock_timestamp() AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS server_now
      `
    );
    const serverNow = cleanString(clockResult.rows?.[0]?.server_now);
    const previousTime = Date.parse(cleanString(currentLink.updated_at_iso8601));
    const occurredAt = new Date(
      Math.max(Date.parse(serverNow), Number.isFinite(previousTime) ? previousTime + 1 : 0)
    ).toISOString();

    const {
      record_sha256: previousRecordSha256,
      ...historicalFields
    } = currentLink;
    const withoutHash = {
      ...historicalFields,
      contract_version: "full_ui_09c.1.0.0",
      link_state: "unlinked",
      link_revision: Number(currentLink.link_revision ?? 1) + 1,
      previous_link_record_sha256: cleanString(previousRecordSha256),
      lifecycle_action: "athlete_unlinked",
      updated_at_iso8601: occurredAt,
      unlinked_at_iso8601: occurredAt,
      immutable_link_history: true,
      engine_visible: false
    };

    const persisted = await persistBetaProductRecord(
      Object.freeze({
        ...withoutHash,
        record_sha256: sha256(withoutHash)
      }),
      client
    );

    await client.query("COMMIT");
    return persisted;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}
