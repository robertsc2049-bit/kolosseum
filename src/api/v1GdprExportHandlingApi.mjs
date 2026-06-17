import {
  createGdprExportHandling,
  serializeGdprExportHandling
} from "../v1GdprExportHandling.mjs";

// DEV NOTE: Transport adapter only. It delegates all GDPR export handling to
// the product permission/data-access service and must not import engine code or
// mutate deterministic artefacts.

export const GDPR_EXPORT_HANDLING_API_SURFACE_ID = "gdpr_export_handling_api";

export function handleGdprExportHandlingApiRequest(request) {
  const method = request?.method ?? "POST";

  if (method !== "POST") {
    return {
      status: 405,
      body: {
        ok: false,
        surface_id: GDPR_EXPORT_HANDLING_API_SURFACE_ID,
        code: "gdpr_export_method_not_allowed",
        copy_id: "gdpr_export.blocked",
        engine_visible: false,
        engine_truth_changed: false
      }
    };
  }

  const result = createGdprExportHandling(request?.body ?? {});

  return {
    status: result.ok === true ? 200 : 403,
    body: {
      api_surface_id: GDPR_EXPORT_HANDLING_API_SURFACE_ID,
      ...result
    }
  };
}

export function handleGdprExportHandlingApiJson(request) {
  const response = handleGdprExportHandlingApiRequest(request);
  return {
    status: response.status,
    body_json: serializeGdprExportHandling(response.body)
  };
}