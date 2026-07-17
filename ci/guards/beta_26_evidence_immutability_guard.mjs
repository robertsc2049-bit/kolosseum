// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-26 sealed evidence immutability guard.

import fs from "node:fs";

import {
  BETA26_AUDIT_EVENT_TYPES,
  BETA26_FAILURE_TOKENS,
  BETA26_STORE_API_KEYS,
  beta26EvidenceImmutabilityContract,
  buildBeta26EvidenceImmutabilityManifest,
  verifyBeta26EvidenceImmutabilityManifest
} from "../../replay/runtime/beta26EvidenceImmutableStore.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_26_EVIDENCE_IMMUTABILITY::FAIL::${message}`
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
    "replay/contracts/beta26_evidence_immutability_contract.json",
  tokens:
    "replay/contracts/beta26_evidence_immutability_failure_tokens.json",
  manifest:
    "replay/suite/beta_phase1_8/evidence_immutability_manifest.json",
  runtime:
    "replay/runtime/beta26EvidenceImmutableStore.mjs",
  beta24Contract:
    "replay/contracts/beta24_phase8_evidence_schema_contract.json",
  beta24Schema:
    "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
  beta24Manifest:
    "replay/suite/beta_phase1_8/evidence_schema_manifest.json",
  beta25Contract:
    "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
  beta25Manifest:
    "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json",
  activation:
    "src/api/evidence_activation_v1.ts",
  export:
    "src/v1ExportBoundaryContract.mjs",
  documentation:
    "docs/runtime/BETA_26_EVIDENCE_IMMUTABILITY.md",
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
    beta26EvidenceImmutabilityContract
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
    BETA26_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (
  contract?.storage_mode !==
    "append_only_canonical_envelope_bytes" ||
  contract?.lawful_creation_path !==
    "beta25_seal_gate_only" ||
  contract?.checksum_verified_on_read !==
    true ||
  contract?.update_after_seal_allowed !==
    false ||
  contract?.delete_after_seal_allowed !==
    false ||
  contract?.manual_creation_allowed !==
    false ||
  contract?.partial_envelope_allowed !==
    false ||
  contract?.regeneration_after_failure_allowed !==
    false ||
  contract?.export_time_mutation_allowed !==
    false
) {
  fail(
    "immutability_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.audit_event_types
  ) !==
  JSON.stringify(
    BETA26_AUDIT_EVENT_TYPES
  )
) {
  fail(
    "audit_event_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.store_api
  ) !==
  JSON.stringify(
    BETA26_STORE_API_KEYS
  )
) {
  fail(
    "store_api_contract_invalid"
  );
}

for (
  const required
  of [
    "evidence_seal_attempt",
    "evidence_seal_success",
    "evidence_seal_denial",
    "evidence_mutation_denial",
    "beta26_update_denied",
    "beta26_delete_denied",
    "beta26_manual_creation_denied",
    "beta26_partial_envelope_denied",
    "beta26_regeneration_denied",
    "beta26_export_mutation_denied",
    "verifyBeta26StoredEvidenceRecord",
    "sha256Utf8",
    "records.set"
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

const fileTexts = {
  contract:
    text.contract,
  failure_tokens:
    text.tokens,
  runtime_store:
    text.runtime,
  beta24_contract:
    text.beta24Contract,
  beta24_schema:
    text.beta24Schema,
  beta24_manifest:
    text.beta24Manifest,
  beta25_contract:
    text.beta25Contract,
  beta25_manifest:
    text.beta25Manifest,
  activation_source:
    text.activation,
  export_source:
    text.export
};

if (manifest) {
  const expected =
    buildBeta26EvidenceImmutabilityManifest(
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
    verifyBeta26EvidenceImmutabilityManifest(
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
    "sealed evidence bytes",
    "append-only",
    "manual creation",
    "partial envelope",
    "regeneration",
    "export-time mutation",
    "checksum",
    "seal attempt",
    "seal success",
    "seal denial",
    "mutation denial",
    "No database migration",
    "No API route"
  ]
) {
  if (
    !text.documentation.includes(
      required
    )
  ) {
    fail(
      `documentation_token_missing::${required}`
    );
  }
}

if (
  !text.package.includes(
    '"proof:beta-26"'
  ) ||
  !text.package.includes(
    "run_beta_26_evidence_immutability_tests.mjs"
  ) ||
  !text.package.includes(
    "beta_26_evidence_immutability_guard.mjs"
  )
) {
  fail(
    "package_proof_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-26"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/runtime/beta26EvidenceImmutableStore.mjs",
    "replay/contracts/beta26_evidence_immutability_contract.json",
    "replay/contracts/beta26_evidence_immutability_failure_tokens.json",
    "replay/suite/beta_phase1_8/evidence_immutability_manifest.json"
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

const forbiddenBeta26Paths = [
  "migrations",
  "server",
  "src/api"
];

for (
  const root
  of forbiddenBeta26Paths
) {
  if (!fs.existsSync(root)) {
    continue;
  }

  const stack = [root];

  while (stack.length > 0) {
    const current =
      stack.pop();

    const stat =
      fs.statSync(current);

    if (stat.isDirectory()) {
      for (
        const child
        of fs.readdirSync(current)
      ) {
        stack.push(
          `${current}/${child}`
        );
      }
    }
    else if (
      /beta[_-]?26/i.test(current)
    ) {
      fail(
        `forbidden_runtime_path::${current}`
      );
    }
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
      "BETA-26",
    token:
      "CI_BETA_26_EVIDENCE_IMMUTABILITY",
    storage_mode:
      "append_only_canonical_envelope_bytes",
    audit_event_type_count:
      BETA26_AUDIT_EVENT_TYPES
        .length,
    store_api_count:
      BETA26_STORE_API_KEYS
        .length,
    database_migration_added:
      false,
    api_route_added:
      false,
    message:
      "Sealed evidence bytes, checksum verification, denied mutation, and illegal creation paths passed."
  })
);
