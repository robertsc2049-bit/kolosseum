import {
  createGdprDeleteQueueRequest,
  stableGdprDeleteQueueJson
} from "../v1GdprDeleteQueue.mjs";

// DEV NOTE: Transport adapter only. It records GDPR deletion requests through
// the legal/product queue contract and must not hard-delete records, import the
// engine, call providers, or mutate deterministic truth.

export const GDPR_DELETE_QUEUE_API_SURFACE_ID = "gdpr_delete_queue_api";

export function handleGdprDeleteQueueApiRequest(request) {
  const method = request?.method ?? "POST";

  if (method !== "POST") {
    return {
      status: 405,
      body: {
        ok: false,
        api_surface_id: GDPR_DELETE_QUEUE_API_SURFACE_ID,
        code: "gdpr_delete_method_not_allowed",
        copy_id: "gdpr_delete_queue.blocked",
        request_recorded: false,
        hard_delete_performed: false,
        engine_visible: false,
        engine_truth_changed: false,
        retroactive_engine_mutation: false
      }
    };
  }

  const result = createGdprDeleteQueueRequest(request?.body ?? {});

  return {
    status: result.ok === true ? 202 : 403,
    body: {
      api_surface_id: GDPR_DELETE_QUEUE_API_SURFACE_ID,
      ...result
    }
  };
}

export function handleGdprDeleteQueueApiJson(request) {
  const response = handleGdprDeleteQueueApiRequest(request);

  return {
    status: response.status,
    body_json: stableGdprDeleteQueueJson(response.body)
  };
}