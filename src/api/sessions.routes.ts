
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

import type { Request } from "express";
import { Router } from "express";

import { asyncHandler } from "./async_handler.js";
import { cookieValue } from "./coach_session_auth.js";
import { forbidden, notFound, unauthorized } from "./http_errors.js";
import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  resolveProductSession
} from "./product_account_service.js";
import { createGetNeutralSessionSummaryHandler } from "./sessions.summary.handlers.js";
import {
  loadSessionOwnership,
  sessionSummaryEventsStore,
  sessionSummaryStateStore
} from "./sessions.summary.adapters.js";
import {
  appendRuntimeEvent,
  createBeta16Acknowledgement,
  createBeta16Auth,
  createBeta16Declaration,
  createBeta17Assignment,
  createBeta17CoachProfile,
  createBeta17Relationship,
  getAthleteHistoryDetail,
  getAthleteHistoryExport,
  getAthleteTodayView,
  getBeta17CoachArtefacts,
  getBetaAthleteHistory,
  getDecisionSummaryByRunId,
  getSessionState,
  listRuntimeEvents,
  planSession,
  postSessionSubstitutionRequest,
  startSession
} from "./sessions.handlers.js";

export const sessionsRouter = Router();

async function requireSessionSummaryAccess(request: Request, sessionId: string): Promise<void> {
  const ownership = await loadSessionOwnership(sessionId);
  if (!ownership) throw notFound("Session not found");

  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  let callerUserId: string;
  try {
    const session = await resolveProductSession(rawToken);
    callerUserId = session.account_row.user_id;
  } catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) {
        throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code });
      }
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: error.code });
    }
    throw error;
  }

  if (
    callerUserId !== ownership.beta_subject_user_id &&
    callerUserId !== ownership.beta_coach_user_id
  ) {
    throw forbidden("SESSION_SUMMARY_ACCESS_DENIED", { failure_token: "session_summary_access_denied" });
  }
}

sessionsRouter.post(
  "/beta-auth",
  asyncHandler(createBeta16Auth)
);

sessionsRouter.post(
  "/beta-acknowledgement",
  asyncHandler(
    createBeta16Acknowledgement
  )
);

sessionsRouter.post(
  "/beta-declaration",
  asyncHandler(createBeta16Declaration)
);

sessionsRouter.post(
  "/beta-coach-profile",
  asyncHandler(createBeta17CoachProfile)
);

sessionsRouter.post(
  "/beta-coach-relationship",
  asyncHandler(createBeta17Relationship)
);

sessionsRouter.post(
  "/beta-coach-assignment",
  asyncHandler(createBeta17Assignment)
);

sessionsRouter.post(
  "/beta-coach-artefacts",
  asyncHandler(getBeta17CoachArtefacts)
);

sessionsRouter.post(
  "/beta-athlete-history",
  asyncHandler(getBetaAthleteHistory)
);

sessionsRouter.post(
  "/beta-athlete-history-detail",
  asyncHandler(getAthleteHistoryDetail)
);

sessionsRouter.post(
  "/beta-athlete-history-export",
  asyncHandler(getAthleteHistoryExport)
);

sessionsRouter.post(
  "/beta-athlete-today",
  asyncHandler(getAthleteTodayView)
);

sessionsRouter.post("/plan", asyncHandler(planSession));
sessionsRouter.get("/decision-summary/:run_id", asyncHandler(getDecisionSummaryByRunId));
sessionsRouter.post("/:session_id/start", asyncHandler(startSession));
sessionsRouter.post("/:session_id/events", asyncHandler(appendRuntimeEvent));
sessionsRouter.get("/:session_id/events", asyncHandler(listRuntimeEvents));
sessionsRouter.get("/:session_id/state", asyncHandler(getSessionState));
sessionsRouter.post("/:session_id/substitution-request", asyncHandler(postSessionSubstitutionRequest));

// Deliberately :sessionId (not :session_id, unlike every sibling route above)
// to match docs/contracts/v1_neutral_session_summary_api_contract.md's pinned
// literal route spec exactly.
sessionsRouter.get(
  "/:sessionId/summary",
  asyncHandler(async (request, response) => {
    const sessionId = typeof request.params.sessionId === "string" ? request.params.sessionId : "";

    await requireSessionSummaryAccess(request, sessionId);

    const handler = createGetNeutralSessionSummaryHandler({
      sessionStateStore: sessionSummaryStateStore,
      sessionEventsStore: sessionSummaryEventsStore
    });

    return handler({ params: { sessionId } }, response);
  })
);
