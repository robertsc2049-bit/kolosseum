// DEV NOTE: BETA-19 coach programme workspace HTTP handlers.
// These endpoints expose factual athlete strength references only. They do not
// infer readiness, safety, capability, suitability, or training outcomes.

import type { Request, Response } from "express";

import {
  authenticatedCoach,
  cookieValue
} from "./coach_session_auth.js";
import {
  Beta19CoachWorkspaceError,
  listCoachAssignments,
  listCoachAthleteRelationships,
  listConnectedCoachAthletes,
  loadAthleteStrengthProfile,
  loadPersistedProgrammeStrengthPreflight,
  reconstructResolvedStrengthLoadSource,
  saveAthleteStrengthProfile
} from "./beta19_coach_workspace_service.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized
} from "./http_errors.js";
import {
  EventProgrammeCompilerError,
  compileEventProgrammeCalendar
} from "./event_programme_compiler_service.js";
import {
  Beta19CoachEventError,
  assignAthleteProgrammeFromProfile,
  createCoachEvent as createCoachEventRecord,
  listAthleteEventLinks,
  listCoachEvents
} from "./beta19_coach_event_service.js";
import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import {
  RelationshipInvitationError,
  acceptRelationshipInvitation,
  createRelationshipInvitationByEmail,
  listPendingRelationshipInvitationsForAthlete
} from "./relationship_invitation_service.js";

// FULL-UI-04B athlete-detail service import.
import {
  loadCoachAthleteDetail
} from "./beta19_coach_workspace_service.js";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rethrowWorkspaceError(error: unknown): never {
  if (error instanceof Beta19CoachEventError) {
    if (error.reason === "event_link_date_conflict") {
      throw conflict("EVENT_LINK_DATE_CONFLICT", {
        failure_token: "event_link_date_conflict",
        reason: error.reason
      });
    }

    throw badRequest("BETA19_COACH_EVENT_INVALID", {
      failure_token: "beta19_coach_event_invalid",
      reason: error.reason
    });
  }

  if (error instanceof EventProgrammeCompilerError) {
    throw badRequest("EVENT_PROGRAMME_COMPILER_INVALID", {
      failure_token: "event_programme_compiler_invalid",
      reason: error.reason
    });
  }

  if (error instanceof Beta19CoachWorkspaceError) {
    if (
      error.reason ===
        "strength_reference_profile_stale_write"
    ) {
      throw conflict(
        "STRENGTH_REFERENCE_PROFILE_STALE_WRITE",
        {
          failure_token:
            "strength_reference_profile_stale_write",
          reason:
            error.reason
        }
      );
    }

    throw badRequest("BETA19_COACH_WORKSPACE_INVALID", {
      failure_token: "beta19_coach_workspace_invalid",
      reason: error.reason
    });
  }

  throw error;
}


export async function getCoachAthleteRelationships(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);

    const relationships =
      await listCoachAthleteRelationships(
        coachUserId
      );

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      relationships
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function getConnectedCoachAthletes(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);
    const athletes = await listConnectedCoachAthletes(coachUserId);

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      athletes
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function getCoachAssignments(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);
    const assignments = await listCoachAssignments(coachUserId);

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      assignments
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function getAthleteStrengthProfile(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);
    const athleteUserId = cleanString(req.query.athlete_user_id);

    const profile = await loadAthleteStrengthProfile(
      coachUserId,
      athleteUserId
    );

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      profile
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function saveAthleteStrengthProfileHandler(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const profile = await saveAthleteStrengthProfile({
      ...req.body,
      coach_user_id: coachUserId
    });

    return res.status(201).json({
      ok: true,
      profile,
      lifecycle:
        profile
          .strength_reference_lifecycle ??
        null
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function preflightAthleteStrengthProfile(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const preflight =
      await loadPersistedProgrammeStrengthPreflight(
        coachUserId,
        cleanString(
          req.body?.athlete_user_id
        ),
        cleanString(
          req.body?.template_id
        ),
        cleanString(
          req.body?.as_of_date
        ) ||
        new Date()
          .toISOString()
          .slice(0, 10)
      );

    return res.status(200).json({
      ok: true,
      preflight
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function resolveAthleteStrengthLoad(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const resolved =
      await reconstructResolvedStrengthLoadSource(
        coachUserId,
        cleanString(
          req.body?.athlete_user_id
        ),
        cleanString(
          req.body?.exercise_id
        ),
        Number(
          req.body?.percentage
        ),
        {
          target_unit:
            cleanString(
              req.body?.target_unit
            ),
          rounding_increment:
            req.body
              ?.rounding_increment,
          as_of_date:
            cleanString(
              req.body?.as_of_date
            )
        }
      );

    return res.status(200).json({
      ok: true,
      resolved
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}


export async function previewEventProgrammeCalendar(
  req: Request,
  res: Response
) {
  try {
    const compile = compileEventProgrammeCalendar(req.body);

    return res.status(200).json({
      ok: true,
      compile
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}


export async function getCoachEvents(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);
    const events = await listCoachEvents(coachUserId);

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      events
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function createCoachEventHandler(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const event = await createCoachEventRecord({
      ...req.body,
      coach_user_id: coachUserId
    });

    return res.status(201).json({
      ok: true,
      event
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function getAthleteEventLinks(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);
    const athleteUserId = cleanString(req.query.athlete_user_id);
    const links = await listAthleteEventLinks(
      coachUserId,
      athleteUserId
    );

    return res.status(200).json({
      ok: true,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      links
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

export async function createAthleteProfileAssignment(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const result = await assignAthleteProgrammeFromProfile({
      ...req.body,
      coach_user_id: coachUserId
    });

    return res.status(201).json({
      ok: true,
      assignment: result.assignment,
      event_link: result.event_link
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

// FULL-UI-04B athlete-detail HTTP surface.
// FUNCTION NOTE:
// Purpose: Returns one accepted coach-athlete factual detail projection.
// Boundary: Read-only product/runtime data; no engine call or inferred coaching state.
export async function getCoachAthleteDetail(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, false);

    const athleteUserId =
      cleanString(
        req.query.athlete_user_id
      );

    const detail =
      await loadCoachAthleteDetail(
        coachUserId,
        athleteUserId
      );

    return res.status(200).json({
      ok: true,
      detail
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}

// FULL-UI-24 lawful coach-athlete invitation, by email only - never a
// client-supplied athlete_user_id - so an athlete never has to hand a coach
// an internal id, and a coach never has to type one either.

function athleteSessionToken(req: Request): string {
  const token = cookieValue(req, PRODUCT_SESSION_COOKIE);
  if (!token) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", {
      failure_token: "account_session_missing"
    });
  }
  return token;
}

async function authenticatedAthlete(
  req: Request,
  mutation: boolean
): Promise<string> {
  const token = athleteSessionToken(req);

  try {
    if (mutation) {
      assertProductCsrf(token, req.get("x-kolosseum-csrf"));
    }
    const session = await resolveProductSession(token);
    if (session.account_row.actor_type !== "athlete") {
      throw forbidden("ATHLETE_ACCOUNT_REQUIRED", {
        failure_token: "athlete_account_required"
      });
    }
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      throw error.status === 401
        ? unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code })
        : forbidden(error.code, { failure_token: error.code });
    }
    throw error;
  }
}

function rethrowInvitationError(error: unknown): never {
  if (error instanceof RelationshipInvitationError) {
    if (error.status === 404) throw notFound(error.message, { failure_token: error.reason });
    if (error.status === 403) throw forbidden(error.message, { failure_token: error.reason });
    if (error.status === 409) throw conflict(error.message, { failure_token: error.reason });
    throw badRequest(error.message, { failure_token: error.reason });
  }
  throw error;
}

// FUNCTION NOTE:
// Purpose: Coach invites an athlete they already know the email of - a real
// human identifier, never the athlete's internal opaque user_id.
// Boundary: Resolves the email to an active athlete account server-side;
// persists only the existing beta17_coach_relationship transition record.
export async function createCoachRelationshipInvitationHandler(
  req: Request,
  res: Response
) {
  try {
    const coachUserId = await authenticatedCoach(req, true);
    const relationship = await createRelationshipInvitationByEmail(
      coachUserId,
      isRecord(req.body) ? req.body.athlete_email : undefined
    );

    return res.status(201).json({
      ok: true,
      relationship
    });
  }
  catch (error) {
    rethrowInvitationError(error);
  }
}

// FUNCTION NOTE:
// Purpose: Athlete reads their own pending coach invitations.
// Boundary: Athlete identity comes only from the resolved session cookie.
export async function listAthleteRelationshipInvitationsHandler(
  req: Request,
  res: Response
) {
  try {
    const athleteUserId = await authenticatedAthlete(req, false);
    const invitations = await listPendingRelationshipInvitationsForAthlete(athleteUserId);

    return res.status(200).json({
      ok: true,
      invitations
    });
  }
  catch (error) {
    rethrowInvitationError(error);
  }
}

// FUNCTION NOTE:
// Purpose: Athlete accepts one of their own pending invitations, naming only
// the relationship_id their own invitations list already gave them.
// Boundary: Server independently verifies the invitation names this
// athlete's session and is still pending before writing an accepted record.
export async function acceptAthleteRelationshipInvitationHandler(
  req: Request,
  res: Response
) {
  try {
    const athleteUserId = await authenticatedAthlete(req, true);
    const relationship = await acceptRelationshipInvitation(
      athleteUserId,
      req.params.relationship_id
    );

    return res.status(201).json({
      ok: true,
      relationship
    });
  }
  catch (error) {
    rethrowInvitationError(error);
  }
}
