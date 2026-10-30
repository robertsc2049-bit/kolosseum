// DEV NOTE: Finding a coach by gym or by their share link. An athlete sees the coaches a gym has
// confirmed (coach_gym_service.ts) and asks one to coach them; the coach sees
// the request - the athlete's name and email, the gym, and a short note - and
// invites them through the usual invitation (relationship_invitation_service
// .ts), or dismisses it. Nothing about the athlete reaches the coach until
// the athlete asks.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { coachBusinessName } from "./coach_branding_service.js";
import { coachUserIdForLink } from "./coach_share_link_service.js";
import { createRelationshipInvitationByEmail } from "./relationship_invitation_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export class CoachingRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "CoachingRequestError";
  }
}

// The coaches each gym has confirmed - name and business name - and whether
// this athlete has already asked them.
export async function coachesAtGyms(athleteUserId: string, orgIds: string[]): Promise<Map<string, Json[]>> {
  const out = new Map<string, Json[]>();
  if (!orgIds.length) return out;
  const result = await pool.query(
    `SELECT g.coach_gym_id, g.org_id, g.coach_user_id, a.display_name,
            EXISTS (SELECT 1 FROM product_coaching_requests r
                    WHERE r.athlete_user_id = $2 AND r.coach_user_id = g.coach_user_id AND r.request_status = 'pending') AS asked
     FROM product_coach_gyms g JOIN product_accounts a ON a.user_id = g.coach_user_id
     WHERE g.org_id = ANY($1::text[]) AND g.link_status = 'confirmed' AND a.account_state = 'active'
       AND g.coach_user_id <> $2
     ORDER BY a.display_name, g.coach_gym_id`,
    [orgIds, athleteUserId]
  );
  for (const row of result.rows) {
    const orgId = String(row.org_id);
    const list = out.get(orgId) ?? [];
    list.push({
      coach_gym_id: String(row.coach_gym_id),
      display_name: text(row.display_name) || "A coach",
      business_name: await coachBusinessName(String(row.coach_user_id)),
      asked: row.asked === true
    });
    out.set(orgId, list);
  }
  return out;
}

// Add each gym's confirmed coaches to a list of gyms ({ org_id, ... }).
export async function withGymCoaches(athleteUserId: string, gyms: unknown): Promise<Json[]> {
  const list = Array.isArray(gyms) ? (gyms as Json[]) : [];
  const coaches = await coachesAtGyms(athleteUserId, list.map((gym) => text(gym.org_id)).filter(Boolean));
  return list.map((gym) => ({ ...gym, coaches: coaches.get(text(gym.org_id)) ?? [] }));
}

// The athlete asks a coach to coach them, with an optional short note - a
// coach they found at a gym (coach_gym_id), or one whose share link they
// followed (coach_link, coach_share_link_service.ts).
export async function requestCoaching(athleteUserId: string, input: unknown): Promise<Json> {
  if (!isRecord(input)) throw new CoachingRequestError("coaching_request_invalid", 422);
  const note = text(input.note);
  if (note.length > 300) throw new CoachingRequestError("coaching_request_invalid", 422, { note: "Up to 300 characters." });
  let coachUserId: string | null = null;
  let orgId: string | null = null;
  const source = text(input.coach_link) ? "share_link" : "gym";
  if (source === "share_link") {
    coachUserId = await coachUserIdForLink(input.coach_link);
  }
  else {
    const gym = await pool.query(
      `SELECT g.coach_user_id, g.org_id FROM product_coach_gyms g JOIN product_accounts a ON a.user_id = g.coach_user_id
       WHERE g.coach_gym_id = $1 AND g.link_status = 'confirmed' AND a.account_state = 'active'`,
      [text(input.coach_gym_id)]
    );
    if (gym.rows.length) {
      coachUserId = String(gym.rows[0].coach_user_id);
      orgId = String(gym.rows[0].org_id);
    }
  }
  if (!coachUserId) throw new CoachingRequestError("coaching_request_coach_not_found", 404);
  if (coachUserId === athleteUserId) throw new CoachingRequestError("coaching_request_self_not_allowed", 409);
  const relationship = await pool.query(
    `SELECT record_payload->>'relationship_state' AS state FROM beta_product_records
     WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = $1 AND subject_user_id = $2
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [coachUserId, athleteUserId]
  );
  if (text(relationship.rows[0]?.state) === "accepted") throw new CoachingRequestError("coaching_request_already_coached", 409);
  const inserted = await pool.query(
    `INSERT INTO product_coaching_requests (request_id, athlete_user_id, coach_user_id, org_id, source, note, request_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT DO NOTHING RETURNING request_id`,
    [`creq_${crypto.randomUUID().replaceAll("-", "")}`, athleteUserId, coachUserId, orgId, source, note || null]
  );
  if (!inserted.rows.length) throw new CoachingRequestError("coaching_request_already_sent", 409);
  return { ok: true, request_id: String(inserted.rows[0].request_id) };
}

// The coach's open requests: who asked, at which gym, and their note.
export async function listCoachingRequests(coachUserId: string): Promise<Json> {
  const result = await pool.query(
    `SELECT r.request_id, r.source, r.note, r.created_at, a.display_name, a.email_canonical,
            COALESCE(l.display_name, o.org_name) AS gym_name
     FROM product_coaching_requests r
     JOIN product_accounts a ON a.user_id = r.athlete_user_id
     LEFT JOIN product_organisations o ON o.org_id = r.org_id
     LEFT JOIN product_gym_listings l ON l.org_id = r.org_id
     WHERE r.coach_user_id = $1 AND r.request_status = 'pending'
     ORDER BY r.created_at DESC`,
    [coachUserId]
  );
  return {
    ok: true,
    requests: result.rows.map((row) => ({
      request_id: String(row.request_id),
      athlete_display_name: text(row.display_name) || "An athlete",
      athlete_email: text(row.email_canonical),
      gym_name: text(row.gym_name) || null,
      via_share_link: row.source === "share_link",
      note: text(row.note) || null,
      requested_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null
    }))
  };
}

// The coach invites the athlete who asked (the usual invitation, which the
// athlete accepts), or dismisses the request.
export async function decideCoachingRequest(coachUserId: string, requestId: string, input: unknown): Promise<Json> {
  const decision = text(isRecord(input) ? input.decision : "");
  if (decision !== "invite" && decision !== "dismiss") {
    throw new CoachingRequestError("coaching_request_decision_invalid", 422, { decision: "Invite or dismiss." });
  }
  const row = await pool.query(
    `SELECT r.athlete_user_id, a.email_canonical FROM product_coaching_requests r JOIN product_accounts a ON a.user_id = r.athlete_user_id
     WHERE r.request_id = $1 AND r.coach_user_id = $2 AND r.request_status = 'pending'`,
    [requestId, coachUserId]
  );
  if (!row.rows.length) throw new CoachingRequestError("coaching_request_not_found", 404);
  if (decision === "invite") await createRelationshipInvitationByEmail(coachUserId, text(row.rows[0].email_canonical));
  await pool.query(
    `UPDATE product_coaching_requests SET request_status = $3, decided_at = now() WHERE request_id = $1 AND coach_user_id = $2`,
    [requestId, coachUserId, decision === "invite" ? "invited" : "dismissed"]
  );
  return listCoachingRequests(coachUserId);
}
