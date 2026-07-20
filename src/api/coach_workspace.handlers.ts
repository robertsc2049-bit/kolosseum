// DEV NOTE: BETA-19 coach programme workspace HTTP handlers.
// These endpoints expose factual athlete strength references only. They do not
// infer readiness, safety, capability, suitability, or training outcomes.

import type { Request, Response } from "express";

import {
  Beta19CoachWorkspaceError,
  listCoachAssignments,
  listConnectedCoachAthletes,
  loadAthleteStrengthProfile,
  saveAthleteStrengthProfile
} from "./beta19_coach_workspace_service.js";
import { badRequest } from "./http_errors.js";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rethrowWorkspaceError(error: unknown): never {
  if (error instanceof Beta19CoachWorkspaceError) {
    throw badRequest("BETA19_COACH_WORKSPACE_INVALID", {
      failure_token: "beta19_coach_workspace_invalid",
      reason: error.reason
    });
  }

  throw error;
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
      profile
    });
  }
  catch (error) {
    rethrowWorkspaceError(error);
  }
}
