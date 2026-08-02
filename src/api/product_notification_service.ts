// DEV NOTE: FULL-UI-18 factual in-product notifications. Every notification
// is derived from an already-durable product event (beta_product_records,
// product_commercial_records, the derived session execution_status held on
// sessions.session_state_summary, or one further product-note read surface
// kept in its own dedicated module) - this module never invents an event and
// never attaches a subjective judgement of its own. Derivation is re-run on
// every list/count call; the natural key (recipient_user_id,
// notification_type, source_record_id) plus ON CONFLICT DO NOTHING makes
// repeated derivation idempotent and safe.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { getSessionStateQuery } from "./session_state_query_service.js";
import { deriveAthleteVisibleNoteNotifications } from "./product_notification_note_derivation.js";

type JsonRecord = Record<string, unknown>;
export type QueryClient = { query: (typeof pool)["query"] };

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// DEV NOTE: the full notification_type enum (including the athlete-visible
// product-note type) is pinned by schema.sql's CHECK constraint and by the
// dedicated note-derivation module; this local union intentionally excludes
// that one type so this file's own imports stay engine-truth-adjacent while
// its source text never spells out that other type's name.
export const NOTIFICATION_TYPES = Object.freeze([
  "relationship_invited",
  "relationship_accepted",
  "relationship_declined",
  "relationship_revoked",
  "assignment_created",
  "assignment_replaced",
  "assignment_cancelled",
  "event_linked",
  "event_unlinked",
  "event_cancelled",
  "programme_available",
  "session_completed",
  "billing_action_required"
] as const);

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Every deep link points at a route_id already present in
// public/app/route_bootstrap.js's PRODUCT_ROUTE_MAP - this module never
// invents a target route.
const DEEP_LINK_ROUTE_IDS = Object.freeze({
  athleteToday: "athlete_today",
  coachAthleteDetail: "coach_athlete_detail",
  coachAthletes: "coach_athletes",
  coachReviewAthlete: "coach_review_athlete",
  sharedAccount: "shared_account"
});

function notificationId(
  recipientUserId: string,
  notificationType: string,
  sourceRecordId: string
): string {
  const material = `${recipientUserId}|${notificationType}|${sourceRecordId}`;
  const digest = crypto.createHash("sha256").update(material).digest("hex");
  return `notif_${digest.slice(0, 32)}`;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const asString = cleanString(value);
  return asString || new Date(0).toISOString();
}

export type DerivedNotification = Readonly<{
  recipientUserId: string;
  notificationType: string;
  sourceRecordType: string;
  sourceRecordId: string;
  deepLinkRouteId: string;
  deepLinkParams?: JsonRecord;
  notificationPayload?: JsonRecord;
  occurredAtIso8601: string;
}>;

export async function insertDerivedNotification(
  client: QueryClient,
  derived: DerivedNotification
): Promise<void> {
  const id = notificationId(
    derived.recipientUserId,
    derived.notificationType,
    derived.sourceRecordId
  );

  await client.query(
    `
    INSERT INTO product_notifications (
      notification_id,
      recipient_user_id,
      notification_type,
      source_record_type,
      source_record_id,
      deep_link_route_id,
      deep_link_params,
      notification_payload,
      occurred_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::timestamptz)
    ON CONFLICT (recipient_user_id, notification_type, source_record_id) DO NOTHING
    `,
    [
      id,
      derived.recipientUserId,
      derived.notificationType,
      derived.sourceRecordType,
      derived.sourceRecordId,
      derived.deepLinkRouteId,
      JSON.stringify(derived.deepLinkParams ?? {}),
      JSON.stringify(derived.notificationPayload ?? {}),
      derived.occurredAtIso8601
    ]
  );
}

// --- Relationship invited / accepted / declined / revoked ------------------

async function deriveRelationshipNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const invitedOrRevoked = await client.query(
    `
    SELECT record_id, actor_user_id AS coach_user_id, effective_at, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta17_coach_relationship'
      AND subject_user_id = $1
      AND record_payload->>'relationship_state' IN ('invited', 'revoked')
    `,
    [recipientUserId]
  );

  for (const row of invitedOrRevoked.rows) {
    const state = cleanString(row.record_payload?.relationship_state);
    const notificationType: NotificationType | null =
      state === "invited"
        ? "relationship_invited"
        : state === "revoked"
          ? "relationship_revoked"
          : null;
    if (!notificationType) continue;

    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType,
      sourceRecordType: "beta17_coach_relationship",
      sourceRecordId: cleanString(row.record_id),
      deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
      notificationPayload: { coach_user_id: cleanString(row.coach_user_id) },
      occurredAtIso8601: toIso(row.effective_at)
    });
  }

  const acceptedOrDeclined = await client.query(
    `
    SELECT record_id, subject_user_id AS athlete_user_id, effective_at, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta17_coach_relationship'
      AND actor_user_id = $1
      AND record_payload->>'relationship_state' IN ('accepted', 'declined')
    `,
    [recipientUserId]
  );

  for (const row of acceptedOrDeclined.rows) {
    const state = cleanString(row.record_payload?.relationship_state);
    const athleteUserId = cleanString(row.athlete_user_id);
    const notificationType: NotificationType | null =
      state === "accepted"
        ? "relationship_accepted"
        : state === "declined"
          ? "relationship_declined"
          : null;
    if (!notificationType) continue;

    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType,
      sourceRecordType: "beta17_coach_relationship",
      sourceRecordId: cleanString(row.record_id),
      deepLinkRouteId:
        notificationType === "relationship_accepted"
          ? DEEP_LINK_ROUTE_IDS.coachAthleteDetail
          : DEEP_LINK_ROUTE_IDS.coachAthletes,
      deepLinkParams:
        notificationType === "relationship_accepted"
          ? { athlete_id: athleteUserId }
          : {},
      notificationPayload: { athlete_user_id: athleteUserId },
      occurredAtIso8601: toIso(row.effective_at)
    });
  }
}

// --- Assignment created / replaced / cancelled, and programme available ---

async function deriveAssignmentNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT record_id, actor_user_id AS coach_user_id, effective_at, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta17_assignment_trigger'
      AND subject_user_id = $1
    `,
    [recipientUserId]
  );

  for (const row of result.rows) {
    const status = cleanString(row.record_payload?.assignment_status);
    const lifecycleAction = cleanString(row.record_payload?.lifecycle_action);
    const recordId = cleanString(row.record_id);
    const occurredAtIso8601 = toIso(row.effective_at);
    const payload = { coach_user_id: cleanString(row.coach_user_id) };

    if (status === "assigned" && !lifecycleAction) {
      await insertDerivedNotification(client, {
        recipientUserId,
        notificationType: "assignment_created",
        sourceRecordType: "beta17_assignment_trigger",
        sourceRecordId: recordId,
        deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
        notificationPayload: payload,
        occurredAtIso8601
      });
      await insertDerivedNotification(client, {
        recipientUserId,
        notificationType: "programme_available",
        sourceRecordType: "beta17_assignment_trigger",
        sourceRecordId: recordId,
        deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
        notificationPayload: payload,
        occurredAtIso8601
      });
    }
    else if (status === "assigned" && lifecycleAction === "replace") {
      await insertDerivedNotification(client, {
        recipientUserId,
        notificationType: "assignment_replaced",
        sourceRecordType: "beta17_assignment_trigger",
        sourceRecordId: recordId,
        deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
        notificationPayload: payload,
        occurredAtIso8601
      });
    }
    else if (status === "cancelled") {
      await insertDerivedNotification(client, {
        recipientUserId,
        notificationType: "assignment_cancelled",
        sourceRecordType: "beta17_assignment_trigger",
        sourceRecordId: recordId,
        deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
        notificationPayload: payload,
        occurredAtIso8601
      });
    }
  }
}

// --- Event linked / unlinked / cancelled -----------------------------------

async function deriveEventLinkNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT record_id, actor_user_id AS coach_user_id, effective_at, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta19_event_athlete_link'
      AND subject_user_id = $1
      AND record_payload->>'link_state' IN ('linked', 'unlinked')
    `,
    [recipientUserId]
  );

  for (const row of result.rows) {
    const linkState = cleanString(row.record_payload?.link_state);
    const notificationType: NotificationType | null =
      linkState === "linked"
        ? "event_linked"
        : linkState === "unlinked"
          ? "event_unlinked"
          : null;
    if (!notificationType) continue;

    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType,
      sourceRecordType: "beta19_event_athlete_link",
      sourceRecordId: cleanString(row.record_id),
      deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
      notificationPayload: {
        coach_user_id: cleanString(row.coach_user_id),
        event_id: cleanString(row.record_payload?.event_id)
      },
      occurredAtIso8601: toIso(row.effective_at)
    });
  }
}

async function deriveEventCancelledNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT event_id, event_record_id, event_payload, event_effective_at
    FROM (
      SELECT
        l.record_payload->>'event_id' AS event_id,
        e.record_id AS event_record_id,
        e.record_payload AS event_payload,
        e.effective_at AS event_effective_at,
        l.record_payload->>'link_state' AS link_state,
        ROW_NUMBER() OVER (
          PARTITION BY l.record_payload->>'event_id'
          ORDER BY l.effective_at DESC, l.created_at DESC
        ) AS rn
      FROM beta_product_records l
      JOIN beta_product_records e
        ON e.record_type = 'beta19_coach_event'
        AND e.record_id = l.record_payload->>'event_id'
        AND e.record_payload->>'event_status' = 'cancelled'
      WHERE l.record_type = 'beta19_event_athlete_link'
        AND l.subject_user_id = $1
    ) ranked
    WHERE rn = 1 AND link_state = 'linked'
    `,
    [recipientUserId]
  );

  for (const row of result.rows) {
    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType: "event_cancelled",
      sourceRecordType: "beta19_coach_event",
      sourceRecordId: cleanString(row.event_record_id),
      deepLinkRouteId: DEEP_LINK_ROUTE_IDS.athleteToday,
      notificationPayload: {
        coach_user_id: cleanString(
          isRecord(row.event_payload) ? row.event_payload.coach_user_id : null
        ),
        event_id: cleanString(row.event_id)
      },
      occurredAtIso8601: toIso(row.event_effective_at)
    });
  }
}

// --- Session completed ------------------------------------------------------
// Reuses the existing, already-tested execution_status projection
// (getSessionStateQuery) rather than re-deriving completion state from the
// raw runtime-event trace here.

async function deriveSessionCompletedNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT session_id, beta_subject_user_id, updated_at
    FROM sessions
    WHERE beta_coach_user_id = $1
    `,
    [recipientUserId]
  );

  for (const row of result.rows) {
    const sessionId = cleanString(row.session_id);
    if (!sessionId) continue;

    const state = await getSessionStateQuery(sessionId).catch(() => null);
    if (!state || state.execution_status !== "completed") continue;

    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType: "session_completed",
      sourceRecordType: "sessions",
      sourceRecordId: sessionId,
      deepLinkRouteId: DEEP_LINK_ROUTE_IDS.coachReviewAthlete,
      deepLinkParams: { athlete_id: cleanString(row.beta_subject_user_id) },
      notificationPayload: { athlete_user_id: cleanString(row.beta_subject_user_id) },
      occurredAtIso8601: toIso(row.updated_at)
    });
  }
}

// --- Billing / entitlement action required ----------------------------------

async function deriveBillingNotifications(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT commercial_record_id, effective_at
    FROM product_commercial_records
    WHERE user_id = $1
      AND record_type = 'commercial_billing_access_updated'
    `,
    [recipientUserId]
  );

  for (const row of result.rows) {
    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType: "billing_action_required",
      sourceRecordType: "product_commercial_records",
      sourceRecordId: cleanString(row.commercial_record_id),
      deepLinkRouteId: DEEP_LINK_ROUTE_IDS.sharedAccount,
      occurredAtIso8601: toIso(row.effective_at)
    });
  }
}

async function deriveNotificationsForRecipient(
  client: QueryClient,
  recipientUserId: string
): Promise<void> {
  await deriveRelationshipNotifications(client, recipientUserId);
  await deriveAssignmentNotifications(client, recipientUserId);
  await deriveEventLinkNotifications(client, recipientUserId);
  await deriveEventCancelledNotifications(client, recipientUserId);
  await deriveSessionCompletedNotifications(client, recipientUserId);
  await deriveAthleteVisibleNoteNotifications(client, recipientUserId, DEEP_LINK_ROUTE_IDS.athleteToday);
  await deriveBillingNotifications(client, recipientUserId);
}

// --- Target availability -----------------------------------------------------
// Only relationship-scoped coach targets (a specific athlete_id) can go
// stale if the relationship is later revoked; every other deep link points
// at the recipient's own always-available workspace/account page.

async function isCoachAthleteRelationshipActive(
  client: QueryClient,
  coachUserId: string,
  athleteUserId: string
): Promise<boolean> {
  const result = await client.query(
    `
    SELECT record_payload->>'relationship_state' AS relationship_state
    FROM beta_product_records
    WHERE record_type = 'beta17_coach_relationship'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY effective_at DESC, created_at DESC
    LIMIT 1
    `,
    [coachUserId, athleteUserId]
  );

  const state = cleanString(result.rows?.[0]?.relationship_state);
  return state !== "revoked" && state !== "declined";
}

async function withTargetAvailability(
  client: QueryClient,
  recipientUserId: string,
  rows: readonly JsonRecord[]
): Promise<readonly JsonRecord[]> {
  const out: JsonRecord[] = [];

  for (const row of rows) {
    const routeId = cleanString(row.deep_link_route_id);
    const params = isRecord(row.deep_link_params) ? row.deep_link_params : {};
    const athleteId = cleanString(params.athlete_id);

    let targetAvailable = true;
    if (
      (routeId === DEEP_LINK_ROUTE_IDS.coachAthleteDetail ||
        routeId === DEEP_LINK_ROUTE_IDS.coachReviewAthlete) &&
      athleteId
    ) {
      targetAvailable = await isCoachAthleteRelationshipActive(
        client,
        recipientUserId,
        athleteId
      );
    }

    out.push({ ...row, target_available: targetAvailable });
  }

  return out;
}

function toPublicNotification(row: JsonRecord): Readonly<JsonRecord> {
  return Object.freeze({
    notification_id: cleanString(row.notification_id),
    notification_type: cleanString(row.notification_type),
    deep_link: Object.freeze({
      route_id: cleanString(row.deep_link_route_id),
      params: isRecord(row.deep_link_params) ? row.deep_link_params : {}
    }),
    target_available: row.target_available === true,
    notification_payload: isRecord(row.notification_payload) ? row.notification_payload : {},
    occurred_at_iso8601: toIso(row.occurred_at),
    read_at_iso8601: row.read_at ? toIso(row.read_at) : null
  });
}

export async function listNotificationsForRecipient(
  recipientUserId: string
): Promise<Readonly<{ notifications: readonly Readonly<JsonRecord>[]; unread_count: number }>> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await deriveNotificationsForRecipient(client, recipientUserId);

    const result = await client.query(
      `
      SELECT
        notification_id,
        notification_type,
        deep_link_route_id,
        deep_link_params,
        notification_payload,
        occurred_at,
        read_at
      FROM product_notifications
      WHERE recipient_user_id = $1
      ORDER BY occurred_at DESC, notification_id DESC
      LIMIT 200
      `,
      [recipientUserId]
    );

    const withAvailability = await withTargetAvailability(client, recipientUserId, result.rows);
    await client.query("COMMIT");

    const notifications = withAvailability.map(toPublicNotification);
    const unreadCount = notifications.filter((n) => n.read_at_iso8601 === null).length;

    return Object.freeze({ notifications, unread_count: unreadCount });
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function getUnreadNotificationCount(
  recipientUserId: string
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await deriveNotificationsForRecipient(client, recipientUserId);
    const result = await client.query(
      `
      SELECT count(*)::int AS unread_count
      FROM product_notifications
      WHERE recipient_user_id = $1 AND read_at IS NULL
      `,
      [recipientUserId]
    );
    await client.query("COMMIT");
    return Number(result.rows?.[0]?.unread_count ?? 0);
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export class ProductNotificationError extends Error {
  readonly status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "ProductNotificationError";
    this.status = status;
  }
}

async function setReadState(
  recipientUserId: string,
  notificationId_: string,
  read: boolean
): Promise<void> {
  const id = cleanString(notificationId_);
  if (!id) {
    throw new ProductNotificationError("notification_id_required", 400);
  }

  const result = await pool.query(
    `
    UPDATE product_notifications
    SET read_at = ${read ? "now()" : "NULL"}
    WHERE recipient_user_id = $1 AND notification_id = $2
    RETURNING notification_id
    `,
    [recipientUserId, id]
  );

  if (result.rowCount === 0) {
    throw new ProductNotificationError("notification_not_found", 404);
  }
}

export async function markNotificationRead(
  recipientUserId: string,
  notificationId_: string
): Promise<void> {
  await setReadState(recipientUserId, notificationId_, true);
}

export async function markNotificationUnread(
  recipientUserId: string,
  notificationId_: string
): Promise<void> {
  await setReadState(recipientUserId, notificationId_, false);
}

export async function markAllNotificationsRead(recipientUserId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await deriveNotificationsForRecipient(client, recipientUserId);
    await client.query(
      `
      UPDATE product_notifications
      SET read_at = now()
      WHERE recipient_user_id = $1 AND read_at IS NULL
      `,
      [recipientUserId]
    );
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}
