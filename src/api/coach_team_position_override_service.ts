// DEV NOTE: slice 3 of the sport-declaration redesign - a coach who is an
// ACTIVE member of a shared-visibility org can directly override a
// teammate athlete's position, no athlete confirmation needed (unlike the
// plain 1:1 propose/confirm tier in athlete_activity_change_service.ts).
// Authorization composes two already-existing roster helpers
// (attendance_event_org_invite_service.ts) rather than re-deriving org
// membership from scratch: the org must be in 'shared' visibility mode,
// the coach must be one of its active members, and the athlete must
// actually be on that org's accepted roster.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import {
  activeCoachIdsForOrg,
  resolveOrgActiveCoachAcceptedAthletes
} from "./attendance_event_org_invite_service.js";
import {
  amendAthleteDeclaration,
  assertPositionMatchesActivity,
  getAthleteDeclaredActivityAndPosition,
  validateAthletePosition
} from "./athlete_onboarding_service.js";
import { writeAuditRecord } from "./org_roster_service.js";

type JsonRecord = Record<string, unknown>;

export class CoachTeamPositionOverrideError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CoachTeamPositionOverrideError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireSharedOrg(orgId: string): Promise<void> {
  const result = await pool.query(
    `SELECT visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!row) throw new CoachTeamPositionOverrideError("coach_team_position_override_organisation_not_found", 404);
  if (row.visibility_mode !== "shared") {
    throw new CoachTeamPositionOverrideError("coach_team_position_override_requires_shared_visibility", 403);
  }
}

export type OrgAthleteRosterEntry = Readonly<{
  athlete_user_id: string;
  display_name: string;
  email: string | null;
  coach_user_id: string;
  activity_id: string | null;
  position: string | null;
}>;

// Read-only: the coach's own team roster, enriched with each athlete's
// declared activity/position (never itself projected into the phase1/
// engine record, so this is a dedicated read of the athlete's own current
// declaration per roster entry). Requires the same authorization as the
// write below - an active membership in a shared-visibility org.
export async function listOrgAthleteRosterForCoach(
  coachUserId: string,
  orgId: unknown
): Promise<readonly OrgAthleteRosterEntry[]> {
  const cleanOrgId = cleanString(orgId);
  if (!cleanOrgId) throw new CoachTeamPositionOverrideError("coach_team_position_override_organisation_not_found", 404);

  await requireSharedOrg(cleanOrgId);

  const activeCoachIds = await activeCoachIdsForOrg(cleanOrgId);
  if (!activeCoachIds.includes(coachUserId)) {
    throw new CoachTeamPositionOverrideError("coach_team_position_override_access_denied", 403);
  }

  const roster = await resolveOrgActiveCoachAcceptedAthletes(cleanOrgId);
  const enriched = await Promise.all(roster.map(async (entry) => {
    const declared = await getAthleteDeclaredActivityAndPosition(entry.athlete_user_id);
    return Object.freeze({ ...entry, activity_id: declared.activity_id, position: declared.position });
  }));
  return Object.freeze(enriched);
}

export async function overrideAthletePositionForCoach(
  coachUserId: string,
  orgId: unknown,
  input: unknown
): Promise<Readonly<JsonRecord>> {
  const cleanOrgId = cleanString(orgId);
  if (!cleanOrgId) throw new CoachTeamPositionOverrideError("coach_team_position_override_organisation_not_found", 404);
  const body = (input && typeof input === "object" ? input : {}) as JsonRecord;
  const athleteUserId = cleanString(body.athlete_user_id);
  if (!athleteUserId) throw new CoachTeamPositionOverrideError("coach_team_position_override_athlete_required", 422);
  const newPosition = validateAthletePosition(body.position);

  await requireSharedOrg(cleanOrgId);

  const activeCoachIds = await activeCoachIdsForOrg(cleanOrgId);
  if (!activeCoachIds.includes(coachUserId)) {
    throw new CoachTeamPositionOverrideError("coach_team_position_override_access_denied", 403);
  }

  const roster = await resolveOrgActiveCoachAcceptedAthletes(cleanOrgId);
  if (!roster.some((entry) => entry.athlete_user_id === athleteUserId)) {
    throw new CoachTeamPositionOverrideError("coach_team_position_override_athlete_not_on_roster", 403);
  }

  const declared = await getAthleteDeclaredActivityAndPosition(athleteUserId);
  assertPositionMatchesActivity(newPosition, declared.activity_id ?? undefined);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await amendAthleteDeclaration(
      client, athleteUserId, { position: newPosition }, "coach_team_position_override"
    );
    await writeAuditRecord(client, {
      orgId: cleanOrgId,
      actorUserId: coachUserId,
      actorRole: "coach",
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
