// DEV NOTE: BETA-27 transport-only byte export adapter.
// Successful responses use the exact verified stored JSON bytes as the body.
// The adapter does not parse, regenerate, reserialise, timestamp, or mutate them.

export function handleBeta27ProjectionEvidenceExportApiRequest(
  exportService,
  request
) {
  if (
    exportService === null ||
    typeof exportService !== "object" ||
    typeof exportService
      .requestExport !==
      "function"
  ) {
    return {
      statusCode: 500,
      headers: {
        "content-type":
          "application/json"
      },
      body:
        JSON.stringify({
          ok: false,
          failure_token:
            "beta27_input_invalid"
        })
    };
  }

  const body =
    request?.body ??
    request ??
    {};

  const result =
    exportService
      .requestExport(body);

  if (result.ok !== true) {
    return {
      statusCode:
        result.failure_token ===
          "beta27_artifact_not_found"
          ? 404
          : 403,
      headers: {
        "content-type":
          "application/json"
      },
      body:
        JSON.stringify(result)
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type":
        "application/json",
      "content-disposition":
        `attachment; filename="${result.filename}"`
    },
    body:
      result.json_bytes
  };
}
