// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-24 closed-world Phase 8 EvidenceEnvelope schema guard.

import fs from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

import {
  BETA24_EVIDENCE_ENVELOPE_KEYS,
  BETA24_FAILURE_TOKENS,
  BETA24_FORBIDDEN_METADATA_FIELDS,
  BETA24_LIMITATIONS,
  BETA24_PHASE_OUTPUT_CHECKSUM_KEYS,
  beta24Phase8EvidenceSchemaContract,
  buildBeta24EvidenceSchemaManifest,
  verifyBeta24EvidenceSchemaManifest
} from "../lib/beta24_phase8_evidence_schema_lib.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_24_PHASE8_EVIDENCE_SCHEMA::FAIL::${message}`
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
    "replay/contracts/beta24_phase8_evidence_schema_contract.json",
  schema:
    "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
  tokens:
    "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
  manifest:
    "replay/suite/beta_phase1_8/evidence_schema_manifest.json",
  runnerVerdictContract:
    "replay/contracts/beta23_runner_verdict_contract.json",
  runnerVerdictSchema:
    "replay/contracts/beta23_runner_verdict.schema.json",
  runnerVerdictManifest:
    "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
  v1EvidenceContract:
    "docs/v1/V1_EVIDENCE_ENVELOPE_CONTRACT.md",
  documentation:
    "docs/runtime/BETA_24_PHASE8_EVIDENCE_SCHEMA.md",
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

const schema =
  readJson(files.schema);

const tokens =
  readJson(files.tokens);

const manifest =
  readJson(files.manifest);

if (
  JSON.stringify(contract) !==
  JSON.stringify(
    beta24Phase8EvidenceSchemaContract
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
    BETA24_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (schema) {
  try {
    const ajv =
      new Ajv2020({
        allErrors: true,
        strict: true
      });

    ajv.compile(schema);
  }
  catch (error) {
    fail(
      `schema_invalid::${String(error?.message ?? error)}`
    );
  }

  if (
    schema.additionalProperties !==
    false
  ) {
    fail(
      "additional_properties_not_closed"
    );
  }

  if (
    JSON.stringify(
      schema.required
    ) !==
    JSON.stringify(
      BETA24_EVIDENCE_ENVELOPE_KEYS
    )
  ) {
    fail(
      "required_field_set_invalid"
    );
  }

  if (
    JSON.stringify(
      Object.keys(
        schema.properties ?? {}
      )
    ) !==
    JSON.stringify(
      BETA24_EVIDENCE_ENVELOPE_KEYS
    )
  ) {
    fail(
      "property_field_set_invalid"
    );
  }

  if (
    schema
      .properties
      ?.runner_verdict
      ?.const !==
    "ACCEPTED"
  ) {
    fail(
      "runner_verdict_not_accepted_only"
    );
  }

  if (
    schema
      .properties
      ?.evidence_scope
      ?.const !==
    "process_verification_only"
  ) {
    fail(
      "evidence_scope_invalid"
    );
  }

  if (
    JSON.stringify(
      schema
        .properties
        ?.limitations
        ?.const
    ) !==
    JSON.stringify(
      BETA24_LIMITATIONS
    )
  ) {
    fail(
      "limitations_invalid"
    );
  }

  if (
    JSON.stringify(
      schema
        .properties
        ?.failure_tokens
        ?.const
    ) !==
    JSON.stringify([])
  ) {
    fail(
      "failure_tokens_not_empty"
    );
  }

  for (
    const field
    of BETA24_FORBIDDEN_METADATA_FIELDS
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          schema.properties ?? {},
          field
        )
    ) {
      fail(
        `forbidden_metadata_admitted::${field}`
      );
    }
  }

  for (
    const field
    of BETA24_PHASE_OUTPUT_CHECKSUM_KEYS
  ) {
    if (
      schema
        .properties
        ?.[field]
        ?.pattern !==
      "^[a-f0-9]{64}$"
    ) {
      fail(
        `phase_output_checksum_invalid::${field}`
      );
    }
  }
}

const fileTexts = {
  contract:
    text.contract,
  schema:
    text.schema,
  failure_tokens:
    text.tokens,
  runner_verdict_contract:
    text.runnerVerdictContract,
  runner_verdict_schema:
    text.runnerVerdictSchema,
  runner_verdict_manifest:
    text.runnerVerdictManifest,
  v1_evidence_contract:
    text.v1EvidenceContract
};

if (manifest) {
  const expected =
    buildBeta24EvidenceSchemaManifest(
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
    verifyBeta24EvidenceSchemaManifest(
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
    "EvidenceEnvelope",
    "additionalProperties",
    "execution_trace_hash",
    "runner_verdict_checksum_sha256",
    "phase5_output_checksum_sha256",
    "phase6_output_checksum_sha256",
    "phase7_output_checksum_sha256",
    "process_verification_only",
    "sealed_at",
    "No narrative",
    "No persistence"
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
    '"proof:beta-24"'
  ) ||
  !text.package.includes(
    "run_beta_24_phase8_evidence_schema_tests.mjs"
  )
) {
  fail(
    "package_proof_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-24"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/contracts/beta24_phase8_evidence_schema_contract.json",
    "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
    "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
    "replay/suite/beta_phase1_8/evidence_schema_manifest.json"
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
    guard: "BETA-24",
    token:
      "CI_BETA_24_PHASE8_EVIDENCE_SCHEMA",
    required_field_count:
      BETA24_EVIDENCE_ENVELOPE_KEYS
        .length,
    phase_output_checksum_count:
      BETA24_PHASE_OUTPUT_CHECKSUM_KEYS
        .length,
    evidence_scope:
      "process_verification_only",
    sealed_at_admitted:
      false,
    additional_properties:
      false,
    runtime_sealing_implemented:
      false,
    message:
      "Closed Phase 8 EvidenceEnvelope schema and metadata exclusion boundary passed."
  })
);
