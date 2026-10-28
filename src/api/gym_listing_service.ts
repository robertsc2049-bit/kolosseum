// DEV NOTE: A gym's free listing. The owner of a gym ('individual')
// organisation lists its name, area and equipment; a platform admin approves
// it before athletes can find it; athletes choose it as one of their gyms
// (athlete_equipment_service.ts), and their main gym's equipment counts as
// theirs. The gym only ever sees how many athletes chose it - and below 3,
// not even the number - never who (the same line as the org's analysis,
// which shows averages for groups of 3 or more).
import { pool } from "../db/pool.js";
import { equipmentOptions, GYMS_EVENT } from "./athlete_equipment_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

const STATUSES = ["pending", "approved", "rejected", "hidden"] as const;
const DECISIONS: Record<string, (typeof STATUSES)[number]> = { approve: "approved", reject: "rejected", hide: "hidden" };
const SMALLEST_COUNT = 3;

export class GymListingError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "GymListingError";
  }
}

function listingOut(row: Json): Json {
  return {
    org_id: String(row.org_id),
    display_name: text(row.display_name),
    area: text(row.area),
    equipment: Array.isArray(row.equipment) ? row.equipment.map(String) : [],
    listing_status: text(row.listing_status),
    review_note: text(row.review_note) || null,
    reviewed_at: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null,
    updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null
  };
}

// How many athletes have this gym among their current gyms.
async function athleteCount(orgId: string): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS n FROM (
       SELECT DISTINCT ON (user_id) event_payload FROM product_account_events
       WHERE event_type = $1 ORDER BY user_id, occurred_at DESC, event_id DESC
     ) latest WHERE latest.event_payload -> 'gym_org_ids' ? $2`,
    [GYMS_EVENT, orgId]
  );
  return Number(result.rows[0]?.n ?? 0);
}

async function ownedGym(ownerUserId: string, orgId: string): Promise<void> {
  const org = await pool.query("SELECT owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1", [orgId]);
  if (!org.rows.length) throw new GymListingError("gym_listing_organisation_not_found", 404);
  if (String(org.rows[0].owner_user_id) !== ownerUserId) throw new GymListingError("gym_listing_access_denied", 403);
  if (String(org.rows[0].visibility_mode) !== "individual") throw new GymListingError("gym_listing_gyms_only", 409);
}

// The owner's view: their listing (or null), the equipment they can list, and
// how many athletes chose the gym ("fewer than 3" below 3).
export async function getGymListing(ownerUserId: string, orgId: string): Promise<Json> {
  await ownedGym(ownerUserId, orgId);
  const result = await pool.query("SELECT * FROM product_gym_listings WHERE org_id = $1", [orgId]);
  const count = await athleteCount(orgId);
  return {
    ok: true,
    listing: result.rows.length ? listingOut(result.rows[0]) : null,
    athlete_count: count >= SMALLEST_COUNT ? count : null,
    athletes_label: count >= SMALLEST_COUNT ? `${count} athletes chose this gym` : "Fewer than 3 athletes chose this gym",
    options: equipmentOptions()
  };
}

// The owner saves { display_name, area, equipment }. A new listing waits for
// an admin; so does one an admin turned down. An approved listing stays
// listed when it's edited; a hidden one stays hidden.
export async function saveGymListing(ownerUserId: string, orgId: string, input: unknown): Promise<Json> {
  await ownedGym(ownerUserId, orgId);
  if (!isRecord(input)) throw new GymListingError("gym_listing_invalid", 422);
  const errors: Json = {};
  for (const key of Object.keys(input)) if (!["display_name", "area", "equipment"].includes(key)) errors[key] = "Not part of a gym listing.";
  const name = text(input.display_name);
  const area = text(input.area);
  if (!name || name.length > 120) errors.display_name = "Give the gym's name (up to 120 characters).";
  if (!area || area.length > 120) errors.area = "Give the town or area (up to 120 characters).";
  const known = new Set(equipmentOptions().map((option) => option.equipment_id));
  const equipment = Array.isArray(input.equipment) ? [...new Set(input.equipment.map(String))] : null;
  if (!equipment) errors.equipment = "Choose the gym's equipment.";
  else if (equipment.some((id) => !known.has(id))) errors.equipment = `Unknown equipment: ${equipment.filter((id) => !known.has(id)).join(", ")}.`;
  if (Object.keys(errors).length) throw new GymListingError("gym_listing_invalid", 422, errors);
  await pool.query(
    `INSERT INTO product_gym_listings (org_id, display_name, area, equipment)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (org_id) DO UPDATE SET
       display_name = EXCLUDED.display_name, area = EXCLUDED.area, equipment = EXCLUDED.equipment,
       listing_status = CASE WHEN product_gym_listings.listing_status = 'rejected' THEN 'pending' ELSE product_gym_listings.listing_status END,
       updated_at = now()`,
    [orgId, name, area, JSON.stringify(equipment)]
  );
  return getGymListing(ownerUserId, orgId);
}

// The admin's queue: listings by status (pending first by default).
export async function listGymListingsForAdmin(status: unknown): Promise<Json[]> {
  const wanted = text(status);
  if (wanted && !(STATUSES as readonly string[]).includes(wanted)) throw new GymListingError("gym_listing_status_invalid", 422);
  const result = await pool.query(
    `SELECT l.*, o.org_name, o.org_state, a.email_canonical AS owner_email
     FROM product_gym_listings l
     JOIN product_organisations o ON o.org_id = l.org_id
     LEFT JOIN product_org_owner_accounts a ON a.user_id = o.owner_user_id
     WHERE ($1 = '' OR l.listing_status = $1)
     ORDER BY (l.listing_status = 'pending') DESC, l.updated_at DESC LIMIT 200`,
    [wanted]
  );
  return result.rows.map((row) => ({ ...listingOut(row), org_name: text(row.org_name), org_state: text(row.org_state), owner_email: text(row.owner_email) || null }));
}

// The admin approves, turns down or hides a listing, with an optional note
// the owner sees.
export async function reviewGymListing(adminUserId: string, orgId: string, input: unknown): Promise<Json> {
  const body = isRecord(input) ? input : {};
  const status = DECISIONS[text(body.decision)];
  if (!status) throw new GymListingError("gym_listing_decision_invalid", 422, { decision: "Approve, reject or hide." });
  const note = text(body.note);
  if (note.length > 500) throw new GymListingError("gym_listing_decision_invalid", 422, { note: "Up to 500 characters." });
  const result = await pool.query(
    `UPDATE product_gym_listings SET listing_status = $2, review_note = $3, reviewed_by_user_id = $4, reviewed_at = now(), updated_at = now()
     WHERE org_id = $1 RETURNING *`,
    [orgId, status, note || null, adminUserId]
  );
  if (!result.rows.length) throw new GymListingError("gym_listing_not_found", 404);
  return listingOut(result.rows[0]);
}

// Athletes search approved listings of active gyms by name or area.
export async function searchGyms(query: unknown): Promise<Json[]> {
  const q = text(query).slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`;
  const result = await pool.query(
    `SELECT l.org_id, l.display_name, l.area, jsonb_array_length(l.equipment) AS equipment_count
     FROM product_gym_listings l JOIN product_organisations o ON o.org_id = l.org_id
     WHERE l.listing_status = 'approved' AND o.org_state = 'active'
       AND (l.display_name ILIKE $1 OR l.area ILIKE $1)
     ORDER BY l.display_name LIMIT 20`,
    [like]
  );
  return result.rows.map((row) => ({ org_id: String(row.org_id), display_name: text(row.display_name), area: text(row.area), equipment_count: Number(row.equipment_count) }));
}
