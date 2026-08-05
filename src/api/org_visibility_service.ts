// DEV NOTE: Organisation/team billing commercial expansion (part C) - org
// owner athlete visibility, scoped by the organisation's declared
// visibility_mode. This is the ONE org-owner-facing file that legitimately
// reads athlete-scoped data (beta_product_records / beta17_coach_relationship
// rows) - every other org file (org_owner_account_service.ts,
// org_owner_auth.ts, org_owner.routes.ts, org_roster_service.ts,
// org_billing_service.ts, coach_org_membership.routes.ts) never does, and
// must not be edited to do so. Access is gated by
// product_organisations.visibility_mode, which is declared once at org
// creation and immutable afterward:
//   - "individual" (default): AGGREGATE COUNTS ONLY per coach - no
//     athlete_user_id, no display_name, no email ever leaves
//     aggregateCountsForOrg(). For gyms billing independent coaches, where
//     each coach's athlete relationships stay private to that coach.
//   - "shared": a real per-coach athlete roster (id/name/email/relationship
//     state) via fullRosterForOrg() - for team/unit contexts where the org
//     owner already is the coaching authority over the whole roster.
// This file is read-only - it never writes to beta_product_records, or to
// any other table.

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { loadLatestBetaProductRecord } from "./beta_product_record_store.js";

type JsonRecord = Record<string, unknown>;

export class OrgVisibilityError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgVisibilityError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type OrgForVisibility = Readonly<{
  org_id: string;
  owner_user_id: string;
  visibility_mode: "individual" | "shared";
}>;

async function requireOrgForVisibility(
  client: PoolClient,
  orgId: string,
  ownerUserId: string
): Promise<OrgForVisibility> {
  const result = await client.query(
    `SELECT org_id, owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgVisibilityError("org_visibility_organisation_not_found", 404);
  }
  if (cleanString(row.owner_user_id) !== ownerUserId) {
    throw new OrgVisibilityError("org_visibility_organisation_access_denied", 403);
  }

  return Object.freeze({
    org_id: cleanString(row.org_id),
    owner_user_id: cleanString(row.owner_user_id),
    visibility_mode: row.visibility_mode === "shared" ? "shared" : "individual"
  });
}

type CoachMembership = Readonly<{
  coach_user_id: string;
  membership_status: "invited" | "active";
}>;

// A departed coach's historical roster is excluded from both visibility
// modes entirely - it stops being the org owner's business once the coach
// has left, the same way removeCoachMembership preserves the row as
// history without granting it any ongoing visibility.
async function activeAndInvitedCoachMemberships(
  client: PoolClient,
  orgId: string
): Promise<readonly CoachMembership[]> {
  const result = await client.query(
    `
    SELECT coach_user_id, membership_status
    FROM product_org_coach_memberships
    WHERE org_id = $1 AND membership_status != 'removed'
    ORDER BY invited_at ASC
    `,
    [orgId]
  );

  const memberships: CoachMembership[] = [];
  for (const row of result.rows) {
    if (!isRecord(row)) continue;
    const status = row.membership_status;
    if (status !== "invited" && status !== "active") continue;
    memberships.push(Object.freeze({
      coach_user_id: cleanString(row.coach_user_id),
      membership_status: status
    }));
  }
  return Object.freeze(memberships);
}

function isRelationshipExpired(relationshipState: string, expiresAtIso8601: string): boolean {
  return (
    relationshipState === "invited" &&
    Boolean(expiresAtIso8601) &&
    Number.isFinite(Date.parse(expiresAtIso8601)) &&
    Date.parse(expiresAtIso8601) <= Date.now()
  );
}

type RelationshipState = "invited" | "accepted" | "declined" | "revoked" | "expired";

type LatestRelationship = Readonly<{
  coach_user_id: string;
  athlete_user_id: string;
  relationship_state: RelationshipState;
}>;

// Generalises listCoachAthleteRelationships's single-coach DISTINCT ON
// pattern (beta19_coach_workspace_service.ts) to many coaches at once via
// actor_user_id = ANY($1). Shared by both visibility-mode branches below -
// the athlete_user_id/display data it returns is only ever CONSUMED by
// fullRosterForOrg(); aggregateCountsForOrg() reads relationship_state and
// coach_user_id only and never touches it.
async function latestRelationshipsForCoaches(
  client: PoolClient,
  coachUserIds: readonly string[]
): Promise<readonly LatestRelationship[]> {
  if (coachUserIds.length === 0) return Object.freeze([]);

  const result = await client.query(
    `
    SELECT DISTINCT ON (actor_user_id, subject_user_id)
      actor_user_id, subject_user_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = ANY($1::text[])
    ORDER BY actor_user_id, subject_user_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [coachUserIds]
  );

  const relationships: LatestRelationship[] = [];
  for (const row of result.rows) {
    if (!isRecord(row) || !isRecord(row.record_payload)) continue;
    const storedState = cleanString(row.record_payload.relationship_state);
    const expiresAt = cleanString(row.record_payload.expires_at_iso8601);
    const state = isRelationshipExpired(storedState, expiresAt) ? "expired" : storedState;
    if (
      state !== "invited" && state !== "accepted" &&
      state !== "declined" && state !== "revoked" && state !== "expired"
    ) continue;

    relationships.push(Object.freeze({
      coach_user_id: cleanString(row.actor_user_id),
      athlete_user_id: cleanString(row.subject_user_id),
      relationship_state: state
    }));
  }
  return Object.freeze(relationships);
}

export type OrgVisibilityAggregate = Readonly<{
  visibility_mode: "individual";
  org_id: string;
  coaches: readonly Readonly<{
    coach_user_id: string;
    membership_status: "invited" | "active";
    active_athlete_count: number;
    invited_athlete_count: number;
  }>[];
}>;

async function aggregateCountsForOrg(
  client: PoolClient,
  org: OrgForVisibility
): Promise<OrgVisibilityAggregate> {
  const memberships = await activeAndInvitedCoachMemberships(client, org.org_id);
  const relationships = await latestRelationshipsForCoaches(
    client,
    memberships.map((membership) => membership.coach_user_id)
  );

  const coaches = memberships.map((membership) => {
    const forCoach = relationships.filter((relationship) => relationship.coach_user_id === membership.coach_user_id);
    return Object.freeze({
      coach_user_id: membership.coach_user_id,
      membership_status: membership.membership_status,
      active_athlete_count: forCoach.filter((relationship) => relationship.relationship_state === "accepted").length,
      invited_athlete_count: forCoach.filter((relationship) => relationship.relationship_state === "invited").length
    });
  });

  return Object.freeze({
    visibility_mode: "individual",
    org_id: org.org_id,
    coaches: Object.freeze(coaches)
  });
}

export type OrgVisibilityRoster = Readonly<{
  visibility_mode: "shared";
  org_id: string;
  coaches: readonly Readonly<{
    coach_user_id: string;
    membership_status: "invited" | "active";
    athletes: readonly Readonly<{
      athlete_user_id: string;
      display_name: string;
      email: string | null;
      relationship_state: RelationshipState;
    }>[];
  }>[];
}>;

async function fullRosterForOrg(
  client: PoolClient,
  org: OrgForVisibility
): Promise<OrgVisibilityRoster> {
  const memberships = await activeAndInvitedCoachMemberships(client, org.org_id);
  const relationships = await latestRelationshipsForCoaches(
    client,
    memberships.map((membership) => membership.coach_user_id)
  );

  const coaches = await Promise.all(
    memberships.map(async (membership) => {
      const forCoach = relationships.filter((relationship) => relationship.coach_user_id === membership.coach_user_id);

      const athletes = await Promise.all(
        forCoach.map(async (relationship) => {
          const auth = await loadLatestBetaProductRecord(
            "beta16_auth",
            relationship.athlete_user_id,
            relationship.athlete_user_id
          );

          return Object.freeze({
            athlete_user_id: relationship.athlete_user_id,
            display_name: cleanString(auth?.display_name) || relationship.athlete_user_id,
            email: cleanString(auth?.email) || null,
            relationship_state: relationship.relationship_state
          });
        })
      );

      return Object.freeze({
        coach_user_id: membership.coach_user_id,
        membership_status: membership.membership_status,
        athletes: Object.freeze(athletes)
      });
    })
  );

  return Object.freeze({
    visibility_mode: "shared",
    org_id: org.org_id,
    coaches: Object.freeze(coaches)
  });
}

export type OrgAthleteVisibility = OrgVisibilityAggregate | OrgVisibilityRoster;

export async function getOrgAthleteVisibility(
  ownerUserId: string,
  orgId: string
): Promise<OrgAthleteVisibility> {
  const client = await pool.connect();
  try {
    const org = await requireOrgForVisibility(client, orgId, ownerUserId);
    return org.visibility_mode === "shared"
      ? await fullRosterForOrg(client, org)
      : await aggregateCountsForOrg(client, org);
  }
  finally {
    client.release();
  }
}
