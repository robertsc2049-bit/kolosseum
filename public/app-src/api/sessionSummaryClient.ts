// DEV NOTE: FULL-UI-81 neutral session summary - shared by both the athlete
// history detail view (useTrainingHistory.ts) and the coach review detail
// view (useCoachReview.ts), since both read the exact same
// GET /sessions/:sessionId/summary contract (docs/contracts/
// v1_neutral_session_summary_api_contract.md).

import { type JsonRecord, request } from "./transport";

export function loadSessionSummary(sessionId: string): Promise<JsonRecord> {
  return request("GET", `/sessions/${encodeURIComponent(sessionId)}/summary`);
}
