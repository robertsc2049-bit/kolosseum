import {
  createCookieConsentState,
  renderCookieConsentSurface,
  serializeCookieConsentSurface
} from "../v1CookieConsentSurface.mjs";

// DEV NOTE: Transport adapter only. GET renders a cookie-consent view model;
// POST records cookie consent state. The adapter must not import engine code,
// update declaration records, alter training flow, or activate external scripts.

export const COOKIE_CONSENT_SURFACE_API_ID = "cookie_consent_surface_api";

export function handleCookieConsentSurfaceApiRequest(request = {}) {
  const method = request?.method ?? "GET";

  if (method === "GET") {
    const result = renderCookieConsentSurface({
      request_id: request?.request_id,
      actor_user_id: request?.actor_user_id,
      actor_type: request?.actor_type ?? "anonymous",
      requested_at: request?.requested_at,
      route: request?.path ?? request?.route ?? "/legal/cookies",
      deterministic_probe: request?.deterministic_probe
    });

    return {
      status: result.ok === true ? 200 : 404,
      body: {
        api_surface_id: COOKIE_CONSENT_SURFACE_API_ID,
        ...result
      }
    };
  }

  if (method === "POST") {
    const result = createCookieConsentState(request?.body ?? {});

    return {
      status: result.ok === true ? 200 : 403,
      body: {
        api_surface_id: COOKIE_CONSENT_SURFACE_API_ID,
        ...result
      }
    };
  }

  return {
    status: 405,
    body: {
      ok: false,
      api_surface_id: COOKIE_CONSENT_SURFACE_API_ID,
      code: "cookie_consent_method_not_allowed",
      consent_state_recorded: false,
      renderable: false,
      engine_visible: false,
      engine_truth_changed: false,
      compile_output_changed: false,
      training_flow_changed: false,
      declaration_truth_changed: false,
      phase1_declaration_changed: false,
      external_script_activation: false,
      provider_call_performed: false,
      legal_presentation_state_only: true
    }
  };
}

export function handleCookieConsentSurfaceApiJson(request = {}) {
  const response = handleCookieConsentSurfaceApiRequest(request);

  return {
    status: response.status,
    body_json: serializeCookieConsentSurface(response.body)
  };
}