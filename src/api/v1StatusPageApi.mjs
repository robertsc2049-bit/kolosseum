import {
  renderStatusPage,
  serializeStatusPage
} from "../v1StatusPage.mjs";

// DEV NOTE: Transport adapter only. It maps a GET-shaped request to a factual
// public status page view model. It must not import engine code, call monitoring
// providers, alter training flow, or state any user safety/readiness/effect claim.

export const STATUS_PAGE_API_SURFACE_ID = "public_status_page_api";

export function handleStatusPageApiRequest(request = {}) {
  const method = request?.method ?? "GET";

  if (method !== "GET") {
    return {
      status: 405,
      body: {
        ok: false,
        api_surface_id: STATUS_PAGE_API_SURFACE_ID,
        code: "status_page_method_not_allowed",
        renderable: false,
        service_state_only: true,
        engine_visible: false,
        engine_truth_changed: false,
        compile_output_changed: false,
        training_flow_changed: false,
        declaration_truth_changed: false,
        user_safety_claim: false,
        user_readiness_claim: false,
        training_effectiveness_claim: false,
        service_readiness_claim: false,
        service_reliability_guarantee: false,
        provider_call_performed: false,
        external_monitoring_call_performed: false
      }
    };
  }

  const result = renderStatusPage({
    request_id: request?.request_id ?? "status_page_request",
    requested_at: request?.requested_at ?? "2026-06-17T00:00:00.000Z",
    route: request?.path ?? request?.route ?? "/status",
    service_state: request?.service_state ?? "unknown",
    uptime_window_minutes: request?.uptime_window_minutes ?? 60,
    component_states: request?.component_states,
    incident_records: request?.incident_records,
    deterministic_probe: request?.deterministic_probe
  });

  return {
    status: result.ok === true ? 200 : 404,
    body: {
      api_surface_id: STATUS_PAGE_API_SURFACE_ID,
      ...result
    }
  };
}

export function handleStatusPageApiJson(request = {}) {
  const response = handleStatusPageApiRequest(request);

  return {
    status: response.status,
    body_json: serializeStatusPage(response.body)
  };
}