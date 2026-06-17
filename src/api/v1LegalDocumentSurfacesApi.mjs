import {
  LEGAL_DOCUMENT_ROUTES,
  createLegalDocumentSurface
} from "../v1LegalDocumentSurfaces.mjs";

/**
 * DEV NOTE: S-V1-L-01 legal document API adapter.
 * Purpose: maps an HTTP-shaped GET request into a controlled-launch legal document view model.
 * Boundary: transport only; renderable document response only; no data-request workflow and no engine state.
 * Determinism: response depends on supplied request fields and fixed document templates only.
 * Failure: unknown routes fail without fallback document fabrication.
 */
export function handleV1LegalDocumentSurfacesApiRequest(request) {
  const method = request?.method ?? "GET";
  const path = request?.path ?? request?.requested_route ?? "/legal";

  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error_code: "legal_document_surface_method_not_allowed",
        engine_decision: false,
        engine_visible: false
      })
    };
  }

  const requestedDocumentKey = request?.requested_document_key ?? LEGAL_DOCUMENT_ROUTES[path];

  if (!requestedDocumentKey) {
    return {
      statusCode: 404,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error_code: "legal_document_surface_route_not_permitted",
        requested_route: path,
        engine_decision: false,
        engine_visible: false
      })
    };
  }

  const result = createLegalDocumentSurface({
    requested_document_key: requestedDocumentKey,
    requested_route: path,
    requesting_actor_id: request?.requesting_actor_id ?? "anonymous_legal_viewer",
    requested_at: request?.requested_at ?? "2026-06-17T00:00:00.000Z",
    deterministic_probe: request?.deterministic_probe
  });

  const statusCode = result.ok === true
    ? 200
    : result.reason_code === "legal_document_surface_route_not_permitted" ||
      result.reason_code === "legal_document_surface_document_not_permitted"
      ? 404
      : 400;

  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(result)
  };
}