// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-27 byte-identical projection and evidence export guard.

import fs from "node:fs";

import {
  BETA27_ARTIFACT_TYPES,
  BETA27_AUDIT_EVENT_TYPES,
  BETA27_EXPORTABLE_COACH_STATUSES,
  BETA27_FAILURE_TOKENS,
  beta27ProjectionEvidenceExportContract,
  buildBeta27ProjectionEvidenceExportManifest,
  verifyBeta27ProjectionEvidenceExportManifest
} from "../../replay/runtime/beta27ProjectionEvidenceExport.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_27_PROJECTION_EVIDENCE_EXPORT::FAIL::${message}`
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
    "replay/contracts/beta27_projection_evidence_export_contract.json",
  tokens:
    "replay/contracts/beta27_projection_evidence_export_failure_tokens.json",
  manifest:
    "replay/suite/beta_phase1_8/projection_evidence_export_manifest.json",
  runtime:
    "replay/runtime/beta27ProjectionEvidenceExport.mjs",
  api:
    "src/api/beta27ProjectionEvidenceExportApi.mjs",
  phase7:
    "engine/src/phases/beta18Phase7SchemaBinding.ts",
  beta26Runtime:
    "replay/runtime/beta26EvidenceImmutableStore.mjs",
  beta26Contract:
    "replay/contracts/beta26_evidence_immutability_contract.json",
  proofView:
    "src/v1ProofArtefactViewContract.mjs",
  legacyExport:
    "src/v1ExportBoundaryContract.mjs",
  documentation:
    "docs/runtime/BETA_27_PROJECTION_EVIDENCE_EXPORT.md",
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
    beta27ProjectionEvidenceExportContract
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
    BETA27_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.artifact_types
  ) !==
  JSON.stringify(
    BETA27_ARTIFACT_TYPES
  ) ||
  contract?.regeneration_on_export !==
    false ||
  contract
    ?.export_timestamp_in_artifact_bytes !==
    false ||
  contract?.metadata_mutation !==
    false ||
  contract?.hash_verified_before_export !==
    true
) {
  fail(
    "byte_export_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract
      ?.coach_export_relationship_statuses
  ) !==
  JSON.stringify(
    BETA27_EXPORTABLE_COACH_STATUSES
  ) ||
  contract?.revoked_coach_allowed !==
    false ||
  contract?.relationship_policy_required !==
    true
) {
  fail(
    "access_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.audit_event_types
  ) !==
  JSON.stringify(
    BETA27_AUDIT_EVENT_TYPES
  )
) {
  fail(
    "audit_contract_invalid"
  );
}

for (
  const required
  of [
    "verifyBeta27StoredProjectionRecord",
    "verifyBeta26EnvelopeBytes",
    "export_requested",
    "export_delivered",
    "export_denied",
    "beta27_revoked_coach_denied",
    "archived_coach_relationship",
    "active_coach_relationship",
    "json_bytes",
    "stored_bytes_checksum_sha256"
  ]
) {
  if (
    !text.runtime.includes(
      required
    )
  ) {
    fail(
      `runtime_token_missing::${required}`
    );
  }
}

const forbiddenArtifactTimestampTokens = [
  '"exported_at"',
  '"requested_at"',
  "exported_at:",
  "requested_at:"
];

if (
  forbiddenArtifactTimestampTokens
    .some(
      (token) =>
        text.runtime.includes(token)
    )
) {
  fail(
    "runtime_export_timestamp_present"
  );
}

if (
  !text.api.includes(
    "body:" +
    "\n      result.json_bytes"
  ) ||
  text.api.includes(
    "JSON.stringify(result.json_bytes)"
  )
) {
  fail(
    "api_exact_byte_body_missing"
  );
}

const fileTexts = {
  contract:
    text.contract,
  failure_tokens:
    text.tokens,
  runtime_export:
    text.runtime,
  api_adapter:
    text.api,
  phase7_source:
    text.phase7,
  beta26_runtime:
    text.beta26Runtime,
  beta26_contract:
    text.beta26Contract,
  proof_view_source:
    text.proofView,
  legacy_export_source:
    text.legacyExport
};

if (manifest) {
  const expected =
    buildBeta27ProjectionEvidenceExportManifest(
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
    verifyBeta27ProjectionEvidenceExportManifest(
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
    "byte-identical",
    "Phase 7",
    "Phase 8",
    "active",
    "archived",
    "revoked",
    "hash verification",
    "export requested",
    "export delivered",
    "export denied",
    "No export timestamp",
    "No regeneration",
    "No metadata mutation",
    "No live route",
    "No UI link",
    "No database migration"
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
    '"proof:beta-27"'
  ) ||
  !text.package.includes(
    "run_beta_27_projection_evidence_export_tests.mjs"
  ) ||
  !text.package.includes(
    "beta_27_projection_evidence_export_guard.mjs"
  )
) {
  fail(
    "package_proof_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-27"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/runtime/beta27ProjectionEvidenceExport.mjs",
    "src/api/beta27ProjectionEvidenceExportApi.mjs",
    "replay/contracts/beta27_projection_evidence_export_contract.json",
    "replay/contracts/beta27_projection_evidence_export_failure_tokens.json",
    "replay/suite/beta_phase1_8/projection_evidence_export_manifest.json"
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
      "BETA-27",
    token:
      "CI_BETA_27_PROJECTION_EVIDENCE_EXPORT",
    artifact_type_count:
      BETA27_ARTIFACT_TYPES.length,
    coach_export_status_count:
      BETA27_EXPORTABLE_COACH_STATUSES.length,
    audit_event_type_count:
      BETA27_AUDIT_EVENT_TYPES.length,
    byte_identical:
      true,
    regeneration_on_export:
      false,
    message:
      "Phase 7 and sealed Phase 8 exact-byte export and access policy passed."
  })
);
