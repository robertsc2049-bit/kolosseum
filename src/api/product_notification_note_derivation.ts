// DEV NOTE: P152 boundary. Kept as its own narrow module, separate from
// product_notification_service.ts, so this concern never sits in the same
// file as a direct import of any engine/session truth-reading or
// truth-writing service. Mirrors the isolation pattern already used for
// the athlete-visible advisory read (athlete_today_notes_service.ts) and
// the write side (beta17_coach_note_write.routes.ts).

import { pool } from "../db/pool.js";
import { insertDerivedNotification } from "./product_notification_service.js";

type JsonRecord = Record<string, unknown>;
type QueryClient = { query: (typeof pool)["query"] };

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const asString = cleanString(value);
  return asString || new Date(0).toISOString();
}

export async function deriveAthleteVisibleNoteNotifications(
  client: QueryClient,
  recipientUserId: string,
  deepLinkRouteId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT note_id, coach_user_id, session_id, created_at
    FROM product_coach_notes
    WHERE athlete_user_id = $1
      AND visibility = 'athlete_visible'
    `,
    [recipientUserId]
  );

  for (const row of result.rows as JsonRecord[]) {
    await insertDerivedNotification(client, {
      recipientUserId,
      notificationType: "coach_note_visible",
      sourceRecordType: "product_coach_notes",
      sourceRecordId: cleanString(row.note_id),
      deepLinkRouteId,
      notificationPayload: {
        coach_user_id: cleanString(row.coach_user_id),
        session_id: cleanString(row.session_id)
      },
      occurredAtIso8601: toIso(row.created_at)
    });
  }
}
