// DEV NOTE: BETA-19 coach programme workspace HTTP handlers.
// These endpoints expose factual athlete strength references only. They do not
// infer readiness, safety, capability, suitability, or training outcomes.

import type { Request, Response } from "express";

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
import { badRequest } from "./http_errors.js";
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

// FULL-UI-04B athlete-detail service import.
import {
  loadCoachAthleteDetail
} from "./beta19_coach_workspace_service.js";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rethrowWorkspaceError(error: unknown): never {
  if (error instanceof Beta19CoachEventError) {
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
    const coachUserId =
      cleanString(
        req.query.coach_user_id
      );

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
    const coachUserId = cleanString(req.query.coach_user_id);
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
    const coachUserId = cleanString(req.query.coach_user_id);
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
    const coachUserId = cleanString(req.query.coach_user_id);
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
    const profile = await saveAthleteStrengthProfile(req.body);

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
    const preflight =
      await loadPersistedProgrammeStrengthPreflight(
        cleanString(
          req.body?.coach_user_id
        ),
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
    const resolved =
      await reconstructResolvedStrengthLoadSource(
        cleanString(
          req.body?.coach_user_id
        ),
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
    const coachUserId = cleanString(req.query.coach_user_id);
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
    const event = await createCoachEventRecord(req.body);

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
    const coachUserId = cleanString(req.query.coach_user_id);
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
    const result = await assignAthleteProgrammeFromProfile(req.body);

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
    const coachUserId =
      cleanString(
        req.query.coach_user_id
      );

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
