import {
  createV1ExportBoundary,
  serializeV1Export
} from "../v1ExportBoundaryContract.mjs";

/**
 * DEV NOTE: Export boundary API adapter.
 * This adapter is transport-only. It forwards the request body to the S-V1-47
 * proof export contract and maps the factual contract verdict to an HTTP-shaped
 * object. It does not read engine state, evidence internals outside the supplied
 * proof artefact, product tier state, coach notes, or entity data.
 */
export function handleV1ExportBoundaryApiRequest(request) {
  const body = request?.body ?? request ?? {};
  const result = createV1ExportBoundary(body);

  return {
    statusCode: result.ok === true ? 200 : 403,
    headers: {
      "content-type": "application/json"
    },
    body: result.ok === true ? serializeV1Export(result) : JSON.stringify(result)
  };
}