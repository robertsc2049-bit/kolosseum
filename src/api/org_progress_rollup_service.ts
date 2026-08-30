// DEV NOTE: Progress graphs slice 4 - org-wide progress rollup for a
// "team" org (visibility_mode = 'shared'). This is the THIRD org-owner-
// facing file that legitimately reads athlete-scoped data - see
// org_visibility_service.ts's own DEV NOTE, now updated to reflect this.
// getOrgAthleteVisibility() is reused unmodified as the single source of
// truth for both org membership and the visibility_mode gate: an
// 'individual'-mode ("gym") org resolves to OrgVisibilityAggregate, which
// TypeScript makes it a compile-time error to read an athlete_user_id
// from - the guard below throws before any athlete-scoped query ever
// runs. Only the 'shared'-mode ("team") branch (OrgVisibilityRoster) is
// ever enriched with per-athlete progress, and only for currently
// accepted relationships - reusing getProgressInsightsForCoach() per
// athlete (the same building block, and the same defense-in-depth
// reasoning, as getProgressInsightsForCoachRoster() in
// progress_insights_service.ts: every athlete's relationship is
// independently re-validated at read time, not just resolved once via
// the roster fetch above).

import {
  getOrgAthleteVisibility,
  type OrgVisibilityRoster
} from "./org_visibility_service.js";
import { getProgressInsightsForCoach } from "./progress_insights_service.js";

type JsonRecord = Record<string, unknown>;

export class OrgProgressRollupError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "OrgProgressRollupError";
    this.status = status;
  }
}

export type OrgProgressRollup = Readonly<{
  visibility_mode: "shared";
  org_id: string;
  coaches: readonly Readonly<{
    coach_user_id: string;
    membership_status: "invited" | "active";
    athletes: readonly Readonly<{
      athlete_user_id: string;
      display_name: string;
      email: string | null;
      insights: Readonly<JsonRecord> | null;
    }>[];
  }>[];
}>;

async function rollupAcceptedAthletes(
  orgId: string,
  visibility: OrgVisibilityRoster
): Promise<OrgProgressRollup> {
  const coaches = await Promise.all(
    visibility.coaches.map(async (coach) => {
      const accepted = coach.athletes.filter((athlete) => athlete.relationship_state === "accepted");

      const athletes = await Promise.all(
        accepted.map(async (athlete) => {
          try {
            const insights = await getProgressInsightsForCoach(coach.coach_user_id, athlete.athlete_user_id);
            return Object.freeze({
              athlete_user_id: athlete.athlete_user_id,
              display_name: athlete.display_name,
              email: athlete.email,
              insights
            });
          }
          catch {
            // One athlete's failure (a transient read error, or a
            // relationship that changed state between the roster fetch
            // above and this read) must never take down the entire org
            // rollup - see the identical reasoning in
            // getProgressInsightsForCoachRoster().
            return Object.freeze({
              athlete_user_id: athlete.athlete_user_id,
              display_name: athlete.display_name,
              email: athlete.email,
              insights: null
            });
          }
        })
      );

      return Object.freeze({
        coach_user_id: coach.coach_user_id,
        membership_status: coach.membership_status,
        athletes: Object.freeze(athletes)
      });
    })
  );

  return Object.freeze({
    visibility_mode: "shared",
    org_id: orgId,
    coaches: Object.freeze(coaches)
  });
}

export async function getOrgProgressRollup(
  ownerUserId: string,
  orgId: string
): Promise<OrgProgressRollup> {
  const visibility = await getOrgAthleteVisibility(ownerUserId, orgId);

  if (visibility.visibility_mode !== "shared") {
    throw new OrgProgressRollupError("org_progress_rollup_not_available_for_individual_org", 403);
  }

  return rollupAcceptedAthletes(orgId, visibility);
}
