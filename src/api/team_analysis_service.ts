// DEV NOTE: Team analysis for coaches - every athlete in a shared-
// visibility ("team") organisation the coach is an active member of,
// summed up as a team (team_analysis_metrics.ts), by position and by coach,
// and athlete by athlete. Access is exactly the team roster's own
// (listOrgAthleteRosterForCoach: a shared org, an active coach member);
// individual-mode ("gym") orgs have no team view - each coach's athletes
// stay private to that coach. A teammate's pain shows as a flag only: the
// detail stays with the athlete's own coach. Read-only.
import { pool } from "../db/pool.js";
import { analyseAthleteWindow, rosterRowFor } from "./coach_analysis_service.js";
import { listOrgAthleteRosterForCoach } from "./coach_team_position_override_service.js";
import { resolveOrgActiveCoachAcceptedAthletes } from "./attendance_event_org_invite_service.js";
import { headCoachOf, headCoachOrgs } from "./org_head_coach_service.js";
import { groupFindings, summariseBy, summariseGroup, withoutPainDetail } from "./team_analysis_metrics.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export type TeamMember = Readonly<{ athlete_user_id: string; display_name: string; coach_user_id: string; position?: string | null }>;

// Each member's 8-week analysis row (the same row a coach's own roster uses).
export async function analyseMembers(members: readonly TeamMember[], today: string): Promise<Json[]> {
  return Promise.all(members.map(async (member) => {
    const name = member.display_name || member.athlete_user_id;
    try {
      const result = await analyseAthleteWindow(member.athlete_user_id, member.coach_user_id, 8, today);
      const findings = (result.findings ?? []) as Json[];
      return { ...rosterRowFor(member.athlete_user_id, name, { ...result, findings, attention: result.attention }), coach_user_id: member.coach_user_id, position: member.position ?? null };
    }
    catch {
      return { athlete_user_id: member.athlete_user_id, display_name: name, coach_user_id: member.coach_user_id, position: member.position ?? null, attention: null, findings: [], unavailable: true };
    }
  }));
}

export async function displayNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const result = await pool.query("SELECT user_id, display_name FROM product_accounts WHERE user_id = ANY($1::text[])", [[...new Set(userIds)]]).catch(() => null);
  return new Map((result?.rows ?? []).map((row) => [String(row.user_id), text(row.display_name)]));
}

const positionLabel = (position: string) => (position === "unknown" ? "No position set" : position.replaceAll("_", " ").replace(/^./u, (c) => c.toUpperCase()));
const byAttention = (a: Json, b: Json) => Number(b.attention ?? -1) - Number(a.attention ?? -1) || String(a.display_name).localeCompare(String(b.display_name));

export async function analyseTeamForCoach(coachUserId: string, orgId: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const roster = await listOrgAthleteRosterForCoach(coachUserId, orgId);
  const org = await pool.query("SELECT org_name FROM product_organisations WHERE org_id = $1", [orgId]);
  const rows = await analyseMembers(roster, today);
  const coachNames = await displayNames(rows.map((row) => text(row.coach_user_id)));
  // Your own athletes in full; a teammate's pain as a flag only - unless
  // you're the team's head coach, who sees and opens every athlete in full.
  const head = (await headCoachOf(orgId)) === coachUserId;
  const shown = rows.map((row): Json => (row.coach_user_id === coachUserId
    ? { ...row, yours: true, openable: true }
    : head ? { ...row, yours: false, openable: true } : { ...withoutPainDetail(row), yours: false, openable: false }));
  const summary = summariseGroup(rows);
  return {
    ok: true,
    today,
    weeks: 8,
    org: { org_id: orgId, org_name: text(org.rows[0]?.org_name) },
    head_coach: head,
    summary,
    findings: groupFindings(summary, "the team"),
    by_position: summariseBy(rows, (row) => text(row.position), positionLabel),
    by_coach: summariseBy(rows, (row) => text(row.coach_user_id), (key) => coachNames.get(key) || "Coach"),
    athletes: shown.map((row): Json => ({ ...row, coach_name: coachNames.get(text(row.coach_user_id)) || "Coach" })).sort(byAttention)
  };
}

// A team's head coach opening one of the team's athletes who isn't theirs:
// the athlete's own analysis, read as their own coach would see it. Only
// for team ('shared') orgs where this coach is the active head coach and the
// athlete is on the team; null otherwise.
export async function analyseAthleteForHeadCoach(coachUserId: string, athleteUserId: string, weeks: number, today = new Date().toISOString().slice(0, 10)): Promise<Json | null> {
  for (const org of (await headCoachOrgs(coachUserId)).filter((entry) => entry.visibility_mode === "shared")) {
    const member = (await resolveOrgActiveCoachAcceptedAthletes(org.org_id)).find((entry) => entry.athlete_user_id === athleteUserId);
    if (!member) continue;
    const result = await analyseAthleteWindow(athleteUserId, member.coach_user_id, weeks, today);
    return { ...result, viewed_as: "head_coach", org: { org_id: org.org_id, org_name: org.org_name } };
  }
  return null;
}
