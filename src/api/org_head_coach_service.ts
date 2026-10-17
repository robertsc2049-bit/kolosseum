// DEV NOTE: The organisation's head coach - one active coach the owner
// names (an owner who also coaches names their own coach account, which
// joined the organisation from its own signed-in coach session; org-owner
// sign-up doesn't verify email, so the two are never linked by email).
// What it grants is decided where it's read: a team ('shared') org's head
// coach can open any of the team's athletes in full (team_analysis_service.
// ts); a gym ('individual') org's head coach sees the organisation's
// analysis on the owner's terms - averages for groups of 3 or more, never an
// athlete (org_progress_rollup_service.ts). It only counts while they're an
// active member. This file never reads athlete data.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { writeAuditRecord } from "./org_roster_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export class OrgHeadCoachError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgHeadCoachError";
    this.status = status;
  }
}

async function activeCoachIds(orgId: string): Promise<string[]> {
  const result = await pool.query("SELECT coach_user_id FROM product_org_coach_memberships WHERE org_id = $1 AND membership_status = 'active'", [orgId]);
  return result.rows.map((row) => String(row.coach_user_id));
}

// The owner names a head coach (an active member), or clears it (null).
export async function setHeadCoach(ownerUserId: string, orgId: string, input: unknown): Promise<Json> {
  const body = input && typeof input === "object" ? (input as Json) : {};
  const coachUserId = text(body.coach_user_id) || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const org = await client.query("SELECT owner_user_id, head_coach_user_id FROM product_organisations WHERE org_id = $1 FOR UPDATE", [orgId]);
    if (!org.rows.length) throw new OrgHeadCoachError("org_head_coach_organisation_not_found", 404);
    if (String(org.rows[0].owner_user_id) !== ownerUserId) throw new OrgHeadCoachError("org_head_coach_access_denied", 403);
    if (coachUserId && !(await activeCoachIds(orgId)).includes(coachUserId)) throw new OrgHeadCoachError("org_head_coach_not_an_active_coach", 409);
    const before = text(org.rows[0].head_coach_user_id) || null;
    if (before !== coachUserId) {
      await client.query("UPDATE product_organisations SET head_coach_user_id = $2, updated_at = now() WHERE org_id = $1", [orgId, coachUserId]);
      await writeAuditRecord(client, {
        orgId, actorUserId: ownerUserId, actorRole: "org_owner", correlationId: `head_coach_${crypto.randomUUID()}`,
        actionType: coachUserId ? "head_coach_designated" : "head_coach_cleared",
        beforeState: { head_coach_user_id: before }, afterState: { head_coach_user_id: coachUserId }
      });
    }
    await client.query("COMMIT");
    return { ok: true, org_id: orgId, head_coach_user_id: coachUserId };
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}

// The organisations this coach is currently head coach of (active member only).
export async function headCoachOrgs(coachUserId: string): Promise<Array<{ org_id: string; org_name: string; visibility_mode: string; owner_user_id: string }>> {
  const result = await pool.query(
    `SELECT o.org_id, o.org_name, o.visibility_mode, o.owner_user_id FROM product_organisations o
     JOIN product_org_coach_memberships m ON m.org_id = o.org_id AND m.coach_user_id = $1 AND m.membership_status = 'active'
     WHERE o.head_coach_user_id = $1`,
    [coachUserId]
  );
  return result.rows.map((row) => ({ org_id: String(row.org_id), org_name: text(row.org_name), visibility_mode: text(row.visibility_mode), owner_user_id: String(row.owner_user_id) }));
}

export async function headCoachOf(orgId: string): Promise<string | null> {
  const result = await pool.query("SELECT head_coach_user_id FROM product_organisations WHERE org_id = $1", [orgId]);
  return text(result.rows[0]?.head_coach_user_id) || null;
}
