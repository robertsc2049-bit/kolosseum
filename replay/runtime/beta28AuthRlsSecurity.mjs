// DEV NOTE: BETA-28 fail-closed application security policy.
// Authenticated principal identity and resource ownership must be resolved by
// trusted application code. Client input never supplies resource ownership.
// This policy does not authenticate credentials or alter engine truth.

import crypto from "node:crypto";

import {
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

export const BETA28_RESOURCE_TYPES =
  Object.freeze([
    "session",
    "projection",
    "replay_verdict",
    "evidence",
    "export",
    "coach_note"
  ]);

export const BETA28_ACTIONS =
  Object.freeze([
    "read",
    "write",
    "export",
    "mutate"
  ]);

export const BETA28_RELATIONSHIP_STATUSES =
  Object.freeze([
    "active",
    "archived",
    "pending",
    "revoked"
  ]);

export const BETA28_AUDIT_EVENT_TYPES =
  Object.freeze([
    "security_access_requested",
    "security_access_granted",
    "security_access_denied",
    "sealed_artifact_mutation_denied"
  ]);

export const BETA28_FAILURE_TOKENS =
  Object.freeze([
    "beta28_input_invalid",
    "beta28_unauthenticated",
    "beta28_account_suspended",
    "beta28_account_inactive",
    "beta28_owner_scope_denied",
    "beta28_relationship_required",
    "beta28_relationship_denied",
    "beta28_revoked_coach_denied",
    "beta28_policy_scope_denied",
    "beta28_action_denied",
    "beta28_sealed_artifact_mutation_denied",
    "beta28_resource_not_found",
    "beta28_secret_detected",
    "beta28_dependency_audit_failed",
    "beta28_manifest_invalid"
  ]);

export const beta28AuthRlsSecurityContract =
  Object.freeze({
    contract_id:
      "beta28_auth_rls_security_contract",
    slice_id:
      "BETA-28",
    version:
      "1.0.0",
    actor_types:
      Object.freeze([
        "individual_user",
        "coach"
      ]),
    active_account_state:
      "active",
    suspended_account_state:
      "suspended",
    resource_types:
      BETA28_RESOURCE_TYPES,
    actions:
      BETA28_ACTIONS,
    relationship_statuses:
      BETA28_RELATIONSHIP_STATUSES,
    owner_only_session_access:
      true,
    coach_relationship_scoped:
      true,
    revoked_coach_lockout:
      true,
    suspended_account_lockout:
      true,
    projection_access_protected:
      true,
    replay_verdict_access_protected:
      true,
    evidence_access_protected:
      true,
    export_access_protected:
      true,
    notes_access_protected:
      true,
    sealed_artifact_mutation_allowed:
      false,
    resource_owner_from_client:
      false,
    protected_route_adapter_added:
      true,
    credential_provider_added:
      false,
    live_legacy_route_rewiring:
      false,
    postgres_rls_migration:
      "migrations/20260714_beta28_auth_rls_security.sql",
    audit_event_types:
      BETA28_AUDIT_EVENT_TYPES,
    dependency_audit_command:
      "npm audit --json --omit=dev --audit-level=high",
    secret_scan_scope:
      "git_tracked_files"
  });

const PRINCIPAL_KEYS =
  Object.freeze([
    "authenticated",
    "user_id",
    "actor_type",
    "account_state"
  ]);

const RESOURCE_KEYS =
  Object.freeze([
    "resource_id",
    "resource_type",
    "owner_user_id",
    "sealed"
  ]);

const RELATIONSHIP_KEYS =
  Object.freeze([
    "relationship_id",
    "coach_user_id",
    "individual_user_id",
    "status",
    "permitted_resource_types",
    "permitted_actions"
  ]);

const REQUEST_KEYS =
  Object.freeze([
    "principal",
    "relationship",
    "resource",
    "action"
  ]);

const OWNER_ACTIONS =
  Object.freeze({
    session:
      Object.freeze([
        "read",
        "write"
      ]),
    projection:
      Object.freeze([
        "read",
        "export"
      ]),
    replay_verdict:
      Object.freeze([
        "read",
        "export"
      ]),
    evidence:
      Object.freeze([
        "read",
        "export"
      ]),
    export:
      Object.freeze([
        "export"
      ]),
    coach_note:
      Object.freeze([
        "read"
      ])
  });

const ACTIVE_COACH_ACTIONS =
  Object.freeze({
    session:
      Object.freeze([
        "read",
        "write"
      ]),
    projection:
      Object.freeze([
        "read",
        "export"
      ]),
    replay_verdict:
      Object.freeze([
        "read",
        "export"
      ]),
    evidence:
      Object.freeze([
        "read",
        "export"
      ]),
    export:
      Object.freeze([
        "export"
      ]),
    coach_note:
      Object.freeze([
        "read",
        "write"
      ])
  });

const ARCHIVED_COACH_ACTIONS =
  Object.freeze({
    session:
      Object.freeze([]),
    projection:
      Object.freeze([
        "read",
        "export"
      ]),
    replay_verdict:
      Object.freeze([
        "read",
        "export"
      ]),
    evidence:
      Object.freeze([
        "read",
        "export"
      ]),
    export:
      Object.freeze([
        "export"
      ]),
    coach_note:
      Object.freeze([
        "read"
      ])
  });

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

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function deepFreeze(value) {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}

function sha256Utf8(value) {
  return crypto
    .createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

function failure(
  failureToken,
  details = {}
) {
  return deepFreeze({
    ok: false,
    failure_token:
      failureToken,
    details:
      clone(details)
  });
}

function validPrincipal(
  principal
) {
  return (
    exactKeys(
      principal,
      PRINCIPAL_KEYS
    ) &&
    typeof principal.authenticated ===
      "boolean" &&
    typeof principal.user_id ===
      "string" &&
    principal.user_id.length > 0 &&
    (
      principal.actor_type ===
        "individual_user" ||
      principal.actor_type ===
        "coach"
    ) &&
    (
      principal.account_state ===
        "active" ||
      principal.account_state ===
        "suspended"
    )
  );
}

function validResource(
  resource
) {
  return (
    exactKeys(
      resource,
      RESOURCE_KEYS
    ) &&
    typeof resource.resource_id ===
      "string" &&
    resource.resource_id.length > 0 &&
    BETA28_RESOURCE_TYPES.includes(
      resource.resource_type
    ) &&
    typeof resource.owner_user_id ===
      "string" &&
    resource.owner_user_id.length > 0 &&
    typeof resource.sealed ===
      "boolean"
  );
}

function validRelationship(
  relationship
) {
  return (
    exactKeys(
      relationship,
      RELATIONSHIP_KEYS
    ) &&
    typeof relationship.relationship_id ===
      "string" &&
    relationship.relationship_id.length > 0 &&
    typeof relationship.coach_user_id ===
      "string" &&
    relationship.coach_user_id.length > 0 &&
    typeof relationship
      .individual_user_id ===
      "string" &&
    relationship
      .individual_user_id.length > 0 &&
    BETA28_RELATIONSHIP_STATUSES
      .includes(
        relationship.status
      ) &&
    Array.isArray(
      relationship
        .permitted_resource_types
    ) &&
    relationship
      .permitted_resource_types
      .every(
        (value) =>
          BETA28_RESOURCE_TYPES
            .includes(value)
      ) &&
    Array.isArray(
      relationship
        .permitted_actions
    ) &&
    relationship
      .permitted_actions
      .every(
        (value) =>
          BETA28_ACTIONS.includes(value)
      )
  );
}

function actionAllowed(
  matrix,
  resourceType,
  action
) {
  return (
    Array.isArray(
      matrix[resourceType]
    ) &&
    matrix[resourceType]
      .includes(action)
  );
}

export function createBeta28AuthRlsSecurityService() {
  const auditEvents = [];

  let auditSequence = 0;

  function appendAudit(
    eventType,
    request,
    reasonToken
  ) {
    auditSequence += 1;

    const principal =
      isRecord(request?.principal)
        ? request.principal
        : {};

    const resource =
      isRecord(request?.resource)
        ? request.resource
        : {};

    const event =
      deepFreeze({
        audit_event_id:
          "beta28_audit_" +
          String(auditSequence)
            .padStart(6, "0"),
        event_type:
          eventType,
        actor_user_id:
          typeof principal.user_id ===
            "string"
            ? principal.user_id
            : null,
        actor_type:
          typeof principal.actor_type ===
            "string"
            ? principal.actor_type
            : null,
        resource_type:
          typeof resource.resource_type ===
            "string"
            ? resource.resource_type
            : null,
        resource_id:
          typeof resource.resource_id ===
            "string"
            ? resource.resource_id
            : null,
        action:
          typeof request?.action ===
            "string"
            ? request.action
            : null,
        reason_token:
          reasonToken ?? null
      });

    auditEvents.push(event);

    return event;
  }

  function deny(
    request,
    failureToken,
    details = {}
  ) {
    if (
      failureToken ===
      "beta28_sealed_artifact_mutation_denied"
    ) {
      appendAudit(
        "sealed_artifact_mutation_denied",
        request,
        failureToken
      );
    }

    appendAudit(
      "security_access_denied",
      request,
      failureToken
    );

    return failure(
      failureToken,
      details
    );
  }

  function grant(
    request,
    permissionScope,
    relationshipId = null
  ) {
    appendAudit(
      "security_access_granted",
      request,
      null
    );

    return deepFreeze({
      ok: true,
      decision:
        deepFreeze({
          allowed: true,
          permission_scope:
            permissionScope,
          actor_user_id:
            request.principal.user_id,
          actor_type:
            request.principal.actor_type,
          resource_type:
            request.resource.resource_type,
          resource_id:
            request.resource.resource_id,
          owner_user_id:
            request.resource.owner_user_id,
          action:
            request.action,
          relationship_id:
            relationshipId
        })
    });
  }

  function authorize(request) {
    appendAudit(
      "security_access_requested",
      request,
      null
    );

    if (
      !isRecord(request) ||
      !exactKeys(
        request,
        REQUEST_KEYS
      )
    ) {
      return deny(
        request,
        "beta28_input_invalid"
      );
    }

    if (
      !isRecord(request.principal) ||
      request.principal
        .authenticated !== true
    ) {
      return deny(
        request,
        "beta28_unauthenticated"
      );
    }

    if (!validPrincipal(request.principal)) {
      return deny(
        request,
        "beta28_input_invalid"
      );
    }

    if (
      request.principal.account_state ===
      "suspended"
    ) {
      return deny(
        request,
        "beta28_account_suspended"
      );
    }

    if (
      request.principal.account_state !==
      "active"
    ) {
      return deny(
        request,
        "beta28_account_inactive"
      );
    }

    if (
      !validResource(request.resource) ||
      !BETA28_ACTIONS.includes(
        request.action
      )
    ) {
      return deny(
        request,
        "beta28_input_invalid"
      );
    }

    if (
      request.resource.sealed === true &&
      (
        request.action === "write" ||
        request.action === "mutate"
      )
    ) {
      return deny(
        request,
        "beta28_sealed_artifact_mutation_denied"
      );
    }

    if (
      request.principal.actor_type ===
      "individual_user"
    ) {
      if (request.relationship !== null) {
        return deny(
          request,
          "beta28_input_invalid"
        );
      }

      if (
        request.principal.user_id !==
        request.resource.owner_user_id
      ) {
        return deny(
          request,
          "beta28_owner_scope_denied"
        );
      }

      if (
        !actionAllowed(
          OWNER_ACTIONS,
          request.resource.resource_type,
          request.action
        )
      ) {
        return deny(
          request,
          "beta28_action_denied"
        );
      }

      return grant(
        request,
        "owner"
      );
    }

    if (!isRecord(request.relationship)) {
      return deny(
        request,
        "beta28_relationship_required"
      );
    }

    if (!validRelationship(request.relationship)) {
      return deny(
        request,
        "beta28_input_invalid"
      );
    }

    if (
      request.relationship.status ===
      "revoked"
    ) {
      return deny(
        request,
        "beta28_revoked_coach_denied"
      );
    }

    if (
      request.relationship.status !==
        "active" &&
      request.relationship.status !==
        "archived"
    ) {
      return deny(
        request,
        "beta28_relationship_denied"
      );
    }

    if (
      request.relationship.coach_user_id !==
        request.principal.user_id ||
      request.relationship
        .individual_user_id !==
        request.resource.owner_user_id
    ) {
      return deny(
        request,
        "beta28_relationship_denied"
      );
    }

    if (
      !request.relationship
        .permitted_resource_types
        .includes(
          request.resource.resource_type
        ) ||
      !request.relationship
        .permitted_actions
        .includes(
          request.action
        )
    ) {
      return deny(
        request,
        "beta28_policy_scope_denied"
      );
    }

    const matrix =
      request.relationship.status ===
        "active"
        ? ACTIVE_COACH_ACTIONS
        : ARCHIVED_COACH_ACTIONS;

    if (
      !actionAllowed(
        matrix,
        request.resource.resource_type,
        request.action
      )
    ) {
      return deny(
        request,
        "beta28_relationship_denied"
      );
    }

    return grant(
      request,
      request.relationship.status ===
        "active"
        ? "active_coach_relationship"
        : "archived_coach_relationship",
      request.relationship.relationship_id
    );
  }

  async function protectOperation(
    request,
    operation
  ) {
    if (typeof operation !== "function") {
      return failure(
        "beta28_input_invalid"
      );
    }

    const authorization =
      authorize(request);

    if (!authorization.ok) {
      return authorization;
    }

    const value =
      await operation(
        authorization.decision
      );

    return {
      ok: true,
      decision:
        authorization.decision,
      value
    };
  }

  function readAuditLog() {
    return deepFreeze(
      auditEvents.map(
        (event) =>
          deepFreeze(
            clone(event)
          )
      )
    );
  }

  return deepFreeze({
    authorize,
    protectOperation,
    readAuditLog
  });
}

export function buildBeta28AuthRlsSecurityManifest(
  fileTexts
) {
  const required = [
    "contract",
    "failure_tokens",
    "runtime_security",
    "api_adapter",
    "rls_migration",
    "session_readback",
    "relationship_guard",
    "coach_managed_service",
    "beta26_runtime",
    "beta27_runtime",
    "secret_scan",
    "dependency_audit"
  ];

  for (
    const key
    of required
  ) {
    if (
      typeof fileTexts?.[key] !==
      "string"
    ) {
      return failure(
        "beta28_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta28.auth_rls_security_manifest.v1.0.0",
    slice_id:
      "BETA-28",
    contract_version:
      beta28AuthRlsSecurityContract
        .version,
    resource_type_count:
      BETA28_RESOURCE_TYPES.length,
    relationship_status_count:
      BETA28_RELATIONSHIP_STATUSES
        .length,
    audit_event_type_count:
      BETA28_AUDIT_EVENT_TYPES.length,
    credential_provider_added:
      false,
    live_legacy_route_rewiring:
      false,
    paths: {
      contract:
        "replay/contracts/beta28_auth_rls_security_contract.json",
      failure_tokens:
        "replay/contracts/beta28_auth_rls_security_failure_tokens.json",
      runtime_security:
        "replay/runtime/beta28AuthRlsSecurity.mjs",
      api_adapter:
        "src/api/beta28ProtectedResourceApi.mjs",
      rls_migration:
        "migrations/20260714_beta28_auth_rls_security.sql",
      session_readback:
        "src/sessionStateEventsReadback.mjs",
      relationship_guard:
        "src/relationshipPermissionGuards.mjs",
      coach_managed_service:
        "src/api/beta17_coach_managed_service.ts",
      beta26_runtime:
        "replay/runtime/beta26EvidenceImmutableStore.mjs",
      beta27_runtime:
        "replay/runtime/beta27ProjectionEvidenceExport.mjs",
      secret_scan:
        "ci/scripts/run_beta_28_secret_scan.mjs",
      dependency_audit:
        "ci/scripts/run_beta_28_dependency_audit.mjs"
    },
    sha256:
      Object.fromEntries(
        required.map(
          (key) => [
            key,
            sha256Utf8(
              fileTexts[key]
            )
          ]
        )
      )
  });
}

export function verifyBeta28AuthRlsSecurityManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta28AuthRlsSecurityManifest(
      fileTexts
    );

  if (expected?.ok === false) {
    return expected;
  }

  if (
    betaCanonicalJson(manifest) !==
    betaCanonicalJson(expected)
  ) {
    return failure(
      "beta28_manifest_invalid"
    );
  }

  return deepFreeze({
    ok: true,
    manifest_sha256:
      sha256Utf8(
        betaCanonicalJson(
          manifest
        )
      )
  });
}
