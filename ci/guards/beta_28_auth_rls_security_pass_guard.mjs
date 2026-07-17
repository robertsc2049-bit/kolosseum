// @law: Repo Governance
// @severity: high
// @scope: security
// DEV NOTE: BETA-28 auth, RLS and sensitive-resource security guard.

import fs from "node:fs";

import {
  BETA28_AUDIT_EVENT_TYPES,
  BETA28_FAILURE_TOKENS,
  BETA28_RELATIONSHIP_STATUSES,
  BETA28_RESOURCE_TYPES,
  beta28AuthRlsSecurityContract,
  buildBeta28AuthRlsSecurityManifest,
  verifyBeta28AuthRlsSecurityManifest
} from "../../replay/runtime/beta28AuthRlsSecurity.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_28_AUTH_RLS_SECURITY_PASS::FAIL::${message}`
  );
}

function read(path) {
  if (!fs.existsSync(path)) {
    fail(
      `missing::${path}`
    );

    return "";
  }

  return fs.readFileSync(
    path,
    "utf8"
  );
}

function readJson(path) {
  const text =
    read(path);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  }
  catch (error) {
    fail(
      `invalid_json::${path}::${String(error?.message ?? error)}`
    );

    return null;
  }
}

const files = {
  contract:
    "replay/contracts/beta28_auth_rls_security_contract.json",
  tokens:
    "replay/contracts/beta28_auth_rls_security_failure_tokens.json",
  manifest:
    "replay/suite/beta_phase1_8/auth_rls_security_manifest.json",
  runtime:
    "replay/runtime/beta28AuthRlsSecurity.mjs",
  api:
    "src/api/beta28ProtectedResourceApi.mjs",
  migration:
    "migrations/20260714_beta28_auth_rls_security.sql",
  sessionReadback:
    "src/sessionStateEventsReadback.mjs",
  relationshipGuard:
    "src/relationshipPermissionGuards.mjs",
  coachManaged:
    "src/api/beta17_coach_managed_service.ts",
  beta26Runtime:
    "replay/runtime/beta26EvidenceImmutableStore.mjs",
  beta27Runtime:
    "replay/runtime/beta27ProjectionEvidenceExport.mjs",
  secretScan:
    "ci/scripts/run_beta_28_secret_scan.mjs",
  dependencyAudit:
    "ci/scripts/run_beta_28_dependency_audit.mjs",
  documentation:
    "docs/runtime/BETA_28_AUTH_RLS_SECURITY_PASS.md",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json",
  v0Core:
    "ci/scripts/kolosseum_v0_test_suite_core.mjs",
  workflow:
    ".github/workflows/green.yml"
};

const text = {};

for (
  const [key, path]
  of Object.entries(files)
) {
  text[key] =
    read(path);
}

const contract =
  readJson(files.contract);

const tokens =
  readJson(files.tokens);

const manifest =
  readJson(files.manifest);

if (
  JSON.stringify(contract) !==
  JSON.stringify(
    beta28AuthRlsSecurityContract
  )
) {
  fail(
    "contract_mismatch"
  );
}

if (
  !tokens ||
  JSON.stringify(tokens.tokens) !==
  JSON.stringify(
    BETA28_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.resource_types
  ) !==
  JSON.stringify(
    BETA28_RESOURCE_TYPES
  ) ||
  JSON.stringify(
    contract
      ?.relationship_statuses
  ) !==
  JSON.stringify(
    BETA28_RELATIONSHIP_STATUSES
  )
) {
  fail(
    "resource_or_relationship_contract_invalid"
  );
}

if (
  contract?.owner_only_session_access !==
    true ||
  contract?.coach_relationship_scoped !==
    true ||
  contract?.revoked_coach_lockout !==
    true ||
  contract?.suspended_account_lockout !==
    true ||
  contract
    ?.sealed_artifact_mutation_allowed !==
    false ||
  contract?.resource_owner_from_client !==
    false
) {
  fail(
    "security_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.audit_event_types
  ) !==
  JSON.stringify(
    BETA28_AUDIT_EVENT_TYPES
  )
) {
  fail(
    "audit_contract_invalid"
  );
}

for (
  const required
  of [
    "beta28_unauthenticated",
    "beta28_account_suspended",
    "beta28_owner_scope_denied",
    "beta28_revoked_coach_denied",
    "beta28_policy_scope_denied",
    "beta28_sealed_artifact_mutation_denied",
    "security_access_requested",
    "security_access_granted",
    "security_access_denied",
    "sealed_artifact_mutation_denied",
    "ARCHIVED_COACH_ACTIONS",
    "ACTIVE_COACH_ACTIONS"
  ]
) {
  if (!text.runtime.includes(required)) {
    fail(
      `runtime_token_missing::${required}`
    );
  }
}

for (
  const required
  of [
    "resolve_resource",
    "protectOperation",
    "beta28_resource_not_found",
    "return protectedResult.value"
  ]
) {
  if (!text.api.includes(required)) {
    fail(
      `api_token_missing::${required}`
    );
  }
}

const migrationLower =
  text.migration.toLowerCase();

for (
  const required
  of [
    "enable row level security",
    "app.user_id",
    "app.actor_type",
    "app.account_state",
    "beta28_sessions_owner_or_coach_read",
    "beta28_runtime_events_scoped_write",
    "beta28_artifacts_scoped_read_export",
    "beta28_artifacts_manual_insert_denied",
    "beta28_notes_active_coach_write",
    "beta28_audit_insert",
    "beta28_deny_sealed_artifact_mutation",
    "before update or delete"
  ]
) {
  if (
    !migrationLower.includes(
      required.toLowerCase()
    )
  ) {
    fail(
      `rls_token_missing::${required}`
    );
  }
}

if (
  !text.secretScan.includes(
    "git"
  ) ||
  !text.secretScan.includes(
    "ls-files"
  ) ||
  !text.secretScan.includes(
    "beta28_secret_detected"
  )
) {
  fail(
    "secret_scan_contract_invalid"
  );
}

if (
  !text.dependencyAudit.includes(
    "npm.cmd audit --json --omit=dev --audit-level=high"
  ) ||
  !text.dependencyAudit.includes(
    "beta28_dependency_audit_failed"
  )
) {
  fail(
    "dependency_audit_contract_invalid"
  );
}

const fileTexts = {
  contract:
    text.contract,
  failure_tokens:
    text.tokens,
  runtime_security:
    text.runtime,
  api_adapter:
    text.api,
  rls_migration:
    text.migration,
  session_readback:
    text.sessionReadback,
  relationship_guard:
    text.relationshipGuard,
  coach_managed_service:
    text.coachManaged,
  beta26_runtime:
    text.beta26Runtime,
  beta27_runtime:
    text.beta27Runtime,
  secret_scan:
    text.secretScan,
  dependency_audit:
    text.dependencyAudit
};

if (manifest) {
  const expected =
    buildBeta28AuthRlsSecurityManifest(
      fileTexts
    );

  if (
    JSON.stringify(manifest) !==
    JSON.stringify(expected)
  ) {
    fail(
      "manifest_not_current"
    );
  }

  if (
    verifyBeta28AuthRlsSecurityManifest(
      manifest,
      fileTexts
    ).ok !== true
  ) {
    fail(
      "manifest_verification_failed"
    );
  }
}

for (
  const required
  of [
    "unauthenticated",
    "owner-only",
    "relationship-scoped",
    "revoked",
    "suspended",
    "projection",
    "replay verdict",
    "evidence",
    "export",
    "coach notes",
    "row-level security",
    "sealed artefact mutation",
    "dependency audit",
    "secret scan",
    "No credential provider",
    "No legacy route rewiring"
  ]
) {
  if (
    !text.documentation
      .toLowerCase()
      .includes(
        required.toLowerCase()
      )
  ) {
    fail(
      `documentation_token_missing::${required}`
    );
  }
}

if (
  !text.package.includes(
    '"proof:beta-28"'
  ) ||
  !text.package.includes(
    '"security:dependency-audit"'
  ) ||
  !text.package.includes(
    '"security:secret-scan"'
  ) ||
  !text.package.includes(
    "run_beta_28_auth_rls_security_tests.mjs"
  ) ||
  !text.package.includes(
    "beta_28_auth_rls_security_pass_guard.mjs"
  )
) {
  fail(
    "package_security_entrypoints_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-28"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/runtime/beta28AuthRlsSecurity.mjs",
    "src/api/beta28ProtectedResourceApi.mjs",
    "replay/contracts/beta28_auth_rls_security_contract.json",
    "replay/contracts/beta28_auth_rls_security_failure_tokens.json",
    "replay/suite/beta_phase1_8/auth_rls_security_manifest.json",
    "migrations/20260714_beta28_auth_rls_security.sql"
  ]
) {
  if (
    text.v0Core.split(
      `"${exactPath}"`
    ).length - 1 !==
    1
  ) {
    fail(
      `v0_exclusion_invalid::${exactPath}`
    );
  }
}

if (
  !text.workflow.includes(
    "contents: read"
  )
) {
  fail(
    "workflow_read_permission_missing"
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    guard:
      "BETA-28",
    token:
      "CI_BETA_28_AUTH_RLS_SECURITY_PASS",
    resource_type_count:
      BETA28_RESOURCE_TYPES.length,
    relationship_status_count:
      BETA28_RELATIONSHIP_STATUSES.length,
    audit_event_type_count:
      BETA28_AUDIT_EVENT_TYPES.length,
    owner_scoped:
      true,
    relationship_scoped:
      true,
    revoked_locked:
      true,
    suspended_locked:
      true,
    message:
      "Auth, RLS, protected resource access, audit, dependency and secret security boundaries passed."
  })
);
