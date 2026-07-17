// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-25 Phase 8 chain and seal-authorisation guard.

import fs from "node:fs";

import {
  BETA25_FAILURE_TOKENS,
  BETA25_PHASE8_INPUT_KEYS,
  BETA25_SEAL_GATE_OUTPUT_KEYS,
  BETA25_SEAL_GATE_STATE_KEYS,
  beta25Phase8ChainSealGatesContract,
  buildBeta25ChainSealManifest,
  verifyBeta25ChainSealManifest
} from "../lib/beta25_phase8_chain_seal_gates_lib.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_25_PHASE8_CHAIN_SEAL_GATES::FAIL::${message}`
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
  const text = read(path);

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
    "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
  tokens:
    "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json",
  manifest:
    "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json",
  beta24Contract:
    "replay/contracts/beta24_phase8_evidence_schema_contract.json",
  beta24Schema:
    "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
  beta23Contract:
    "replay/contracts/beta23_runner_verdict_contract.json",
  beta23Schema:
    "replay/contracts/beta23_runner_verdict.schema.json",
  phase5Source:
    "engine/src/phases/beta12Phase5Materialisation.ts",
  phase6Source:
    "engine/src/runtime/beta14_phase6_runtime_reducer.js",
  phase7Source:
    "engine/src/phases/beta18Phase7SchemaBinding.ts",
  clGateSource:
    "src/betaClGateSeparation.mjs",
  library:
    "ci/lib/beta25_phase8_chain_seal_gates_lib.mjs",
  documentation:
    "docs/runtime/BETA_25_PHASE8_CHAIN_SEAL_GATES.md",
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
  text[key] = read(path);
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
    beta25Phase8ChainSealGatesContract
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
    BETA25_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (
  JSON.stringify(
    contract?.phase8_input_fields
  ) !==
  JSON.stringify(
    BETA25_PHASE8_INPUT_KEYS
  ) ||
  contract
    ?.phase8_input_additional_properties !==
    false
) {
  fail(
    "phase8_input_not_closed"
  );
}

if (
  JSON.stringify(
    contract?.seal_gate_state_fields
  ) !==
  JSON.stringify(
    BETA25_SEAL_GATE_STATE_KEYS
  ) ||
  contract
    ?.seal_gate_state_additional_properties !==
    false
) {
  fail(
    "seal_gate_state_not_closed"
  );
}

if (
  JSON.stringify(
    contract?.seal_gate_output_fields
  ) !==
  JSON.stringify(
    BETA25_SEAL_GATE_OUTPUT_KEYS
  )
) {
  fail(
    "seal_gate_output_invalid"
  );
}

if (
  contract?.required_runner_verdict !==
    "ACCEPTED" ||
  contract?.required_pre_seal_state !==
    "inactive" ||
  contract?.evidence_envelope_materialisation !==
    false
) {
  fail(
    "seal_precondition_contract_invalid"
  );
}

for (
  const token
  of [
    "phase5_phase6_canonical_input_hash",
    "phase5_phase6_selection_hash",
    "phase6_phase7_canonical_input_hash",
    "phase6_phase7_selection_hash",
    "phase6_phase7_execution_status",
    "phase6_phase7_execution_state",
    "runner_canonical_input_hash",
    "runner_selection_hash",
    "runner_projection_hash",
    "beta25_cl_refused",
    "beta25_ci_failed",
    "beta25_replay_rejected",
    "beta25_pre_seal_active"
  ]
) {
  if (!text.library.includes(token)) {
    fail(
      `library_token_missing::${token}`
    );
  }
}

const fileTexts = {
  contract:
    text.contract,
  failure_tokens:
    text.tokens,
  beta24_contract:
    text.beta24Contract,
  beta24_schema:
    text.beta24Schema,
  beta23_contract:
    text.beta23Contract,
  beta23_schema:
    text.beta23Schema,
  phase5_source:
    text.phase5Source,
  phase6_source:
    text.phase6Source,
  phase7_source:
    text.phase7Source,
  cl_gate_source:
    text.clGateSource
};

if (manifest) {
  const expected =
    buildBeta25ChainSealManifest(
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
    verifyBeta25ChainSealManifest(
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
    "Phase8Input",
    "Phase 5",
    "Phase 6",
    "Phase 7",
    "RunnerVerdict",
    "CL passed",
    "CI passed",
    "pre_seal_state",
    "inactive",
    "additional fields",
    "No EvidenceEnvelope"
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
    '"proof:beta-25"'
  ) ||
  !text.package.includes(
    "run_beta_25_phase8_chain_seal_gates_tests.mjs"
  ) ||
  !text.package.includes(
    "beta_25_phase8_chain_seal_gates_guard.mjs"
  )
) {
  fail(
    "package_proof_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-25"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
    "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json",
    "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json"
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
    guard: "BETA-25",
    token:
      "CI_BETA_25_PHASE8_CHAIN_SEAL_GATES",
    phase8_input_field_count:
      BETA25_PHASE8_INPUT_KEYS.length,
    binding_rule_count:
      beta25Phase8ChainSealGatesContract
        .binding_rules.length,
    seal_precondition_count:
      beta25Phase8ChainSealGatesContract
        .seal_preconditions.length,
    evidence_envelope_materialisation:
      false,
    message:
      "Phase 8 chain validation and seal-authorisation gates passed."
  })
);
