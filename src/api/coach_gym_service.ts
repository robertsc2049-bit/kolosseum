// DEV NOTE: The gyms a coach works out of. A coach picks a gym that's on
// Kolosseum (an approved gym listing, gym_listing_service.ts) - it waits for
// the gym to confirm before anyone else sees it - or types in one that isn't
// on Kolosseum yet. When that gym signs up and its listing is approved, the
// coach is shown it and links their entry in one tap (then the gym confirms).
// The gym sees which coaches linked to it - name and business name - and
// confirms, declines or removes them; athletes only ever stay a count there.
// A coach's athletes see the confirmed gyms and the typed-in ones.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { coachBusinessName } from "./coach_branding_service.js";
import { assertGymOwner } from "./gym_listing_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export const MAX_COACH_GYMS = 5;

export class CoachGymError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "CoachGymError";
  }
}

function gymOut(row: Json): Json {
  return {
    coach_gym_id: String(row.coach_gym_id),
    org_id: text(row.org_id) || null,
    gym_name: text(row.listing_name) || text(row.gym_name),
    area: text(row.listing_area) || text(row.area),
    link_status: text(row.link_status)
  };
}

// An approved listing of an active gym, or null.
async function listedGym(orgId: string): Promise<Json | null> {
  const result = await pool.query(
    `SELECT l.org_id, l.display_name, l.area FROM product_gym_listings l JOIN product_organisations o ON o.org_id = l.org_id
     WHERE l.org_id = $1 AND l.listing_status = 'approved' AND o.org_state = 'active'`,
    [orgId]
  );
  return result.rows[0] ?? null;
}

// The coach's gyms, and - for any they typed in - the gyms on Kolosseum with
// the same name they can now link it to.
export async function listCoachGyms(coachUserId: string): Promise<Json> {
  const gyms = await pool.query(
    `SELECT g.*, l.display_name AS listing_name, l.area AS listing_area
     FROM product_coach_gyms g LEFT JOIN product_gym_listings l ON l.org_id = g.org_id
     WHERE g.coach_user_id = $1 ORDER BY g.created_at, g.coach_gym_id`,
    [coachUserId]
  );
  const matches = await pool.query(
    `SELECT g.coach_gym_id, l.org_id, l.display_name, l.area
     FROM product_coach_gyms g
     JOIN product_gym_listings l ON lower(l.display_name) = lower(g.gym_name)
     JOIN product_organisations o ON o.org_id = l.org_id
     WHERE g.coach_user_id = $1 AND g.link_status = 'unlisted'
       AND l.listing_status = 'approved' AND o.org_state = 'active'
       AND NOT EXISTS (SELECT 1 FROM product_coach_gyms x WHERE x.coach_user_id = $1 AND x.org_id = l.org_id)
     ORDER BY l.display_name, l.area`,
    [coachUserId]
  );
  return {
    ok: true,
    max_gyms: MAX_COACH_GYMS,
    gyms: gyms.rows.map((row) => ({
      ...gymOut(row),
      now_on_kolosseum: matches.rows
        .filter((match) => String(match.coach_gym_id) === String(row.coach_gym_id))
        .map((match) => ({ org_id: String(match.org_id), display_name: text(match.display_name), area: text(match.area) }))
    }))
  };
}

// Add { org_id } - a gym on Kolosseum, waiting for it to confirm - or
// { gym_name, area } for one that isn't on Kolosseum yet.
export async function addCoachGym(coachUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachGymError("coach_gym_invalid", 422);
  const errors: Json = {};
  for (const key of Object.keys(input)) if (!["org_id", "gym_name", "area"].includes(key)) errors[key] = "Not part of a gym.";
  if (Object.keys(errors).length) throw new CoachGymError("coach_gym_invalid", 422, errors);
  const count = await pool.query("SELECT count(*)::int AS n FROM product_coach_gyms WHERE coach_user_id = $1", [coachUserId]);
  if (Number(count.rows[0]?.n ?? 0) >= MAX_COACH_GYMS) throw new CoachGymError("coach_gym_limit_reached", 409);

  const orgId = text(input.org_id);
  if (orgId) {
    const gym = await listedGym(orgId);
    if (!gym) throw new CoachGymError("coach_gym_not_found", 404);
    const inserted = await pool.query(
      `INSERT INTO product_coach_gyms (coach_gym_id, coach_user_id, org_id, gym_name, area, link_status)
       VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT DO NOTHING RETURNING coach_gym_id`,
      [`cgym_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, orgId, text(gym.display_name), text(gym.area)]
    );
    if (!inserted.rows.length) throw new CoachGymError("coach_gym_already_listed", 409);
    return listCoachGyms(coachUserId);
  }

  const name = text(input.gym_name);
  const area = text(input.area);
  if (!name || name.length > 120) errors.gym_name = "Give the gym's name (up to 120 characters).";
  if (area.length > 120) errors.area = "Up to 120 characters.";
  if (Object.keys(errors).length) throw new CoachGymError("coach_gym_invalid", 422, errors);
  const same = await pool.query(
    "SELECT 1 FROM product_coach_gyms WHERE coach_user_id = $1 AND org_id IS NULL AND lower(gym_name) = lower($2) AND lower(area) = lower($3)",
    [coachUserId, name, area]
  );
  if (same.rows.length) throw new CoachGymError("coach_gym_already_listed", 409);
  await pool.query(
    `INSERT INTO product_coach_gyms (coach_gym_id, coach_user_id, org_id, gym_name, area, link_status)
     VALUES ($1, $2, NULL, $3, $4, 'unlisted')`,
    [`cgym_${crypto.randomUUID().replaceAll("-", "")}`, coachUserId, name, area]
  );
  return listCoachGyms(coachUserId);
}

// Link a typed-in gym to the gym, now it's on Kolosseum; it waits for the
// gym to confirm.
export async function linkCoachGym(coachUserId: string, coachGymId: string, input: unknown): Promise<Json> {
  const orgId = text(isRecord(input) ? input.org_id : "");
  const row = await pool.query("SELECT link_status FROM product_coach_gyms WHERE coach_gym_id = $1 AND coach_user_id = $2", [coachGymId, coachUserId]);
  if (!row.rows.length) throw new CoachGymError("coach_gym_not_found", 404);
  if (text(row.rows[0].link_status) !== "unlisted") throw new CoachGymError("coach_gym_already_linked", 409);
  const gym = orgId ? await listedGym(orgId) : null;
  if (!gym) throw new CoachGymError("coach_gym_not_found", 404);
  const taken = await pool.query("SELECT 1 FROM product_coach_gyms WHERE coach_user_id = $1 AND org_id = $2", [coachUserId, orgId]);
  if (taken.rows.length) throw new CoachGymError("coach_gym_already_listed", 409);
  await pool.query(
    `UPDATE product_coach_gyms SET org_id = $3, gym_name = $4, area = $5, link_status = 'pending', decided_at = NULL, updated_at = now()
     WHERE coach_gym_id = $1 AND coach_user_id = $2`,
    [coachGymId, coachUserId, orgId, text(gym.display_name), text(gym.area)]
  );
  return listCoachGyms(coachUserId);
}

export async function removeCoachGym(coachUserId: string, coachGymId: string): Promise<Json> {
  const result = await pool.query("DELETE FROM product_coach_gyms WHERE coach_gym_id = $1 AND coach_user_id = $2", [coachGymId, coachUserId]);
  if (!result.rowCount) throw new CoachGymError("coach_gym_not_found", 404);
  return listCoachGyms(coachUserId);
}

// What a coach's athletes see: confirmed gyms, and the ones not on Kolosseum.
export async function coachGymsForAthletes(coachUserId: string): Promise<Json[]> {
  const result = await pool.query(
    `SELECT g.*, l.display_name AS listing_name, l.area AS listing_area
     FROM product_coach_gyms g LEFT JOIN product_gym_listings l ON l.org_id = g.org_id
     WHERE g.coach_user_id = $1 AND g.link_status IN ('confirmed', 'unlisted') ORDER BY g.created_at, g.coach_gym_id`,
    [coachUserId]
  );
  return result.rows.map((row) => {
    const gym = gymOut(row);
    return { gym_name: gym.gym_name, area: gym.area, on_kolosseum: gym.link_status === "confirmed" };
  });
}

// The gym owner's list: coaches waiting for them and coaches they've
// confirmed - name and business name.
export async function listGymCoaches(ownerUserId: string, orgId: string): Promise<Json> {
  await assertGymOwner(ownerUserId, orgId);
  const result = await pool.query(
    `SELECT g.coach_gym_id, g.coach_user_id, g.link_status, g.created_at, a.display_name
     FROM product_coach_gyms g LEFT JOIN product_accounts a ON a.user_id = g.coach_user_id
     WHERE g.org_id = $1 AND g.link_status IN ('pending', 'confirmed')
     ORDER BY (g.link_status = 'pending') DESC, g.created_at`,
    [orgId]
  );
  const coaches = await Promise.all(result.rows.map(async (row) => ({
    coach_gym_id: String(row.coach_gym_id),
    display_name: text(row.display_name) || "A coach",
    business_name: await coachBusinessName(String(row.coach_user_id)),
    link_status: text(row.link_status),
    requested_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null
  })));
  return { ok: true, coaches };
}

const DECISIONS: Record<string, { from: string; to: string }> = {
  confirm: { from: "pending", to: "confirmed" },
  decline: { from: "pending", to: "declined" },
  remove: { from: "confirmed", to: "declined" }
};

// The gym confirms or declines a coach who linked to it, or removes one it
// confirmed.
export async function decideGymCoach(ownerUserId: string, orgId: string, coachGymId: string, input: unknown): Promise<Json> {
  await assertGymOwner(ownerUserId, orgId);
  const decision = DECISIONS[text(isRecord(input) ? input.decision : "")];
  if (!decision) throw new CoachGymError("coach_gym_decision_invalid", 422, { decision: "Confirm, decline or remove." });
  const result = await pool.query(
    `UPDATE product_coach_gyms SET link_status = $4, decided_at = now(), updated_at = now()
     WHERE coach_gym_id = $1 AND org_id = $2 AND link_status = $3`,
    [coachGymId, orgId, decision.from, decision.to]
  );
  if (!result.rowCount) {
    const exists = await pool.query("SELECT 1 FROM product_coach_gyms WHERE coach_gym_id = $1 AND org_id = $2", [coachGymId, orgId]);
    throw new CoachGymError(exists.rows.length ? "coach_gym_decision_not_allowed" : "coach_gym_not_found", exists.rows.length ? 409 : 404);
  }
  return listGymCoaches(ownerUserId, orgId);
}
