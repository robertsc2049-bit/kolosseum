// DEV NOTE: Organisation/team billing commercial expansion (part B, slice
// B.2) - org roster management. An org owner invites an EXISTING coach
// account by email (never by typing the coach's internal user_id, mirroring
// the coach-athlete invitation pattern), and the coach accepts or leaves
// through their own authenticated session using only a membership_id their
// own list already supplied. This file writes only to
// product_organisations, product_org_coach_memberships, and
// product_org_audit_records - it never imports, queries, or references any
// relationship/athlete-scoped file or table (beta_product_records,
// relationship_invitation_service.ts, beta19_coach_workspace_service.ts,
// etc.). An org owner therefore has no schema or code path to any
// athlete-scoped data through this file.

import crypto from "node:crypto";

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { assertOrgSeatCapacity } from "./org_billing_service.js";

type JsonRecord = Record<string, unknown>;

export class OrgRosterError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgRosterError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new OrgRosterError("org_roster_coach_email_invalid", 400);
  }
  return email;
}

// Part C - declared once at creation, immutable afterward (see schema.sql).
// Omitted/empty defaults to the safe, privacy-preserving "individual" mode;
// any other non-empty value is rejected rather than silently coerced.
function cleanVisibilityMode(value: unknown): "individual" | "shared" {
  if (value === undefined || value === null || value === "") return "individual";
  if (value === "individual" || value === "shared") return value;
  throw new OrgRosterError("org_roster_visibility_mode_invalid", 400);
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

type AuditOutcome = Readonly<{
  audit_record_id: string;
  action_type: string;
  before_state: JsonRecord;
  after_state: JsonRecord;
  correlation_id: string;
  idempotent_replay: boolean;
}>;

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

function toAuditOutcome(row: JsonRecord, replayed: boolean): AuditOutcome {
  return Object.freeze({
    audit_record_id: cleanString(row.audit_record_id),
    action_type: cleanString(row.action_type),
    before_state: row.before_state as JsonRecord,
    after_state: row.after_state as JsonRecord,
    correlation_id: cleanString(row.correlation_id),
    idempotent_replay: replayed
  });
}

async function writeAuditRecord(
  client: PoolClient,
  args: {
    orgId: string;
    actorUserId: string;
    actorRole: "org_owner" | "coach";
    correlationId: string;
    actionType: string;
    beforeState: JsonRecord;
    afterState: JsonRecord;
  }
): Promise<AuditOutcome> {
  const withoutHash = {
    org_id: args.orgId,
    action_type: args.actionType,
    actor_role: args.actorRole,
    before_state: args.beforeState,
    after_state: args.afterState,
    correlation_id: args.correlationId
  };
  const recordSha256 = sha256(canonicalJson(withoutHash));
  const auditRecordId = randomId("org_audit");

  const inserted = await client.query(
    `
    INSERT INTO product_org_audit_records (
      audit_record_id, org_id, actor_user_id, actor_role, action_type,
      before_state, after_state, correlation_id, record_sha256
    )
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
    RETURNING *
    `,
    [
      auditRecordId,
      args.orgId,
      args.actorUserId,
      args.actorRole,
      args.actionType,
      JSON.stringify(args.beforeState),
      JSON.stringify(args.afterState),
      args.correlationId,
      recordSha256
    ]
  );

  return toAuditOutcome(inserted.rows[0], false);
}

async function withIdempotentAudit(
  client: PoolClient,
  args: {
    orgId: string;
    actorUserId: string;
    actorRole: "org_owner" | "coach";
    correlationId: string;
    actionType: string;
    beforeState: JsonRecord;
  },
  mutate: () => Promise<JsonRecord>
): Promise<AuditOutcome> {
  const existing = await findExistingAudit(client, args.actorUserId, args.correlationId);
  if (existing) {
    return toAuditOutcome(existing, true);
  }

  const afterState = await mutate();

  return writeAuditRecord(client, {
    orgId: args.orgId,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    correlationId: args.correlationId,
    actionType: args.actionType,
    beforeState: args.beforeState,
    afterState
  });
}

export type OrganisationRow = Readonly<{
  org_id: string;
  owner_user_id: string;
  org_name: string;
  org_state: "active" | "suspended" | "closed";
  seat_limit: number | null;
  visibility_mode: "individual" | "shared";
  created_at_iso8601: string;
}>;

function mapOrganisationRow(value: unknown): OrganisationRow | null {
  if (!isRecord(value)) return null;
  const state = value.org_state;
  if (state !== "active" && state !== "suspended" && state !== "closed") return null;

  return Object.freeze({
    org_id: cleanString(value.org_id),
    owner_user_id: cleanString(value.owner_user_id),
    org_name: cleanString(value.org_name),
    org_state: state,
    seat_limit: Number.isInteger(value.seat_limit) ? (value.seat_limit as number) : null,
    visibility_mode: value.visibility_mode === "shared" ? "shared" : "individual",
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : ""
  });
}

// Part B.3 - a new org is seeded with the same controlled-launch default
// used for single-coach billing, if configured. Owners change it afterwards
// only through the audited seat_plan_changed action in org_billing_service.ts.
function defaultSeatLimitFromEnv(): number | null {
  const raw = Number(process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export async function createOrganisation(
  ownerUserId: string,
  orgName: unknown,
  visibilityModeInput?: unknown
): Promise<Readonly<{ organisation: OrganisationRow }>> {
  const cleanOrgName = cleanString(orgName);
  if (!cleanOrgName) {
    throw new OrgRosterError("org_roster_org_name_required", 400);
  }
  const visibilityMode = cleanVisibilityMode(visibilityModeInput);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orgId = randomId("org");
    const inserted = await client.query(
      `
      INSERT INTO product_organisations (org_id, owner_user_id, org_name, seat_limit, visibility_mode)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [orgId, ownerUserId, cleanOrgName, defaultSeatLimitFromEnv(), visibilityMode]
    );

    await writeAuditRecord(client, {
      orgId,
      actorUserId: ownerUserId,
      actorRole: "org_owner",
      correlationId: orgId,
      actionType: "org_created",
      beforeState: {},
      afterState: { org_id: orgId, org_name: cleanOrgName }
    });

    await client.query("COMMIT");

    const organisation = mapOrganisationRow(inserted.rows[0]);
    if (!organisation) throw new OrgRosterError("org_roster_org_create_failed", 500);
    return Object.freeze({ organisation });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}

export async function listOrganisationsForOwner(
  ownerUserId: string
): Promise<readonly OrganisationRow[]> {
  const result = await pool.query(
    `SELECT * FROM product_organisations WHERE owner_user_id = $1 ORDER BY created_at ASC`,
    [ownerUserId]
  );
  return result.rows.map(mapOrganisationRow).filter((row): row is OrganisationRow => row !== null);
}

async function requireOrganisationOwnedBy(
  client: PoolClient,
  orgId: string,
  ownerUserId: string
): Promise<OrganisationRow> {
  const result = await client.query(
    `SELECT * FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const organisation = mapOrganisationRow(result.rows[0]);
  if (!organisation) {
    throw new OrgRosterError("org_roster_organisation_not_found", 404);
  }
  if (organisation.owner_user_id !== ownerUserId) {
    throw new OrgRosterError("org_roster_organisation_access_denied", 403);
  }
  return organisation;
}

async function findActiveCoachByEmail(
  client: PoolClient,
  email: string
): Promise<Readonly<{ user_id: string; display_name: string }>> {
  const result = await client.query(
    `
    SELECT user_id, display_name
    FROM product_accounts
    WHERE
      email_canonical = $1
      AND actor_type = 'coach'
      AND account_state = 'active'
    `,
    [email]
  );

  const row = result.rows[0];
  if (!row) {
    throw new OrgRosterError("org_roster_coach_not_found", 404);
  }

  return Object.freeze({
    user_id: String(row.user_id),
    display_name: String(row.display_name)
  });
}

export type OrgMembershipRow = Readonly<{
  membership_id: string;
  org_id: string;
  coach_user_id: string;
  membership_status: "invited" | "active" | "removed";
  invited_at_iso8601: string;
  activated_at_iso8601: string | null;
  removed_at_iso8601: string | null;
  // Only populated when the underlying query joins product_organisations
  // (listOrgMembershipsForCoach) - null everywhere else. Lets a coach see
  // what visibility they're agreeing to before calling accept.
  visibility_mode: "individual" | "shared" | null;
  // Only populated when the underlying query joins product_organisations
  // for org_name (listOrgMembershipsForCoach) - null everywhere else.
  // Part O.6 - lets athlete_org_context_service.ts resolve an org's name
  // for the athlete's own team-context view without a second query of
  // its own.
  org_name: string | null;
  // Only populated when the underlying query joins product_accounts
  // (listOrganisationRoster) - null everywhere else. Lets the org owner's
  // roster view show who a membership actually belongs to instead of a
  // bare coach_user_id.
  coach_display_name: string | null;
  coach_email: string | null;
}>;

function mapMembershipRow(value: unknown): OrgMembershipRow | null {
  if (!isRecord(value)) return null;
  const status = value.membership_status;
  if (status !== "invited" && status !== "active" && status !== "removed") return null;
  const visibilityMode = value.visibility_mode;

  return Object.freeze({
    membership_id: cleanString(value.membership_id),
    org_id: cleanString(value.org_id),
    coach_user_id: cleanString(value.coach_user_id),
    membership_status: status,
    invited_at_iso8601: value.invited_at instanceof Date ? value.invited_at.toISOString() : "",
    activated_at_iso8601: value.activated_at instanceof Date ? value.activated_at.toISOString() : null,
    removed_at_iso8601: value.removed_at instanceof Date ? value.removed_at.toISOString() : null,
    org_name: typeof value.org_name === "string" ? value.org_name : null,
    visibility_mode: visibilityMode === "individual" || visibilityMode === "shared" ? visibilityMode : null,
    coach_display_name: typeof value.coach_display_name === "string" ? value.coach_display_name : null,
    coach_email: typeof value.coach_email === "string" ? value.coach_email : null
  });
}

export async function inviteCoachToOrganisation(
  ownerUserId: string,
  orgId: string,
  coachEmailInput: unknown,
  requestId: unknown
): Promise<Readonly<{ membership: OrgMembershipRow }>> {
  const coachEmail = canonicalEmail(coachEmailInput);
  const correlationId = cleanString(requestId) || randomId("org_invite");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const organisation = await requireOrganisationOwnedBy(client, orgId, ownerUserId);
    const coach = await findActiveCoachByEmail(client, coachEmail);

    // A repeated correlation_id from the same owner replays the original
    // invite rather than re-running the "already a member" guard (and the
    // seat-capacity check) against the state that invite itself already
    // created.
    const existingAudit = await findExistingAudit(client, ownerUserId, correlationId);

    if (!existingAudit) {
      const existingMembership = await client.query(
        `SELECT * FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 LIMIT 1`,
        [orgId, coach.user_id]
      );
      if (existingMembership.rows[0]) {
        const existing = mapMembershipRow(existingMembership.rows[0]);
        if (existing && existing.membership_status !== "removed") {
          throw new OrgRosterError("org_roster_coach_already_member", 409);
        }
      }

      await assertOrgSeatCapacity(client, organisation, 1);
    }

    await withIdempotentAudit(
      client,
      {
        orgId,
        actorUserId: ownerUserId,
        actorRole: "org_owner",
        correlationId,
        actionType: "coach_invited",
        beforeState: { coach_user_id: coach.user_id, membership_status: "none" }
      },
      async () => {
        const membershipId = randomId("org_membership");
        const inserted = await client.query(
          `
          INSERT INTO product_org_coach_memberships (membership_id, org_id, coach_user_id, membership_status)
          VALUES ($1, $2, $3, 'invited')
          ON CONFLICT (org_id, coach_user_id) DO UPDATE SET
            membership_status = 'invited',
            invited_at = now(),
            activated_at = NULL,
            removed_at = NULL
          RETURNING *
          `,
          [membershipId, orgId, coach.user_id]
        );
        const insertedRow = inserted.rows[0];
        return { membership_id: insertedRow.membership_id, membership_status: "invited" };
      }
    );

    await client.query("COMMIT");

    // Read the current row back fresh - correct whether this call created
    // the membership just now or replayed an existing correlation_id.
    const finalRow = await pool.query(
      `SELECT * FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 LIMIT 1`,
      [orgId, coach.user_id]
    );
    const membership = mapMembershipRow(finalRow.rows[0]);
    if (!membership) throw new OrgRosterError("org_roster_invite_failed", 500);
    return Object.freeze({ membership });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}

async function queryRosterRows(client: PoolClient, orgId: string): Promise<readonly OrgMembershipRow[]> {
  const result = await client.query(
    `
    SELECT m.*, a.display_name AS coach_display_name, a.email_canonical AS coach_email
    FROM product_org_coach_memberships m
    LEFT JOIN product_accounts a ON a.user_id = m.coach_user_id
    WHERE m.org_id = $1
    ORDER BY m.invited_at ASC
    `,
    [orgId]
  );
  return result.rows.map(mapMembershipRow).filter((row): row is OrgMembershipRow => row !== null);
}

export async function listOrganisationRoster(
  ownerUserId: string,
  orgId: string
): Promise<readonly OrgMembershipRow[]> {
  const client = await pool.connect();
  try {
    await requireOrganisationOwnedBy(client, orgId, ownerUserId);
    return await queryRosterRows(client, orgId);
  }
  finally {
    client.release();
  }
}

// Part O.7 - a coach's own mirror of listOrganisationRoster, authorized by
// an ACTIVE membership rather than ownership. Gated to shared-visibility
// orgs only (matching org_visibility_service.ts's and O.6's own per-mode
// boundary) - an individual-mode org stays exactly as coach-private as it
// already is, so this returns an empty roster rather than an error, the
// same "structural, not policy" quiet-gate pattern used everywhere else in
// this codebase.
export async function listOrganisationRosterForCoach(
  coachUserId: string,
  orgId: string
): Promise<readonly OrgMembershipRow[]> {
  const client = await pool.connect();
  try {
    const membershipResult = await client.query(
      `SELECT * FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 AND membership_status = 'active' LIMIT 1`,
      [orgId, coachUserId]
    );
    if (!membershipResult.rows[0]) {
      throw new OrgRosterError("org_roster_membership_access_denied", 403);
    }

    const orgResult = await client.query(
      `SELECT visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );
    if (orgResult.rows[0]?.visibility_mode !== "shared") {
      return Object.freeze([]);
    }

    return await queryRosterRows(client, orgId);
  }
  finally {
    client.release();
  }
}

export async function removeCoachMembership(
  ownerUserId: string,
  orgId: string,
  membershipId: string,
  requestId: unknown
): Promise<Readonly<{ membership: OrgMembershipRow }>> {
  const correlationId = cleanString(requestId) || randomId("org_remove");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await requireOrganisationOwnedBy(client, orgId, ownerUserId);

    const current = await client.query(
      `SELECT * FROM product_org_coach_memberships WHERE membership_id = $1 AND org_id = $2 LIMIT 1`,
      [membershipId, orgId]
    );
    const currentMembership = mapMembershipRow(current.rows[0]);
    if (!currentMembership) {
      throw new OrgRosterError("org_roster_membership_not_found", 404);
    }

    // A repeated correlation_id replays the original removal rather than
    // re-running the "already removed" guard against the state that
    // removal itself already created.
    const existingAudit = await findExistingAudit(client, ownerUserId, correlationId);

    if (!existingAudit && currentMembership.membership_status === "removed") {
      throw new OrgRosterError("org_roster_membership_already_removed", 409);
    }

    await withIdempotentAudit(
      client,
      {
        orgId,
        actorUserId: ownerUserId,
        actorRole: "org_owner",
        correlationId,
        actionType: "coach_membership_removed",
        beforeState: { membership_id: membershipId, membership_status: currentMembership.membership_status }
      },
      async () => {
        const updated = await client.query(
          `
          UPDATE product_org_coach_memberships
          SET membership_status = 'removed', removed_at = now()
          WHERE membership_id = $1
          RETURNING *
          `,
          [membershipId]
        );
        return { membership_id: membershipId, membership_status: updated.rows[0].membership_status };
      }
    );

    await client.query("COMMIT");

    const finalRow = await pool.query(
      `SELECT * FROM product_org_coach_memberships WHERE membership_id = $1 LIMIT 1`,
      [membershipId]
    );
    const membership = mapMembershipRow(finalRow.rows[0]);
    if (!membership) throw new OrgRosterError("org_roster_remove_failed", 500);
    return Object.freeze({ membership });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}

export async function listOrgMembershipsForCoach(
  coachUserId: string
): Promise<readonly OrgMembershipRow[]> {
  const result = await pool.query(
    `
    SELECT m.*, o.visibility_mode, o.org_name
    FROM product_org_coach_memberships m
    JOIN product_organisations o ON o.org_id = m.org_id
    WHERE m.coach_user_id = $1
    ORDER BY m.invited_at ASC
    `,
    [coachUserId]
  );
  return result.rows.map(mapMembershipRow).filter((row): row is OrgMembershipRow => row !== null);
}

async function requireMembershipOwnedByCoach(
  client: PoolClient,
  membershipId: string,
  coachUserId: string
): Promise<OrgMembershipRow> {
  const result = await client.query(
    `SELECT * FROM product_org_coach_memberships WHERE membership_id = $1 LIMIT 1`,
    [membershipId]
  );
  const membership = mapMembershipRow(result.rows[0]);
  if (!membership) {
    throw new OrgRosterError("org_roster_membership_not_found", 404);
  }
  if (membership.coach_user_id !== coachUserId) {
    throw new OrgRosterError("org_roster_membership_access_denied", 403);
  }
  return membership;
}

export async function acceptOrgMembershipInvitation(
  coachUserId: string,
  membershipId: string,
  requestId: unknown
): Promise<Readonly<{ membership: OrgMembershipRow }>> {
  const correlationId = cleanString(requestId) || randomId("org_accept");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await requireMembershipOwnedByCoach(client, membershipId, coachUserId);

    // A repeated correlation_id replays the original acceptance rather than
    // re-running the "must be invited" guard against the state that
    // acceptance itself already created.
    const existingAudit = await findExistingAudit(client, coachUserId, correlationId);

    if (!existingAudit && current.membership_status !== "invited") {
      throw new OrgRosterError("org_roster_membership_not_invited", 409);
    }

    await withIdempotentAudit(
      client,
      {
        orgId: current.org_id,
        actorUserId: coachUserId,
        actorRole: "coach",
        correlationId,
        actionType: "coach_membership_activated",
        beforeState: { membership_id: membershipId, membership_status: "invited" }
      },
      async () => {
        const updated = await client.query(
          `
          UPDATE product_org_coach_memberships
          SET membership_status = 'active', activated_at = now()
          WHERE membership_id = $1
          RETURNING *
          `,
          [membershipId]
        );
        return { membership_id: membershipId, membership_status: updated.rows[0].membership_status };
      }
    );

    await client.query("COMMIT");

    const finalRow = await pool.query(
      `SELECT * FROM product_org_coach_memberships WHERE membership_id = $1 LIMIT 1`,
      [membershipId]
    );
    const membership = mapMembershipRow(finalRow.rows[0]);
    if (!membership) throw new OrgRosterError("org_roster_accept_failed", 500);
    return Object.freeze({ membership });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}

export async function leaveOrganisation(
  coachUserId: string,
  membershipId: string,
  requestId: unknown
): Promise<Readonly<{ membership: OrgMembershipRow }>> {
  const correlationId = cleanString(requestId) || randomId("org_leave");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await requireMembershipOwnedByCoach(client, membershipId, coachUserId);

    // A repeated correlation_id replays the original departure rather than
    // re-running the "must be active" guard against the state that
    // departure itself already created.
    const existingAudit = await findExistingAudit(client, coachUserId, correlationId);

    if (!existingAudit && current.membership_status !== "active") {
      throw new OrgRosterError("org_roster_membership_not_active", 409);
    }

    await withIdempotentAudit(
      client,
      {
        orgId: current.org_id,
        actorUserId: coachUserId,
        actorRole: "coach",
        correlationId,
        actionType: "coach_membership_left",
        beforeState: { membership_id: membershipId, membership_status: "active" }
      },
      async () => {
        const updated = await client.query(
          `
          UPDATE product_org_coach_memberships
          SET membership_status = 'removed', removed_at = now()
          WHERE membership_id = $1
          RETURNING *
          `,
          [membershipId]
        );
        return { membership_id: membershipId, membership_status: updated.rows[0].membership_status };
      }
    );

    await client.query("COMMIT");

    const finalRow = await pool.query(
      `SELECT * FROM product_org_coach_memberships WHERE membership_id = $1 LIMIT 1`,
      [membershipId]
    );
    const membership = mapMembershipRow(finalRow.rows[0]);
    if (!membership) throw new OrgRosterError("org_roster_leave_failed", 500);
    return Object.freeze({ membership });
  }
  catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally {
    client.release();
  }
}
