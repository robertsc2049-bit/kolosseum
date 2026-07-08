/**
 * DEV NOTE: S-V1-U-02 coach dashboard shell read model.
 * Purpose: builds a coach-facing product read model for assigned athlete rows only.
 * Boundary: consumes supplied product/auth relationship, assignment, athlete, and session records; it does not import engine code, call engine phases, alter declarations, alter session state, read payment state, or create broad dashboards.
 * Determinism: pure functions over explicit input arrays; no wall-clock, randomness, network, persistence, or process environment reads.
 * Failure: throws CoachDashboardShellError with stable product/auth failure codes when input shape or assigned-only visibility fails.
 */

export const coachDashboardShellContract = Object.freeze({
  slice_id: "S-V1-U-02",
  surface_id: "v1_coach_dashboard_shell",
  permission_surface_id: "coach_dashboard_shell",
  product_permission_state_only: true,
  engine_visible: false
});

export class CoachDashboardShellError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CoachDashboardShellError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const KNOWN_INPUT_KEYS = new Set([
  "actor",
  "relationships",
  "athletes",
  "assignments",
  "sessions"
]);

const KNOWN_ACTOR_KEYS = new Set(["actor_type", "user_id", "coach_id"]);
const KNOWN_RELATIONSHIP_KEYS = new Set([
  "relationship_id",
  "link_id",
  "coach_user_id",
  "coach_id",
  "athlete_user_id",
  "athlete_id",
  "relationship_state",
  "relationship_status",
  "relationship_scope",
  "accepted_at",
  "accepted_at_iso8601",
  "revoked_at",
  "expires_at",
  "scope",
  "product_permission_state_only",
  "engine_visible"
]);

const KNOWN_ATHLETE_KEYS = new Set([
  "athlete_user_id",
  "athlete_id",
  "user_id",
  "display_id",
  "profile_id"
]);

const KNOWN_ASSIGNMENT_KEYS = new Set([
  "assignment_id",
  "relationship_id",
  "assigned_by_coach_id",
  "coach_user_id",
  "assigned_athlete_id",
  "athlete_user_id",
  "template_id",
  "activity_id",
  "assignment_status",
  "assigned_at",
  "compile_input_status",
  "engine_visible"
]);

const KNOWN_SESSION_KEYS = new Set([
  "session_id",
  "athlete_user_id",
  "athlete_id",
  "assignment_id",
  "session_status",
  "status",
  "started_at",
  "started_at_iso8601",
  "last_event_at",
  "last_event_at_iso8601",
  "completed_at",
  "completed_at_iso8601",
  "recorded_event_count",
  "engine_visible"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, code, message) {
  if (!isObject(value)) {
    throw new CoachDashboardShellError(code, message);
  }
}

function assertKnownKeys(object, knownKeys, code, label) {
  for (const key of Object.keys(object)) {
    if (!knownKeys.has(key)) {
      throw new CoachDashboardShellError(code, `${label} contains unknown key.`, { key });
    }
  }
}

function asArray(value, code, label) {
  if (!Array.isArray(value)) {
    throw new CoachDashboardShellError(code, `${label} must be an array.`);
  }

  return value;
}

function readCoachId(actor) {
  return actor.user_id || actor.coach_id || null;
}

function readRelationshipCoachId(relationship) {
  return relationship.coach_user_id || relationship.coach_id || null;
}

function readRelationshipAthleteId(relationship) {
  return relationship.athlete_user_id || relationship.athlete_id || null;
}

function readRelationshipId(relationship) {
  return relationship.relationship_id || relationship.link_id || null;
}

function readRelationshipState(relationship) {
  return relationship.relationship_state || relationship.relationship_status || null;
}

function readAthleteId(athlete) {
  return athlete.athlete_user_id || athlete.athlete_id || athlete.user_id || null;
}

function readAssignmentAthleteId(assignment) {
  return assignment.assigned_athlete_id || assignment.athlete_user_id || null;
}

function readAssignmentCoachId(assignment) {
  return assignment.assigned_by_coach_id || assignment.coach_user_id || null;
}

function readSessionAthleteId(session) {
  return session.athlete_user_id || session.athlete_id || null;
}

function readLastEventAt(session) {
  return session.last_event_at_iso8601 || session.last_event_at || session.completed_at_iso8601 || session.completed_at || session.started_at_iso8601 || session.started_at || null;
}

function readSessionStatus(session) {
  return session.session_status || session.status || "recorded";
}

export function assertCoachDashboardInput(input) {
  assertObject(input, "coach_dashboard_input_invalid", "Coach dashboard input must be an object.");
  assertKnownKeys(input, KNOWN_INPUT_KEYS, "coach_dashboard_unknown_key", "Coach dashboard input");

  assertObject(input.actor, "coach_dashboard_actor_invalid", "Coach dashboard actor must be an object.");
  assertKnownKeys(input.actor, KNOWN_ACTOR_KEYS, "coach_dashboard_actor_unknown_key", "Coach dashboard actor");

  if (input.actor.actor_type !== "coach") {
    throw new CoachDashboardShellError("coach_dashboard_actor_not_coach", "Coach dashboard actor must be coach.");
  }

  const coachId = readCoachId(input.actor);
  if (typeof coachId !== "string" || coachId.length === 0) {
    throw new CoachDashboardShellError("coach_dashboard_coach_id_missing", "Coach dashboard coach id is required.");
  }

  const relationships = asArray(input.relationships, "coach_dashboard_relationships_invalid", "relationships");
  const athletes = asArray(input.athletes, "coach_dashboard_athletes_invalid", "athletes");
  const assignments = asArray(input.assignments, "coach_dashboard_assignments_invalid", "assignments");
  const sessions = asArray(input.sessions, "coach_dashboard_sessions_invalid", "sessions");

  for (const relationship of relationships) {
    assertObject(relationship, "coach_dashboard_relationship_invalid", "Relationship record must be an object.");
    assertKnownKeys(relationship, KNOWN_RELATIONSHIP_KEYS, "coach_dashboard_relationship_unknown_key", "Relationship record");
  }

  for (const athlete of athletes) {
    assertObject(athlete, "coach_dashboard_athlete_invalid", "Athlete record must be an object.");
    assertKnownKeys(athlete, KNOWN_ATHLETE_KEYS, "coach_dashboard_athlete_unknown_key", "Athlete record");
  }

  for (const assignment of assignments) {
    assertObject(assignment, "coach_dashboard_assignment_invalid", "Assignment record must be an object.");
    assertKnownKeys(assignment, KNOWN_ASSIGNMENT_KEYS, "coach_dashboard_assignment_unknown_key", "Assignment record");
  }

  for (const session of sessions) {
    assertObject(session, "coach_dashboard_session_invalid", "Session record must be an object.");
    assertKnownKeys(session, KNOWN_SESSION_KEYS, "coach_dashboard_session_unknown_key", "Session record");
  }

  return {
    actor: input.actor,
    coach_id: coachId,
    relationships,
    athletes,
    assignments,
    sessions
  };
}

export function isAcceptedCoachAthleteDashboardRelationship(relationship, coachId) {
  return readRelationshipCoachId(relationship) === coachId &&
    readRelationshipState(relationship) === "accepted" &&
    relationship.relationship_scope === "individual_coach_athlete" &&
    (relationship.revoked_at === null || relationship.revoked_at === undefined) &&
    (relationship.expires_at === null || relationship.expires_at === undefined) &&
    relationship.engine_visible === false;
}

export function listAssignedCoachAthleteIds(input) {
  const checked = assertCoachDashboardInput(input);
  const assigned = [];

  for (const relationship of checked.relationships) {
    if (isAcceptedCoachAthleteDashboardRelationship(relationship, checked.coach_id)) {
      const athleteId = readRelationshipAthleteId(relationship);
      if (typeof athleteId === "string" && athleteId.length > 0 && !assigned.includes(athleteId)) {
        assigned.push(athleteId);
      }
    }
  }

  return assigned.sort();
}

export function buildCoachAssignedAthleteRows(input) {
  const checked = assertCoachDashboardInput(input);
  const rows = [];

  const acceptedRelationships = checked.relationships
    .filter((relationship) => isAcceptedCoachAthleteDashboardRelationship(relationship, checked.coach_id))
    .sort((a, b) => String(readRelationshipAthleteId(a)).localeCompare(String(readRelationshipAthleteId(b))));

  for (const relationship of acceptedRelationships) {
    const athleteUserId = readRelationshipAthleteId(relationship);
    if (typeof athleteUserId !== "string" || athleteUserId.length === 0) {
      continue;
    }

    const athlete = checked.athletes.find((candidate) => readAthleteId(candidate) === athleteUserId) || {
      athlete_user_id: athleteUserId
    };

    const relationshipId = readRelationshipId(relationship);

    const assignmentIds = checked.assignments
      .filter((assignment) => {
        return readAssignmentAthleteId(assignment) === athleteUserId &&
          readAssignmentCoachId(assignment) === checked.coach_id &&
          assignment.relationship_id === relationshipId &&
          assignment.engine_visible === false;
      })
      .map((assignment) => assignment.assignment_id)
      .filter((assignmentId) => typeof assignmentId === "string" && assignmentId.length > 0)
      .sort();

    const athleteSessions = checked.sessions
      .filter((session) => readSessionAthleteId(session) === athleteUserId && session.engine_visible === false)
      .slice()
      .sort((a, b) => String(readLastEventAt(b) || "").localeCompare(String(readLastEventAt(a) || "")));

    const lastSession = athleteSessions[0] || null;

    rows.push(Object.freeze({
      athlete_user_id: athleteUserId,
      athlete_display_id: athlete.display_id || athlete.profile_id || athleteUserId,
      relationship_id: relationshipId,
      assignment_ids: Object.freeze(assignmentIds),
      assignment_count: assignmentIds.length,
      recorded_session_count: athleteSessions.length,
      last_recorded_event_at: lastSession ? readLastEventAt(lastSession) : null,
      last_recorded_session_status: lastSession ? readSessionStatus(lastSession) : null,
      review_surfaces: Object.freeze([
        "factual_history",
        "session_artefacts",
        "live_session_status"
      ]),
      product_permission_state_only: true,
      engine_visible: false
    }));
  }

  return Object.freeze(rows);
}

export function buildCoachDashboardShell(input) {
  const checked = assertCoachDashboardInput(input);
  const rows = buildCoachAssignedAthleteRows(input);

  return Object.freeze({
    slice_id: coachDashboardShellContract.slice_id,
    surface_id: coachDashboardShellContract.surface_id,
    permission_surface_id: coachDashboardShellContract.permission_surface_id,
    actor: Object.freeze({
      actor_type: "coach",
      coach_id: checked.coach_id
    }),
    assigned_athlete_rows: rows,
    visible_athlete_count: rows.length,
    copy_surface_id: "v1_coach_dashboard_shell",
    product_permission_state_only: true,
    engine_visible: false
  });
}

export function tryBuildCoachDashboardShell(input) {
  try {
    return Object.freeze({
      ok: true,
      body: buildCoachDashboardShell(input)
    });
  } catch (error) {
    if (error instanceof CoachDashboardShellError) {
      return Object.freeze({
        ok: false,
        code: error.code,
        details: error.details
      });
    }

    throw error;
  }
}

export function compileIgnoringCoachDashboardShell(compileInput) {
  return Object.freeze({
    compile_input: compileInput,
    coach_dashboard_shell_visible_to_engine: false,
    engine_visible: false
  });
}