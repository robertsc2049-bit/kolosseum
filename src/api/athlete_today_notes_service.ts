// DEV NOTE: FULL-UI-14C advisory-message read boundary.
// Kept as its own narrow module, separate from athlete_today_service.ts,
// so this concern never sits in the same file as a direct import of any
// engine/session truth-reading service - it only ever queries its own
// dedicated storage table and never anything that could feed back into
// which exercise, load, order, or session is presented as current.

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

// Only ever returns message text and metadata, never anything capable of
// changing an exercise, load, order, or session selection. Only messages
// the coach explicitly marked visible to the athlete are returned - the
// coach-private ones are never reachable from this query.
export async function loadAthleteVisibleAdvisoryMessages(
  coachUserId: string,
  athleteUserId: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT note_id, note_text, created_at
    FROM product_coach_notes
    WHERE
      coach_user_id = $1
      AND athlete_user_id = $2
      AND visibility = 'athlete_visible'
    ORDER BY created_at DESC, note_id DESC
    LIMIT 50
    `,
    [coachUserId, athleteUserId]
  );

  return deepFreeze(
    result.rows.map((row) =>
      deepFreeze({
        note_id: cleanString(row.note_id),
        note_text: cleanString(row.note_text),
        created_at_iso8601: new Date(row.created_at).toISOString(),
        non_binding: true
      })
    )
  );
}
