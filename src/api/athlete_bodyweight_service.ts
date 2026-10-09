// DEV NOTE: The athlete's current bodyweight (kg) for counting it into the
// load of bodyweight exercises (bodyweight_load.ts): the coach's strength
// profile, else the latest bodyweight the athlete logged.

import { pool } from "../db/pool.js";
import { latestBodyweightKg } from "./bodyweight_load.js";
import { listBodyMetricHistoryForAthlete } from "./body_metrics_service.js";

export async function getAthleteBodyweightKg(athleteUserId: string): Promise<number | null> {
  const profile = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE subject_user_id = $1 AND record_type = 'beta19_athlete_strength_profile'
     ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC LIMIT 1`,
    [athleteUserId]
  );
  const payload = profile.rows?.[0]?.record_payload;
  const fromProfile = latestBodyweightKg(payload && typeof payload === "object" ? payload : null, []);
  if (fromProfile !== null) return fromProfile;
  const entries = await listBodyMetricHistoryForAthlete(athleteUserId).catch(() => []);
  return latestBodyweightKg(null, entries as Record<string, unknown>[]);
}
