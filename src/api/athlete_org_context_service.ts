// DEV NOTE: Part O.6 - the athlete's own mirror of "which org is my coach
// part of." This file never queries roster/teammate data and never returns
// any other athlete's identity - it composes two already-tested read paths
// (listRelationshipsForAthlete, listOrgMembershipsForCoach) rather than
// adding a new query of its own. Gated to an ACCEPTED relationship with an
// ACTIVE org coach membership - the exact same pair org_athlete_messaging_
// service.ts already requires before it will let an org message this
// athlete, so an athlete never sees org context for a relationship/
// membership pair that couldn't message anyway.

import { listRelationshipsForAthlete } from "./relationship_invitation_service.js";
import { listOrgMembershipsForCoach } from "./org_roster_service.js";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type AthleteOrgContext = Readonly<{
  org_id: string;
  org_name: string;
  visibility_mode: "individual" | "shared";
}>;

export async function getAthleteOrgContexts(
  athleteUserId: string
): Promise<readonly AthleteOrgContext[]> {
  const relationships = await listRelationshipsForAthlete(athleteUserId);

  const acceptedCoachUserIds = new Set<string>();
  for (const relationship of relationships) {
    if (relationship.relationship_state !== "accepted") continue;
    const coachUserId = cleanString(relationship.coach_user_id);
    if (coachUserId) acceptedCoachUserIds.add(coachUserId);
  }

  const contextsByOrgId = new Map<string, AthleteOrgContext>();
  for (const coachUserId of acceptedCoachUserIds) {
    const memberships = await listOrgMembershipsForCoach(coachUserId);
    for (const membership of memberships) {
      if (membership.membership_status !== "active") continue;
      if (membership.visibility_mode !== "individual" && membership.visibility_mode !== "shared") continue;
      if (contextsByOrgId.has(membership.org_id)) continue;

      contextsByOrgId.set(membership.org_id, Object.freeze({
        org_id: membership.org_id,
        org_name: membership.org_name || membership.org_id,
        visibility_mode: membership.visibility_mode
      }));
    }
  }

  return Object.freeze(Array.from(contextsByOrgId.values()));
}
