// DEV NOTE: Attendance events (slice 3) - team-mode (shared-visibility)
// org-wide events. This is new authorization surface: confirmed by
// research that no coach-facing code path anywhere else lets a coach
// read or act on another coach's athletes within the same org (the
// only three files that cross coaches for athlete-scoped data -
// org_visibility_service.ts, org_athlete_messaging_service.ts,
// org_progress_rollup_service.ts - are all org-OWNER-facing, gated by
// product_organisations.owner_user_id, never coach-facing). This file
// is the first coach-facing one, and it exists ONLY for event-attendance
// invite/roster purposes - it is deliberately kept out of
// org_visibility_service.ts, whose own DEV NOTE names an exact, closed
// list of owner-facing files it must stay limited to.
//
// Gate: an ACTIVE row in product_org_coach_memberships for this coach
// and org, AND the org's visibility_mode must be 'shared' - mirrors
// listOrganisationRosterForCoach's own gate (org_roster_service.ts),
// except this throws on a failed visibility_mode check rather than
// quietly returning an empty list, since this gates event CREATION (a
// write), not a read.
//
// Per the user's explicit product decision: the creating coach sees
// FULL identity for every invited athlete on the org-wide roster,
// including athletes belonging to OTHER coaches in the org - no
// aggregate-only fallback here (unlike org_progress_rollup_service.ts's
// k-anonymity aggregate for gym-mode). The roster is resolved fresh at
// call time (never trusted from a stale client copy), and because
// attendance_event_invite rows are written once at event-creation time
// (see attendance_event_invite_service.ts), the resulting invite list is
// naturally a point-in-time snapshot - a coach who joins the org later
// never retroactively appears on a past event.

import { pool } from "../db/pool.js";
import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";

type JsonRecord = Record<string, unknown>;

export class AttendanceEventOrgInviteError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`attendance_event_${reason}`);
    this.name = "AttendanceEventOrgInviteError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Returns the cleaned org_id on success. Throws if the org doesn't
// exist, the coach isn't an ACTIVE member of it, or the org isn't in
// shared-visibility mode - every failure is a hard reject, never a
// quiet no-op, since this gates a write.
export async function requireActiveSharedOrgMembership(
  coachUserIdInput: string,
  orgIdInput: unknown
): Promise<string> {
  const coachUserId = cleanString(coachUserIdInput);
  const orgId = cleanString(orgIdInput);
  if (!coachUserId) {
    throw new AttendanceEventOrgInviteError("coach_identity_required", 401);
  }
  if (!orgId) {
    throw new AttendanceEventOrgInviteError("org_identity_required");
  }

  const orgResult = await pool.query(
    `SELECT visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const org = orgResult.rows[0];
  if (!org) {
    throw new AttendanceEventOrgInviteError("org_not_found", 404);
  }

  const membershipResult = await pool.query(
    `SELECT 1 FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 AND membership_status = 'active' LIMIT 1`,
    [orgId, coachUserId]
  );
  if (!membershipResult.rows[0]) {
    throw new AttendanceEventOrgInviteError("org_membership_required", 403);
  }

  if (org.visibility_mode !== "shared") {
    throw new AttendanceEventOrgInviteError("org_not_shared_visibility", 403);
  }

  return orgId;
}

async function activeCoachIdsForOrg(orgId: string): Promise<readonly string[]> {
  const result = await pool.query(
    `SELECT coach_user_id FROM product_org_coach_memberships WHERE org_id = $1 AND membership_status = 'active'`,
    [orgId]
  );
  return result.rows.map((row) => cleanString(row.coach_user_id)).filter(Boolean);
}

export type SharedOrgAthleteOption = Readonly<{
  athlete_user_id: string;
  display_name: string;
  email: string | null;
  coach_user_id: string;
}>;

// Every currently-accepted athlete belonging to any ACTIVE coach in this
// shared-mode org, full identity - reuses listConnectedCoachAthletes
// (the same per-coach accepted-roster resolver slice 1 already uses)
// once per active coach, rather than hand-rolling a cross-coach SQL
// query that would have to re-derive that function's relationship-
// expiry logic from scratch. An org's active-coach count is small
// (a team/gym roster), so N per-coach calls is not a real cost.
async function resolveSharedOrgAcceptedAthletes(orgId: string): Promise<readonly SharedOrgAthleteOption[]> {
  const coachIds = await activeCoachIdsForOrg(orgId);
  if (coachIds.length === 0) return Object.freeze([]);

  const perCoach = await Promise.all(coachIds.map(async (coachId) => {
    const athletes = await listConnectedCoachAthletes(coachId);
    return athletes.map((athlete: JsonRecord) => Object.freeze({
      athlete_user_id: cleanString(athlete.athlete_user_id),
      display_name: cleanString(athlete.display_name) || cleanString(athlete.athlete_user_id),
      email: cleanString(athlete.email) || null,
      coach_user_id: coachId
    }));
  }));

  const seen = new Set<string>();
  const deduped: SharedOrgAthleteOption[] = [];
  for (const athlete of perCoach.flat()) {
    if (!athlete.athlete_user_id || seen.has(athlete.athlete_user_id)) continue;
    seen.add(athlete.athlete_user_id);
    deduped.push(athlete);
  }
  return Object.freeze(deduped);
}

// Coach-facing read for the event-creation athlete picker: every
// currently-accepted athlete across the whole shared-mode org, full
// identity, gated by the same active-membership + shared-visibility
// check as creation itself.
export async function listSharedOrgAcceptedAthletes(
  coachUserIdInput: string,
  orgIdInput: unknown
): Promise<readonly SharedOrgAthleteOption[]> {
  const orgId = await requireActiveSharedOrgMembership(coachUserIdInput, orgIdInput);
  return resolveSharedOrgAcceptedAthletes(orgId);
}

// Validates a requested invite list is fully within the org's current
// accepted-athlete roster (also re-validates active-membership +
// shared-visibility). Mirrors assertAthletesCurrentlyAccepted's shape
// in attendance_event_invite_service.ts, scoped to the whole org's
// roster instead of one coach's own.
export async function assertOrgAthletesCurrentlyAccepted(
  coachUserIdInput: string,
  orgIdInput: unknown,
  athleteUserIdsInput: unknown
): Promise<readonly string[]> {
  const orgId = await requireActiveSharedOrgMembership(coachUserIdInput, orgIdInput);

  if (!Array.isArray(athleteUserIdsInput) || athleteUserIdsInput.length === 0) {
    throw new AttendanceEventOrgInviteError("invite_athlete_ids_required");
  }
  const requestedAthleteIds = [...new Set(athleteUserIdsInput.map((value) => cleanString(value)).filter(Boolean))];
  if (requestedAthleteIds.length === 0) {
    throw new AttendanceEventOrgInviteError("invite_athlete_ids_required");
  }

  const roster = await resolveSharedOrgAcceptedAthletes(orgId);
  const rosterIds = new Set(roster.map((athlete) => athlete.athlete_user_id));
  for (const athleteId of requestedAthleteIds) {
    if (!rosterIds.has(athleteId)) {
      throw new AttendanceEventOrgInviteError("org_invite_athlete_not_accepted", 403);
    }
  }

  return Object.freeze(requestedAthleteIds);
}
