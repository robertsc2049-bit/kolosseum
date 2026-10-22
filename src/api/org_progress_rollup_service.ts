// DEV NOTE: Progress graphs slice 4 (org-wide progress rollup for a
// "team" org, visibility_mode = 'shared') and slice 5 (an aggregate-only
// adherence trend for an "individual" org, visibility_mode =
// 'individual'). This is the THIRD org-owner-facing file that
// legitimately reads athlete-scoped data - see org_visibility_service.ts's
// own DEV NOTE. getOrgAthleteVisibility() is reused unmodified as the
// single source of truth for both org membership and the visibility_mode
// gate.
//
// The 'shared'-mode branch (OrgVisibilityRoster) is enriched with real
// per-athlete progress, for currently accepted relationships only,
// reusing getProgressInsightsForCoach() per athlete (the same building
// block, and the same defense-in-depth reasoning, as
// getProgressInsightsForCoachRoster() in progress_insights_service.ts:
// every athlete's relationship is independently re-validated at read
// time, not just resolved once via the roster fetch above).
//
// The 'individual'-mode branch (OrgVisibilityAggregate) NEVER returns an
// athlete_user_id, display_name, or email - only a per-coach AVERAGE
// adherence trend, and only once there are enough contributing athletes
// that the average could not trivially be reverse-engineered to reveal
// one specific athlete's own number. MIN_COHORT_SIZE (below) is checked
// twice: once per coach (skipping the coach's athlete roster and every
// per-athlete read entirely if their accepted-athlete count is already
// too small for ANY window to ever qualify - so a small coach's athlete
// data is never even touched by this file), and again per trailing
// window (since a coach who clears the coach-level gate can still have
// fewer athletes with actual session data in an older window than in
// the current one).

import {
  getOrgAthleteVisibility,
  type OrgVisibilityAggregate,
  type OrgVisibilityRoster
} from "./org_visibility_service.js";
import { getProgressInsightsForCoach } from "./progress_insights_service.js";
import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";
import { analyseMembers, analyseTeamForCoach, displayNames, type TeamMember } from "./team_analysis_service.js";
import { headCoachOf, headCoachOrgs, medicalLeadOf } from "./org_head_coach_service.js";
import { groupFindings, squadTesting, summariseBy, summariseGroup, withoutPainDetail } from "./team_analysis_metrics.js";

type JsonRecord = Record<string, unknown>;

// Never publish an average derived from fewer than this many athletes -
// with 1 or 2 contributors, the "average" is trivially reversible to (or
// close enough to) one specific athlete's own adherence figure, which is
// exactly what individual-mode orgs exist to prevent.
const MIN_COHORT_SIZE = 3;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type OrgProgressRollupRoster = Readonly<{
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

export type OrgProgressRollupAggregateWindow = Readonly<{
  window_start_date: string;
  window_end_date: string;
  average_adherence_percentage: number | null;
  contributor_count: number;
}>;

export type OrgProgressRollupAggregate = Readonly<{
  visibility_mode: "individual";
  org_id: string;
  coaches: readonly Readonly<{
    coach_user_id: string;
    membership_status: "invited" | "active";
    active_athlete_count: number;
    insufficient_cohort: boolean;
    adherence_series: readonly OrgProgressRollupAggregateWindow[];
  }>[];
}>;

export type OrgProgressRollup = OrgProgressRollupRoster | OrgProgressRollupAggregate;

async function rollupAcceptedAthletes(
  orgId: string,
  visibility: OrgVisibilityRoster
): Promise<OrgProgressRollupRoster> {
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

type AggregateCoach = OrgProgressRollupAggregate["coaches"][number];

function suppressedAggregateCoach(coach: OrgVisibilityAggregate["coaches"][number]): AggregateCoach {
  return Object.freeze({
    coach_user_id: coach.coach_user_id,
    membership_status: coach.membership_status,
    active_athlete_count: coach.active_athlete_count,
    insufficient_cohort: true,
    adherence_series: Object.freeze([])
  });
}

async function aggregateAdherenceForCoach(
  coach: OrgVisibilityAggregate["coaches"][number]
): Promise<AggregateCoach> {
  const roster = await listConnectedCoachAthletes(coach.coach_user_id);

  const perAthleteResults = await Promise.all(
    roster.map(async (athlete): Promise<JsonRecord[] | null> => {
      try {
        const insights = await getProgressInsightsForCoach(coach.coach_user_id, cleanString(athlete.athlete_user_id));
        const adherence = insights.session_adherence;
        const series = isRecord(adherence) ? adherence.series : null;
        return Array.isArray(series) ? (series as JsonRecord[]) : null;
      }
      catch {
        // Mirrors rollupAcceptedAthletes's identical resilience reasoning -
        // one athlete's transient read failure must never take down the
        // whole coach's aggregate, it just contributes nothing.
        return null;
      }
    })
  );
  const perAthleteSeries: JsonRecord[][] = perAthleteResults.filter((series): series is JsonRecord[] => series !== null);

  const anchorSeries: JsonRecord[] = perAthleteSeries[0] ?? [];

  const adherenceSeries: OrgProgressRollupAggregateWindow[] = anchorSeries.map((anchorWindow, windowIndex) => {
    const contributingValues = perAthleteSeries
      .map((series) => series[windowIndex])
      .filter((window): window is JsonRecord => isRecord(window) && window.adherence_percentage !== null)
      .map((window) => Number(window.adherence_percentage));

    const contributorCount = contributingValues.length;
    const sufficientCohort = contributorCount >= MIN_COHORT_SIZE;

    return Object.freeze({
      window_start_date: cleanString(anchorWindow.window_start_date),
      window_end_date: cleanString(anchorWindow.window_end_date),
      average_adherence_percentage: sufficientCohort
        ? Math.round(contributingValues.reduce((sum, value) => sum + value, 0) / contributorCount)
        : null,
      contributor_count: sufficientCohort ? contributorCount : 0
    });
  });

  return Object.freeze({
    coach_user_id: coach.coach_user_id,
    membership_status: coach.membership_status,
    active_athlete_count: coach.active_athlete_count,
    insufficient_cohort: false,
    adherence_series: Object.freeze(adherenceSeries)
  });
}

async function aggregateAdherenceForOrg(
  orgId: string,
  visibility: OrgVisibilityAggregate
): Promise<OrgProgressRollupAggregate> {
  const coaches = await Promise.all(
    visibility.coaches.map((coach): Promise<AggregateCoach> =>
      coach.active_athlete_count < MIN_COHORT_SIZE
        ? Promise.resolve(suppressedAggregateCoach(coach))
        : aggregateAdherenceForCoach(coach)
    )
  );

  return Object.freeze({
    visibility_mode: "individual",
    org_id: orgId,
    coaches: Object.freeze(coaches)
  });
}

export async function getOrgProgressRollup(
  ownerUserId: string,
  orgId: string
): Promise<OrgProgressRollup> {
  const visibility = await getOrgAthleteVisibility(ownerUserId, orgId);

  return visibility.visibility_mode === "shared"
    ? rollupAcceptedAthletes(orgId, visibility)
    : aggregateAdherenceForOrg(orgId, visibility);
}

// ---------- Organisation analysis (coach Analysis, for the org owner) ----------
// The same gate as the rollup above, one level richer:
// - 'shared' ("team"): the whole organisation summed up (team_analysis_
//   metrics.ts), by coach and by position, and athlete by athlete - with
//   pain as a flag only (the detail stays with the athlete's own coach).
// - 'individual' ("gym"): per-coach and organisation-wide AVERAGES and
//   counts only, each withheld below MIN_COHORT_SIZE athletes with logged
//   training, never pain (not even as a count), never a position, and
//   never any athlete's identity - the athlete rows used to work the
//   averages out are never returned.
const positionLabel = (position: string) => (position === "unknown" ? "No position set" : position.replaceAll("_", " ").replace(/^./u, (c) => c.toUpperCase()));

function memberOf(coachUserId: string, athlete: JsonRecord): TeamMember {
  return { athlete_user_id: cleanString(athlete.athlete_user_id), display_name: cleanString(athlete.display_name), coach_user_id: coachUserId, position: cleanString(athlete.position) || null };
}

async function sharedOrgAnalysis(orgId: string, visibility: OrgVisibilityRoster, today: string): Promise<JsonRecord> {
  const members = visibility.coaches
    .filter((coach) => coach.membership_status === "active")
    .flatMap((coach) => coach.athletes.filter((athlete) => athlete.relationship_state === "accepted").map((athlete) => memberOf(coach.coach_user_id, athlete as unknown as JsonRecord)));
  const rows = await analyseMembers(members, today);
  const coachNames = await displayNames(rows.map((row) => cleanString(row.coach_user_id)));
  const summary = summariseGroup(rows);
  return {
    visibility_mode: "shared",
    org_id: orgId,
    summary,
    findings: groupFindings(summary, "the organisation"),
    by_coach: summariseBy(rows, (row) => cleanString(row.coach_user_id), (key) => coachNames.get(key) || "Coach"),
    by_position: summariseBy(rows, (row) => cleanString(row.position), positionLabel),
    testing: squadTesting(rows),
    athletes: rows
      .map((row): JsonRecord => ({ ...withoutPainDetail(row), coach_name: coachNames.get(cleanString(row.coach_user_id)) || "Coach" }))
      .sort((a, b) => Number(b.attention ?? -1) - Number(a.attention ?? -1) || String(a.display_name).localeCompare(String(b.display_name)))
  };
}

async function gymOrgAnalysis(orgId: string, visibility: OrgVisibilityAggregate, today: string): Promise<JsonRecord> {
  const coaches = visibility.coaches.filter((coach) => coach.membership_status === "active");
  const perCoach = await Promise.all(coaches.map(async (coach) => {
    // A coach with too few athletes is never even read.
    if (coach.active_athlete_count < MIN_COHORT_SIZE) return { coach_user_id: coach.coach_user_id, rows: [] as JsonRecord[] };
    const roster = await listConnectedCoachAthletes(coach.coach_user_id);
    return { coach_user_id: coach.coach_user_id, rows: await analyseMembers(roster.map((athlete) => memberOf(coach.coach_user_id, athlete)), today) };
  }));
  const all = perCoach.flatMap((coach) => coach.rows);
  const whole = summariseGroup(all, { includePain: false });
  const enough = Number(whole.trained) >= MIN_COHORT_SIZE;
  return {
    visibility_mode: "individual",
    org_id: orgId,
    min_cohort_size: MIN_COHORT_SIZE,
    summary: enough ? whole : null,
    findings: enough ? groupFindings(whole, "the gym") : [],
    by_coach: perCoach.map((coach) => {
      const summary = summariseGroup(coach.rows, { includePain: false });
      return Number(summary.trained) >= MIN_COHORT_SIZE
        ? { coach_user_id: coach.coach_user_id, summary, findings: groupFindings(summary, "this coach's athletes") }
        : { coach_user_id: coach.coach_user_id, withheld: true };
    })
  };
}

export async function getOrgAnalysis(ownerUserId: string, orgId: string, today = new Date().toISOString().slice(0, 10)): Promise<JsonRecord> {
  const visibility = await getOrgAthleteVisibility(ownerUserId, orgId);
  const analysis = visibility.visibility_mode === "shared"
    ? await sharedOrgAnalysis(orgId, visibility, today)
    : await gymOrgAnalysis(orgId, visibility, today);
  return { ...analysis, head_coach_user_id: await headCoachOf(orgId), medical_lead_user_id: await medicalLeadOf(orgId) };
}

// The organisation's head coach, in their own coaching workspace: a team's
// is the team view with every athlete open (team_analysis_service.ts); a
// gym's is exactly the owner's gym view - averages for groups of 3 or more,
// never an athlete. Not the head coach (or not active): refused.
export class OrgAnalysisAccessError extends Error {}
export async function getOrgAnalysisForHeadCoach(coachUserId: string, orgId: string, today = new Date().toISOString().slice(0, 10)): Promise<JsonRecord> {
  const org = (await headCoachOrgs(coachUserId)).find((entry) => entry.org_id === orgId);
  if (!org) throw new OrgAnalysisAccessError("org_analysis_head_coach_only");
  if (org.visibility_mode === "shared") return { visibility_mode: "shared", team: await analyseTeamForCoach(coachUserId, orgId, today) };
  const visibility = await getOrgAthleteVisibility(org.owner_user_id, orgId);
  if (visibility.visibility_mode !== "individual") throw new OrgAnalysisAccessError("org_analysis_mode_changed");
  const analysis = await gymOrgAnalysis(orgId, visibility, today);
  const names = await displayNames(((analysis.by_coach ?? []) as JsonRecord[]).map((group) => cleanString(group.coach_user_id)));
  return {
    ...analysis, org_name: org.org_name, head_coach_user_id: coachUserId,
    by_coach: ((analysis.by_coach ?? []) as JsonRecord[]).map((group) => ({ ...group, label: group.coach_user_id === coachUserId ? "You" : names.get(cleanString(group.coach_user_id)) || "Coach" }))
  };
}
