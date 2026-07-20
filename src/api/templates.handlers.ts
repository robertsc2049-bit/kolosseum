// DEV NOTE: BETA-18 programme template HTTP handlers.
// These handlers expose product-state operations only. Template prescriptions
// are validated before persistence and materialised through an explicit compile
// seam; coach notes and UI state remain outside deterministic truth.

import type {
  Request,
  Response
} from "express";

import {
  Beta18ProgrammeTemplateError,
  activateCoachProgrammeTemplate,
  archiveCoachProgrammeTemplate,
  duplicateCoachProgrammeTemplate,
  listActiveExerciseOptions,
  listCoachProgrammeTemplates,
  saveCoachProgrammeTemplate
} from "./beta18_programme_template_service.js";
import {
  badRequest
} from "./http_errors.js";

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function rethrowTemplateError(
  error: unknown
): never {
  if (
    error instanceof
      Beta18ProgrammeTemplateError
  ) {
    throw badRequest(
      "BETA18_PROGRAMME_TEMPLATE_INVALID",
      {
        failure_token:
          "beta18_programme_template_invalid",
        reason:
          error.reason
      }
    );
  }

  throw error;
}

export async function getTemplateExercises(
  _req: Request,
  res: Response
) {
  try {
    return res
      .status(200)
      .json({
        ok: true,
        ...listActiveExerciseOptions()
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}

export async function getCoachTemplates(
  req: Request,
  res: Response
) {
  try {
    const coachUserId =
      cleanString(
        req.query.coach_user_id
      );

    const templates =
      await listCoachProgrammeTemplates(
        coachUserId
      );

    return res
      .status(200)
      .json({
        ok: true,
        coach_user_id:
          coachUserId,
        template_count:
          templates.length,
        templates
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}

export async function saveCoachTemplate(
  req: Request,
  res: Response
) {
  try {
    const template =
      await saveCoachProgrammeTemplate(
        req.body
      );

    return res
      .status(201)
      .json({
        ok: true,
        template
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}

export async function activateCoachTemplate(
  req: Request,
  res: Response
) {
  try {
    const template =
      await activateCoachProgrammeTemplate(
        cleanString(
          req.body?.coach_user_id
        ),
        cleanString(
          req.params.template_id
        )
      );

    return res
      .status(200)
      .json({
        ok: true,
        template
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}

export async function archiveCoachTemplate(
  req: Request,
  res: Response
) {
  try {
    const template =
      await archiveCoachProgrammeTemplate(
        cleanString(
          req.body?.coach_user_id
        ),
        cleanString(
          req.params.template_id
        )
      );

    return res
      .status(200)
      .json({
        ok: true,
        template
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}

export async function duplicateCoachTemplate(
  req: Request,
  res: Response
) {
  try {
    const template =
      await duplicateCoachProgrammeTemplate(
        cleanString(
          req.body?.coach_user_id
        ),
        cleanString(
          req.params.template_id
        )
      );

    return res
      .status(201)
      .json({
        ok: true,
        template
      });
  }
  catch (error) {
    rethrowTemplateError(
      error
    );
  }
}
