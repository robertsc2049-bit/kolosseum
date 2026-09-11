// DEV NOTE: slice 3 of the sport-declaration redesign - the one deliberate
// exception to this codebase's own documented boundary that "an org owner
// has no schema path to any athlete-scoped data, by construction, not by
// policy" (org_owner_account_service.ts). Confirmed explicitly, twice,
// during design: the org owner may directly override the POSITION field
// only, only for an athlete already visible on their own shared-visibility
// roster (product_organisations.visibility_mode = 'shared') - nothing else
// about org-owner capabilities changes. "Is this athlete actually on the
// roster" reuses resolveOrgActiveCoachAcceptedAthletes unchanged, the same
// helper the coach-side team-override tier (coach_team_position_override_
// service.ts) uses.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import { resolveOrgActiveCoachAcceptedAthletes } from "./attendance_event_org_invite_service.js";
import {
  amendAthleteDeclaration,
  assertPositionMatchesActivity,
  getAthleteDeclaredActivityAndPosition,
  validateAthletePosition
} from "./athlete_onboarding_service.js";
import { writeAuditRecord } from "./org_roster_service.js";

type JsonRecord = Record<string, unknown>;

export class OrgOwnerPositionOverrideError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgOwnerPositionOverrideError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireOwnedSharedOrg(orgId: string, ownerUserId: string): Promise<void> {
  const result = await pool.query(
    `SELECT owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!row) throw new OrgOwnerPositionOverrideError("org_owner_position_override_organisation_not_found", 404);
  if (row.owner_user_id !== ownerUserId) {
    throw new OrgOwnerPositionOverrideError("org_owner_position_override_access_denied", 403);
  }
  if (row.visibility_mode !== "shared") {
    throw new OrgOwnerPositionOverrideError("org_owner_position_override_requires_shared_visibility", 403);
  }
}

export async function overrideAthletePositionForOrgOwner(
  ownerUserId: string,
  orgId: unknown,
  input: unknown
): Promise<Readonly<JsonRecord>> {
  const cleanOrgId = cleanString(orgId);
  if (!cleanOrgId) throw new OrgOwnerPositionOverrideError("org_owner_position_override_organisation_not_found", 404);
  const body = (input && typeof input === "object" ? input : {}) as JsonRecord;
  const athleteUserId = cleanString(body.athlete_user_id);
  if (!athleteUserId) throw new OrgOwnerPositionOverrideError("org_owner_position_override_athlete_required", 422);
  const newPosition = validateAthletePosition(body.position);

  await requireOwnedSharedOrg(cleanOrgId, ownerUserId);

  const roster = await resolveOrgActiveCoachAcceptedAthletes(cleanOrgId);
  if (!roster.some((entry) => entry.athlete_user_id === athleteUserId)) {
    throw new OrgOwnerPositionOverrideError("org_owner_position_override_athlete_not_on_roster", 403);
  }

  const declared = await getAthleteDeclaredActivityAndPosition(athleteUserId);
  assertPositionMatchesActivity(newPosition, declared.activity_id ?? undefined);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await amendAthleteDeclaration(
      client, athleteUserId, { position: newPosition }, "org_owner_position_override"
    );
    await writeAuditRecord(client, {
      orgId: cleanOrgId,
      actorUserId: ownerUserId,
      actorRole: "org_owner",
      correlationId: crypto.randomUUID(),
      actionType: "athlete_position_overridden",
      beforeState: { athlete_user_id: athleteUserId, position: declared.position },
      afterState: { athlete_user_id: athleteUserId, position: newPosition }
    });
    await client.query("COMMIT");
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }

  return Object.freeze({ athlete_user_id: athleteUserId, position: newPosition });
}
