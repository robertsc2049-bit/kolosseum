// DEV NOTE: Thin S-V1-40 API adapter. It maps explicit request bodies to the
// factual athlete-history read model and UI model only. It must not query hidden
// globals, write storage, append runtime events, call engine internals, or add
// post-v1 aggregate or list-order scope.

import {
  AthleteFactualHistoryError,
  buildAthleteFactualHistoryReadModel,
  buildAthleteFactualHistoryViewModel
} from "../athleteFactualHistory.mjs";

export function handleAthleteFactualHistoryRequest(request) {
  const method = String(request?.method ?? "POST").toUpperCase();

  if (method !== "POST") {
    return {
      status: 405,
      body: {
        ok: false,
        error: {
          code: "ATHLETE_FACTUAL_HISTORY_METHOD_NOT_ALLOWED",
          message_copy_id: "ATHLETE_FACTUAL_HISTORY_PERMISSION_DENIED"
        }
      }
    };
  }

  try {
    const readModel = buildAthleteFactualHistoryReadModel(request?.body ?? {});
    const viewModel = buildAthleteFactualHistoryViewModel(readModel);

    return {
      status: 200,
      body: {
        ok: true,
        read_model: readModel,
        view_model: viewModel
      }
    };
  } catch (error) {
    if (error instanceof AthleteFactualHistoryError) {
      return {
        status: 403,
        body: {
          ok: false,
          error: {
            code: error.code,
            reason: error.reason,
            product_auth_failure: error.product_auth_failure,
            product_permission_state_only: error.product_permission_state_only,
            engine_decision: error.engine_decision,
            engine_visible: error.engine_visible,
            copy_id: error.copy_id,
            details: error.details
          }
        }
      };
    }

    throw error;
  }
}
