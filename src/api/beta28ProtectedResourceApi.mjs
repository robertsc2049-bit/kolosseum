// DEV NOTE: BETA-28 transport adapter for sensitive resource operations.
// Resource ownership is resolved by trusted server code before authorization.
// Successful operation responses are returned unchanged, preserving sealed bytes.

const CONFIG_KEYS =
  Object.freeze([
    "security_service",
    "resolve_resource",
    "execute"
  ]);

const REQUEST_KEYS =
  Object.freeze([
    "principal",
    "relationship",
    "resource_type",
    "resource_id",
    "action",
    "payload"
  ]);

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function exactKeys(
  value,
  expectedKeys
) {
  return (
    isRecord(value) &&
    Object.keys(value)
      .sort()
      .join("\u0000") ===
    [...expectedKeys]
      .sort()
      .join("\u0000")
  );
}

function deniedResponse(
  statusCode,
  failureToken,
  details = {}
) {
  return {
    statusCode,
    headers: {
      "content-type":
        "application/json"
    },
    body:
      JSON.stringify({
        ok: false,
        failure_token:
          failureToken,
        details
      })
  };
}

export function createBeta28ProtectedResourceApi(
  config
) {
  if (
    !exactKeys(
      config,
      CONFIG_KEYS
    ) ||
    !isRecord(
      config.security_service
    ) ||
    typeof config
      .security_service
      .protectOperation !==
      "function" ||
    typeof config.resolve_resource !==
      "function" ||
    typeof config.execute !==
      "function"
  ) {
    throw new TypeError(
      "beta28_input_invalid"
    );
  }

  async function handle(request) {
    const body =
      request?.body ??
      request;

    if (
      !exactKeys(
        body,
        REQUEST_KEYS
      )
    ) {
      return deniedResponse(
        400,
        "beta28_input_invalid"
      );
    }

    const resource =
      await config.resolve_resource({
        resource_type:
          body.resource_type,
        resource_id:
          body.resource_id
      });

    if (
      !isRecord(resource)
    ) {
      return deniedResponse(
        404,
        "beta28_resource_not_found"
      );
    }

    const protectedResult =
      await config
        .security_service
        .protectOperation(
          {
            principal:
              body.principal,
            relationship:
              body.relationship,
            resource,
            action:
              body.action
          },
          async (decision) =>
            config.execute({
              decision,
              resource,
              payload:
                body.payload
            })
        );

    if (protectedResult.ok !== true) {
      const statusCode =
        protectedResult.failure_token ===
          "beta28_unauthenticated"
          ? 401
          : protectedResult
                .failure_token ===
              "beta28_sealed_artifact_mutation_denied"
            ? 409
            : 403;

      return deniedResponse(
        statusCode,
        protectedResult.failure_token,
        protectedResult.details
      );
    }

    return protectedResult.value;
  }

  return Object.freeze({
    handle
  });
}
