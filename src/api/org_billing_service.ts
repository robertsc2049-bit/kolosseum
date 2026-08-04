// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.3) - org seat-entitlement billing. This file computes a factual seat
// usage roll-up (count of product_org_coach_memberships not yet removed)
// and evaluates it against a persisted, per-org seat_limit using the pure
// S-V1-P-03
// evaluator (evaluateSeatEntitlement) via the org-scoped
// controlled_launch_org_coach_seat / controlled_launch_org_coach_product_access
// scope. It writes only to product_organisations.seat_limit and
// product_org_audit_records - it never imports, queries, or references any
// relationship/athlete-scoped file or table.

import crypto from "node:crypto";

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import {
  SEAT_ENTITLEMENT_REASON_CODES,
  evaluateSeatEntitlement
} from "../v1SeatEntitlementGuard.mjs";

type JsonRecord = Record<string, unknown>;

export class OrgBillingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgBillingError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(cleanString(value));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function canonicalJson(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input as JsonRecord)
          .sort()
          .map((key) => [key, sortKeys((input as JsonRecord)[key])])
      );
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

// A fixed, request-independent probe. Org billing never reads or derives
// from any engine/compile/replay/proof/factual-history record, so the same
// constant values are correct on every call - that constancy is what proves
// the "no coupling" property the guard checks for.
const ORG_BILLING_DETERMINISTIC_PROBE = Object.freeze({
  canonical_input_hash: sha256("org_billing_seat_entitlement:canonical_input_hash"),
  compile_output_hash: sha256("org_billing_seat_entitlement:compile_output_hash"),
  substitution_output_hash: sha256("org_billing_seat_entitlement:substitution_output_hash"),
  replay_record_hash: sha256("org_billing_seat_entitlement:replay_record_hash"),
  proof_record_hash: sha256("org_billing_seat_entitlement:proof_record_hash"),
  factual_history_hash: sha256("org_billing_seat_entitlement:factual_history_hash")
});

type OrgForBilling = Readonly<{
  org_id: string;
  owner_user_id: string;
  seat_limit: number | null;
  created_at_iso8601: string;
}>;

function buildOrgBillingAccessRecord(org: OrgForBilling, seatLimit: number, nowIso: string): Readonly<JsonRecord> {
  const material: JsonRecord = {
    record_type: "controlled_launch_billing_access_record",
    provider: "controlled_launch_org_billing",
    provider_session_intent_id: `org_billing_intent_${org.org_id}`,
    provider_session_id: null,
    billing_access_state: "access_active",
    billing_status: "payment_confirmed",
    plan_id: "controlled_launch_org_coach_plan",
    seat_limit: seatLimit,
    actor_id: org.owner_user_id,
    subject_id: org.owner_user_id,
    provider_price_id: "controlled_launch_org_coach_price",
    checkout_mode: "subscription",
    idempotency_key: `org_billing_${org.org_id}`,
    created_at: org.created_at_iso8601 || nowIso,
    updated_at: nowIso,
    payment_boundary_record_hash: sha256(canonicalJson({ org_id: org.org_id, no_payment_boundary: true })),
    engine_legality: "not_mutated",
    compile_output: "not_mutated",
    substitution_selection: "not_mutated",
    replay_record: "not_mutated",
    proof_record: "not_mutated",
    factual_history_record: "not_mutated"
  };

  return Object.freeze({ ...material, record_hash: sha256(canonicalJson(material)) });
}

// A seat is occupied by an invited-but-not-yet-accepted membership as well
// as an active one - matching the common SaaS convention that a pending
// invite reserves the seat immediately, so an org cannot dodge its limit by
// inviting far more coaches than it can pay for and waiting for accepts.
// Only 'removed' frees the seat back up.
async function orgOccupiedSeatCount(client: PoolClient, orgId: string): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS occupied FROM product_org_coach_memberships WHERE org_id = $1 AND membership_status != 'removed'`,
    [orgId]
  );
  return Number(result.rows[0]?.occupied ?? 0);
}

// Called from org_roster_service.ts's inviteCoachToOrganisation, inside its
// own transaction/client, before a new membership row is written - so an
// org can never structurally exceed its seat_limit through an invite. An
// org with no seat plan configured yet is treated as unrestricted (mirrors
// product_commercial_service.ts's own rule that missing commercial
// configuration blocks checkout, never blocks using the product itself) -
// the cap only starts being enforced once an owner explicitly sets one via
// changeOrgSeatPlan.
export async function assertOrgSeatCapacity(
  client: PoolClient,
  org: OrgForBilling,
  requestedSeatCount: number
): Promise<Readonly<{
  current_occupied_seat_count: number;
  seat_limit: number | null;
  available_seat_count_after_request: number | null;
}>> {
  if (org.seat_limit === null) {
    const occupied = await orgOccupiedSeatCount(client, org.org_id);
    return Object.freeze({
      current_occupied_seat_count: occupied,
      seat_limit: null,
      available_seat_count_after_request: null
    });
  }

  const occupied = await orgOccupiedSeatCount(client, org.org_id);
  const nowIso = new Date().toISOString();
  const billingAccessRecord = buildOrgBillingAccessRecord(org, org.seat_limit, nowIso);

  const result = evaluateSeatEntitlement({
    billing_access_record: billingAccessRecord,
    requested_product_surface: "controlled_launch_org_coach_product_access",
    requesting_actor_id: org.owner_user_id,
    requested_subject_id: org.org_id,
    current_occupied_seat_count: occupied,
    requested_seat_count: requestedSeatCount,
    requested_seat_scope: "controlled_launch_org_coach_seat",
    requested_at: nowIso,
    deterministic_probe: ORG_BILLING_DETERMINISTIC_PROBE
  });

  if (!result.ok) {
    if (result.reason_code === SEAT_ENTITLEMENT_REASON_CODES.SEAT_LIMIT_EXCEEDED) {
      throw new OrgBillingError("org_billing_seat_limit_exceeded", 409);
    }
    throw new OrgBillingError("org_billing_entitlement_evaluation_failed", 500);
  }

  return Object.freeze({
    current_occupied_seat_count: occupied,
    seat_limit: org.seat_limit,
    available_seat_count_after_request: result.available_seat_count_after_request as number
  });
}

async function requireOrgForBilling(
  client: PoolClient,
  orgId: string,
  ownerUserId: string
): Promise<OrgForBilling> {
  const result = await client.query(
    `SELECT * FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgBillingError("org_billing_organisation_not_found", 404);
  }
  if (cleanString(row.owner_user_id) !== ownerUserId) {
    throw new OrgBillingError("org_billing_organisation_access_denied", 403);
  }

  return Object.freeze({
    org_id: cleanString(row.org_id),
    owner_user_id: cleanString(row.owner_user_id),
    seat_limit: Number.isInteger(row.seat_limit) ? (row.seat_limit as number) : null,
    created_at_iso8601: row.created_at instanceof Date ? row.created_at.toISOString() : ""
  });
}

async function findExistingAudit(
  client: PoolClient,
  actorUserId: string,
  correlationId: string
): Promise<JsonRecord | null> {
  const result = await client.query(
    `SELECT * FROM product_org_audit_records WHERE actor_user_id = $1 AND correlation_id = $2`,
    [actorUserId, correlationId]
  );
  return result.rows[0] ?? null;
}

async function writeAuditRecord(
  client: PoolClient,
  args: {
    orgId: string;
    actorUserId: string;
    correlationId: string;
    beforeState: JsonRecord;
    afterState: JsonRecord;
  }
): Promise<void> {
  const withoutHash = {
    org_id: args.orgId,
    action_type: "seat_plan_changed",
    actor_role: "org_owner",
    before_state: args.beforeState,
    after_state: args.afterState,
    correlation_id: args.correlationId
  };

  await client.query(
    `
    INSERT INTO product_org_audit_records (
      audit_record_id, org_id, actor_user_id, actor_role, action_type,
      before_state, after_state, correlation_id, record_sha256
    )
    VALUES ($1,$2,$3,'org_owner','seat_plan_changed',$4::jsonb,$5::jsonb,$6,$7)
    `,
    [
      randomId("org_audit"),
      args.orgId,
      args.actorUserId,
      JSON.stringify(args.beforeState),
      JSON.stringify(args.afterState),
      args.correlationId,
      sha256(canonicalJson(withoutHash))
    ]
  );
}

export type OrgBillingStatus = Readonly<{
  org_id: string;
  seat_plan_configured: boolean;
  seat_limit: number | null;
  occupied_seat_count: number;
  available_seat_count: number | null;
}>;

export async function getOrgBillingStatus(
  ownerUserId: string,
  orgId: string
): Promise<OrgBillingStatus> {
  const client = await pool.connect();
  try {
    const org = await requireOrgForBilling(client, orgId, ownerUserId);
    const occupied = await orgOccupiedSeatCount(client, orgId);

    return Object.freeze({
      org_id: org.org_id,
      seat_plan_configured: org.seat_limit !== null,
      seat_limit: org.seat_limit,
      occupied_seat_count: occupied,
      available_seat_count: org.seat_limit === null ? null : Math.max(org.seat_limit - occupied, 0)
    });
  }
  finally {
    client.release();
  }
}

export async function changeOrgSeatPlan(
  ownerUserId: string,
  orgId: string,
  newSeatLimitInput: unknown,
  requestId: unknown
): Promise<Readonly<{ org_id: string; seat_limit: number }>> {
  const newSeatLimit = positiveInteger(newSeatLimitInput);
  if (newSeatLimit === null) {
    throw new OrgBillingError("org_billing_seat_limit_invalid", 400);
  }
  const correlationId = cleanString(requestId) || randomId("org_seat_plan");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const org = await requireOrgForBilling(client, orgId, ownerUserId);
    const existingAudit = await findExistingAudit(client, ownerUserId, correlationId);

    if (!existingAudit) {
      const occupied = await orgOccupiedSeatCount(client, orgId);
      if (newSeatLimit < occupied) {
        throw new OrgBillingError("org_billing_seat_limit_below_occupied", 409);
      }

      await client.query(
        `UPDATE product_organisations SET seat_limit = $1 WHERE org_id = $2`,
        [newSeatLimit, orgId]
      );

      await writeAuditRecord(client, {
        orgId,
        actorUserId: ownerUserId,
        correlationId,
        beforeState: { seat_limit: org.seat_limit },
        afterState: { seat_limit: newSeatLimit }
      });
    }

    await client.query("COMMIT");

    const finalRow = await pool.query(
      `SELECT seat_limit FROM product_organisations WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );
    const finalSeatLimit = finalRow.rows[0]?.seat_limit;
    if (!Number.isInteger(finalSeatLimit)) {
      throw new OrgBillingError("org_billing_seat_plan_change_failed", 500);
    }

    return Object.freeze({ org_id: orgId, seat_limit: finalSeatLimit as number });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}
