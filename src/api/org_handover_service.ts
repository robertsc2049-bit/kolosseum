// DEV NOTE: Taking over an organisation whose owner was erased
// (gdpr_erasure_service.ts eraseOrgOwnerData hands it to one of its active
// coaches). The coach does it from their own signed-in coach account - that
// is the proof it's them - by choosing a password for the organisation app:
// an org-owner account is created with their coach email and name, and the
// organisation moves to it, audited as org_ownership_handed_over. It is never
// claimed by email alone, because org-owner sign-up doesn't verify email.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { OrgOwnerAuthError, registerOrgOwnerAccount } from "./org_owner_account_service.js";

export class OrgHandoverError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgHandoverError";
    this.status = status;
  }
}

function canonicalJson(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.keys(input as Record<string, unknown>).sort().map((key) => [key, sortKeys((input as Record<string, unknown>)[key])]));
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
}

// Organisations handed to this coach and waiting for them to take over.
export async function listPendingOrgHandovers(coachUserId: string): Promise<readonly Readonly<{ org_id: string; org_name: string }>[]> {
  const result = await pool.query(
    `SELECT org_id, org_name FROM product_organisations WHERE handover_to_coach_user_id = $1 AND org_state <> 'closed' ORDER BY org_name, org_id`,
    [coachUserId]
  );
  return result.rows.map((row) => Object.freeze({ org_id: String(row.org_id), org_name: String(row.org_name) }));
}

export async function acceptOrgHandover(coachUserId: string, orgId: string, password: unknown): Promise<Readonly<{ org_id: string; org_name: string; org_owner_email: string }>> {
  const pending = await pool.query(
    `SELECT org_id, org_name, owner_user_id FROM product_organisations WHERE org_id = $1 AND handover_to_coach_user_id = $2 AND org_state <> 'closed'`,
    [orgId, coachUserId]
  );
  const org = pending.rows[0];
  if (!org) throw new OrgHandoverError("org_handover_not_found", 404);
  const coach = (await pool.query(
    `SELECT email_canonical, display_name FROM product_accounts WHERE user_id = $1 AND (actor_type = 'coach' OR additional_role = 'coach') AND account_state = 'active'`,
    [coachUserId]
  )).rows[0];
  if (!coach) throw new OrgHandoverError("org_handover_not_found", 404);

  let created: Readonly<{ user_id: string }>;
  try {
    created = await registerOrgOwnerAccount({ email: coach.email_canonical, display_name: coach.display_name, password });
  }
  catch (error) {
    if (error instanceof OrgOwnerAuthError) {
      // An org account already using this email may not be theirs (org
      // sign-up doesn't verify email), so it is never attached to it.
      throw new OrgHandoverError(error.message === "org_owner_email_already_registered" ? "org_handover_email_in_use" : error.message, error.message === "org_owner_email_already_registered" ? 409 : 400);
    }
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const moved = await client.query(
      `UPDATE product_organisations SET owner_user_id = $3, handover_to_coach_user_id = NULL WHERE org_id = $1 AND handover_to_coach_user_id = $2 RETURNING org_id`,
      [orgId, coachUserId, created.user_id]
    );
    if (!moved.rowCount) throw new OrgHandoverError("org_handover_not_found", 404);
    const audit = {
      org_id: orgId,
      action_type: "org_ownership_handed_over",
      actor_role: "coach",
      before_state: { owner_user_id: String(org.owner_user_id) },
      after_state: { owner_user_id: created.user_id, taken_over_by_coach_user_id: coachUserId },
      correlation_id: `org_handover_${crypto.randomUUID()}`
    };
    await client.query(
      `
      INSERT INTO product_org_audit_records (
        audit_record_id, org_id, actor_user_id, actor_role, action_type,
        before_state, after_state, correlation_id, record_sha256
      )
      VALUES ($1,$2,$3,'coach','org_ownership_handed_over',$4::jsonb,$5::jsonb,$6,$7)
      `,
      [
        `org_audit_${crypto.randomUUID().replace(/-/gu, "")}`,
        orgId,
        coachUserId,
        JSON.stringify(audit.before_state),
        JSON.stringify(audit.after_state),
        audit.correlation_id,
        crypto.createHash("sha256").update(canonicalJson(audit), "utf8").digest("hex")
      ]
    );
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    // Nothing was handed over - don't leave an org account behind for it.
    await pool.query(`DELETE FROM product_org_owner_accounts WHERE user_id = $1 AND NOT EXISTS (SELECT 1 FROM product_organisations WHERE owner_user_id = $1)`, [created.user_id]).catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
  return Object.freeze({ org_id: orgId, org_name: String(org.org_name), org_owner_email: String(coach.email_canonical) });
}
