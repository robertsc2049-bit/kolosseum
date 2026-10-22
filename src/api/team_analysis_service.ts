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
import { groupFindings, squadTesting, summariseBy, summariseGroup, withoutPainDetail } from "./team_analysis_metrics.js";
import { activeStandDown } from "./medical_stand_down_service.js";
import { getAthletePainFlags } from "./pain_flag_service.js";

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export type TeamMember = Readonly<{ athlete_user_id: string; display_name: string; coach_user_id: string; position?: string | null }>;

// Today's availability: unavailable (an active stand-down), modified (an
// active pain flag) or available - with the reason, which only the
// athlete's own coach or the head coach is shown (withoutPainDetail drops it).
export async function availabilityOf(athleteUserId: string): Promise<Json> {
  const [standDown, flags] = await Promise.all([
    activeStandDown(athleteUserId).catch(() => null),
    getAthletePainFlags(athleteUserId).catch(() => ({ flags: [] }))
  ]);
  if (standDown) return { status: "unavailable", reason: standDown.reason === "head_injury" ? "Head injury stand-down" : "Medical stand-down", until: standDown.until_date };
  const list = (Array.isArray((flags as Json).flags) ? (flags as Json).flags : []) as Json[];
  if (list.length) return { status: "modified", reason: `Pain flagged: ${list.map((flag) => String(flag.where ?? "")).filter(Boolean).join(", ")}` };
  return { status: "available" };
}

// Run a few at a time: a 50-athlete squad is 50 analyses, each several reads.
async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let index = 0; index < items.length; index += size) out.push(...(await Promise.all(items.slice(index, index + size).map(work))));
  return out;
}

// A recently worked-out team view is reused for a minute (switching tabs
// shouldn't re-run 50 analyses).
const recent = new Map<string, { at: number; value: Promise<Json> }>();
export function cachedForAMinute(key: string, work: () => Promise<Json>): Promise<Json> {
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = work();
  recent.set(key, { at: Date.now(), value });
  value.catch(() => recent.delete(key));
  if (recent.size > 200) recent.delete(recent.keys().next().value as string);
  return value;
}
export function __clearTeamCacheForTests(): void { recent.clear(); }

// Each member's 8-week analysis row (the same row a coach's own roster uses),
// with today's availability.
export async function analyseMembers(members: readonly TeamMember[], today: string): Promise<Json[]> {
  return inBatches(members, 6, async (member) => {
    const name = member.display_name || member.athlete_user_id;
    try {
      const [result, availability] = await Promise.all([analyseAthleteWindow(member.athlete_user_id, member.coach_user_id, 8, today), availabilityOf(member.athlete_user_id)]);
      const findings = (result.findings ?? []) as Json[];
      return { ...rosterRowFor(member.athlete_user_id, name, { ...result, findings, attention: result.attention }), coach_user_id: member.coach_user_id, position: member.position ?? null, availability };
    }
    catch {
      return { athlete_user_id: member.athlete_user_id, display_name: name, coach_user_id: member.coach_user_id, position: member.position ?? null, attention: null, findings: [], unavailable: true };
    }
  });
}

export async function displayNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const result = await pool.query("SELECT user_id, display_name FROM product_accounts WHERE user_id = ANY($1::text[])", [[...new Set(userIds)]]).catch(() => null);
  return new Map((result?.rows ?? []).map((row) => [String(row.user_id), text(row.display_name)]));
}

// Emails, so a coach entering a GPS export can match rows to the athletes
// they can open (two athletes can share a name).
async function emailsOf(userIds: readonly string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const result = await pool.query("SELECT user_id, email_canonical FROM product_accounts WHERE user_id = ANY($1::text[])", [[...new Set(userIds)]]);
  return new Map((result?.rows ?? []).map((row) => [String(row.user_id), text(row.email_canonical)]));
}

const positionLabel = (position: string) => (position === "unknown" ? "No position set" : position.replaceAll("_", " ").replace(/^./u, (c) => c.toUpperCase()));
const byAttention = (a: Json, b: Json) => Number(b.attention ?? -1) - Number(a.attention ?? -1) || String(a.display_name).localeCompare(String(b.display_name));

export async function analyseTeamForCoach(coachUserId: string, orgId: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  // Access is checked every time; only the work is reused.
  const roster = await listOrgAthleteRosterForCoach(coachUserId, orgId);
  // Who's head coach is part of the key: naming or clearing one shows at once...
  const head = (await headCoachOf(orgId)) === coachUserId;
  // ...and so is the roster: someone joining or leaving shows at once.
  const members = roster.map((member) => `${member.athlete_user_id}:${member.coach_user_id}:${member.position ?? ""}`).sort().join(",");
  return cachedForAMinute(`team|${orgId}|${coachUserId}|${head}|${today}|${members}`, () => buildTeamView(coachUserId, orgId, roster, today));
}

async function buildTeamView(coachUserId: string, orgId: string, roster: readonly TeamMember[], today: string): Promise<Json> {
  const org = await pool.query("SELECT org_name FROM product_organisations WHERE org_id = $1", [orgId]);
  const rows = await analyseMembers(roster, today);
  const coachNames = await displayNames(rows.map((row) => text(row.coach_user_id)));
  // Your own athletes in full; a teammate's pain as a flag only - unless
  // you're the team's head coach, who sees and opens every athlete in full.
  const head = (await headCoachOf(orgId)) === coachUserId;
  const emails = await emailsOf(rows.filter((row) => head || row.coach_user_id === coachUserId).map((row) => text(row.athlete_user_id)));
  const email = (row: Json) => emails.get(text(row.athlete_user_id)) || null;
  const shown = rows.map((row): Json => (row.coach_user_id === coachUserId
    ? { ...row, email: email(row), yours: true, openable: true }
    : head ? { ...row, email: email(row), yours: false, openable: true } : { ...withoutPainDetail(row), yours: false, openable: false }));
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
    testing: squadTesting(rows),
    athletes: shown.map((row): Json => ({ ...row, coach_name: coachNames.get(text(row.coach_user_id)) || "Coach" })).sort(byAttention)
  };
}

// A team's head coach opening one of the team's athletes who isn't theirs:
// the athlete's own analysis, read as their own coach would see it. Only
// for team ('shared') orgs where this coach is the active head coach and the
// athlete is on the team; null otherwise.
// The athlete's own coach, when this coach is head coach of a team
// ('shared') org the athlete is in; null otherwise.
export async function headCoachTeamMemberCoach(coachUserId: string, athleteUserId: string): Promise<string | null> {
  for (const org of (await headCoachOrgs(coachUserId)).filter((entry) => entry.visibility_mode === "shared")) {
    const member = (await resolveOrgActiveCoachAcceptedAthletes(org.org_id)).find((entry) => entry.athlete_user_id === athleteUserId);
    if (member) return member.coach_user_id;
  }
  return null;
}

export async function analyseAthleteForHeadCoach(coachUserId: string, athleteUserId: string, weeks: number, today = new Date().toISOString().slice(0, 10)): Promise<Json | null> {
  for (const org of (await headCoachOrgs(coachUserId)).filter((entry) => entry.visibility_mode === "shared")) {
    const member = (await resolveOrgActiveCoachAcceptedAthletes(org.org_id)).find((entry) => entry.athlete_user_id === athleteUserId);
    if (!member) continue;
    const result = await analyseAthleteWindow(athleteUserId, member.coach_user_id, weeks, today);
    return { ...result, viewed_as: "head_coach", org: { org_id: org.org_id, org_name: org.org_name } };
  }
  return null;
}
