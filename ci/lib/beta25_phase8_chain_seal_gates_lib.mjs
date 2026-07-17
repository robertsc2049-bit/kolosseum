// DEV NOTE: BETA-25 Phase 8 chain validation and seal-authorisation gates.
// Phase8Input contains upstream truth only. CL, CI, and pre-seal state remain
// separate gate-state facts and are never added to the EvidenceEnvelope schema.

import crypto from "node:crypto";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

import {
  validateBeta18Phase7Output
} from "../../engine/dist/src/phases/beta18Phase7SchemaBinding.js";

import {
  BETA23_RUNNER_VERDICT_KEYS,
  verifyBeta23RunnerVerdict
} from "./beta23_runner_verdict_lib.mjs";

export const BETA25_PHASE8_INPUT_KEYS =
  Object.freeze([
    "phase5_output",
    "phase6_output",
    "phase7_output",
    "runner_verdict"
  ]);

export const BETA25_SEAL_GATE_STATE_KEYS =
  Object.freeze([
    "cl_passed",
    "ci_passed",
    "pre_seal_state"
  ]);

export const BETA25_SEAL_GATE_OUTPUT_KEYS =
  Object.freeze([
    "phase8_seal_gate_id",
    "evidence_seal_authorised",
    "canonical_input_hash",
    "selection_hash",
    "projection_hash",
    "runner_verdict_id",
    "runner_verdict_checksum_sha256",
    "cl_passed",
    "ci_passed",
    "pre_seal_state"
  ]);

export const BETA25_FAILURE_TOKENS =
  Object.freeze([
    "beta25_input_invalid",
    "beta25_runner_missing",
    "beta25_extra_input_field",
    "beta25_gate_state_invalid",
    "beta25_cl_refused",
    "beta25_ci_failed",
    "beta25_replay_rejected",
    "beta25_runner_invalid",
    "beta25_evidence_chain_break",
    "beta25_pre_seal_active",
    "beta25_manifest_invalid"
  ]);

export const beta25Phase8ChainSealGatesContract =
  Object.freeze({
    contract_id:
      "beta25_phase8_chain_seal_gates_contract",
    slice_id: "BETA-25",
    version: "1.0.0",
    phase8_input_fields:
      BETA25_PHASE8_INPUT_KEYS,
    seal_gate_state_fields:
      BETA25_SEAL_GATE_STATE_KEYS,
    seal_gate_output_fields:
      BETA25_SEAL_GATE_OUTPUT_KEYS,
    phase8_input_additional_properties:
      false,
    seal_gate_state_additional_properties:
      false,
    required_runner_verdict:
      "ACCEPTED",
    required_pre_seal_state:
      "inactive",
    binding_rules:
      Object.freeze([
        "phase5_phase6_canonical_input_hash",
        "phase5_phase6_selection_hash",
        "phase6_phase7_canonical_input_hash",
        "phase6_phase7_selection_hash",
        "phase6_phase7_execution_status",
        "phase6_phase7_execution_state",
        "runner_canonical_input_hash",
        "runner_selection_hash",
        "runner_projection_hash"
      ]),
    seal_preconditions:
      Object.freeze([
        "cl_passed",
        "ci_passed",
        "runner_verdict_accepted",
        "evidence_chain_valid",
        "pre_seal_state_inactive"
      ]),
    evidence_envelope_materialisation:
      false,
    persistence_implemented:
      false
  });

const PHASE5_OUTPUT_KEYS =
  Object.freeze([
    "canonical_input_hash",
    "constraint_hash",
    "enumeration_hash",
    "selection_hash",
    "selected_candidate",
    "executable_session"
  ]);

const PHASE6_OUTPUT_KEYS =
  Object.freeze([
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state"
  ]);

const PHASE7_OUTPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state",
    "content_format",
    "rendered_output",
    "projection_hash"
  ]);

const HASH_RE = /^[a-f0-9]{64}$/u;

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

function isHash(value) {
  return (
    typeof value === "string" &&
    HASH_RE.test(value)
  );
}

function phase5IsValid(value) {
  if (
    !exactKeys(
      value,
      PHASE5_OUTPUT_KEYS
    ) ||
    !isHash(
      value.canonical_input_hash
    ) ||
    !isHash(
      value.constraint_hash
    ) ||
    !isHash(
      value.enumeration_hash
    ) ||
    !isHash(
      value.selection_hash
    ) ||
    !isRecord(
      value.selected_candidate
    ) ||
    !isRecord(
      value.executable_session
    )
  ) {
    return false;
  }

  return (
    value.selection_hash ===
    betaCanonicalHash({
      canonical_input_hash:
        value.canonical_input_hash,
      constraint_hash:
        value.constraint_hash,
      enumeration_hash:
        value.enumeration_hash,
      selected_candidate:
        value.selected_candidate
    })
  );
}

function phase6IsValid(value) {
  return (
    exactKeys(
      value,
      PHASE6_OUTPUT_KEYS
    ) &&
    isHash(
      value.canonical_input_hash
    ) &&
    isHash(
      value.selection_hash
    ) &&
    typeof value.execution_status ===
      "string" &&
    value.execution_status.length > 0 &&
    isRecord(
      value.execution_state
    )
  );
}

function phase7IsValid(
  phase6Output,
  phase7Output
) {
  if (
    !exactKeys(
      phase7Output,
      PHASE7_OUTPUT_KEYS
    ) ||
    !isHash(
      phase7Output.canonical_input_hash
    ) ||
    !isHash(
      phase7Output.selection_hash
    ) ||
    !isHash(
      phase7Output.projection_hash
    ) ||
    typeof phase7Output
      .phase7_projection_id !==
      "string" ||
    phase7Output
      .phase7_projection_id.length ===
      0 ||
    phase7Output.content_format !==
      "application/json" ||
    typeof phase7Output
      .rendered_output !==
      "string" ||
    !isRecord(
      phase7Output.execution_state
    )
  ) {
    return false;
  }

  try {
    validateBeta18Phase7Output(
      {
        phase7_projection_id:
          phase7Output
            .phase7_projection_id,
        content_format:
          phase7Output
            .content_format,
        phase6_output:
          phase6Output
      },
      phase7Output
    );

    return true;
  }
  catch {
    return false;
  }
}

function gateStateIsValid(value) {
  return (
    exactKeys(
      value,
      BETA25_SEAL_GATE_STATE_KEYS
    ) &&
    typeof value.cl_passed ===
      "boolean" &&
    typeof value.ci_passed ===
      "boolean" &&
    (
      value.pre_seal_state ===
        "active" ||
      value.pre_seal_state ===
        "inactive"
    )
  );
}

function chainBreak(binding) {
  return failure(
    "beta25_evidence_chain_break",
    {
      binding
    }
  );
}

export function evaluateBeta25Phase8ChainSealGates(
  phase8Input,
  gateState
) {
  if (!isRecord(phase8Input)) {
    return failure(
      "beta25_input_invalid"
    );
  }

  if (
    !Object.prototype
      .hasOwnProperty.call(
        phase8Input,
        "runner_verdict"
      ) ||
    phase8Input.runner_verdict ===
      null ||
    phase8Input.runner_verdict ===
      undefined
  ) {
    return failure(
      "beta25_runner_missing"
    );
  }

  if (
    !exactKeys(
      phase8Input,
      BETA25_PHASE8_INPUT_KEYS
    )
  ) {
    return failure(
      "beta25_extra_input_field"
    );
  }

  if (!gateStateIsValid(gateState)) {
    return failure(
      "beta25_gate_state_invalid"
    );
  }

  if (gateState.cl_passed !== true) {
    return failure(
      "beta25_cl_refused"
    );
  }

  if (gateState.ci_passed !== true) {
    return failure(
      "beta25_ci_failed"
    );
  }

  if (
    gateState.pre_seal_state ===
    "active"
  ) {
    return failure(
      "beta25_pre_seal_active"
    );
  }

  const phase5 =
    phase8Input.phase5_output;
  const phase6 =
    phase8Input.phase6_output;
  const phase7 =
    phase8Input.phase7_output;
  const runner =
    phase8Input.runner_verdict;

  if (
    !phase5IsValid(phase5) ||
    !phase6IsValid(phase6)
  ) {
    return failure(
      "beta25_input_invalid"
    );
  }

  if (
    !phase7IsValid(
      phase6,
      phase7
    )
  ) {
    return chainBreak(
      "phase6_phase7_output_validation"
    );
  }

  if (
    !exactKeys(
      runner,
      BETA23_RUNNER_VERDICT_KEYS
    )
  ) {
    return failure(
      "beta25_runner_invalid"
    );
  }

  const runnerVerification =
    verifyBeta23RunnerVerdict(
      runner
    );

  if (!runnerVerification.ok) {
    return failure(
      "beta25_runner_invalid",
      {
        upstream_failure_token:
          runnerVerification
            .failure_token
      }
    );
  }

  if (runner.verdict !== "ACCEPTED") {
    return failure(
      "beta25_replay_rejected"
    );
  }

  if (
    phase5.canonical_input_hash !==
    phase6.canonical_input_hash
  ) {
    return chainBreak(
      "phase5_phase6_canonical_input_hash"
    );
  }

  if (
    phase5.selection_hash !==
    phase6.selection_hash
  ) {
    return chainBreak(
      "phase5_phase6_selection_hash"
    );
  }

  if (
    phase6.canonical_input_hash !==
    phase7.canonical_input_hash
  ) {
    return chainBreak(
      "phase6_phase7_canonical_input_hash"
    );
  }

  if (
    phase6.selection_hash !==
    phase7.selection_hash
  ) {
    return chainBreak(
      "phase6_phase7_selection_hash"
    );
  }

  if (
    phase6.execution_status !==
    phase7.execution_status
  ) {
    return chainBreak(
      "phase6_phase7_execution_status"
    );
  }

  if (
    betaCanonicalJson(
      phase6.execution_state
    ) !==
    betaCanonicalJson(
      phase7.execution_state
    )
  ) {
    return chainBreak(
      "phase6_phase7_execution_state"
    );
  }

  if (
    runner.canonical_input_hash !==
    phase6.canonical_input_hash
  ) {
    return chainBreak(
      "runner_canonical_input_hash"
    );
  }

  if (
    runner.selection_hash !==
    phase5.selection_hash
  ) {
    return chainBreak(
      "runner_selection_hash"
    );
  }

  if (
    runner.projection_hash !==
    phase7.projection_hash
  ) {
    return chainBreak(
      "runner_projection_hash"
    );
  }

  const gateMaterial = {
    canonical_input_hash:
      phase6.canonical_input_hash,
    selection_hash:
      phase5.selection_hash,
    projection_hash:
      phase7.projection_hash,
    runner_verdict_id:
      runner.runner_verdict_id,
    runner_verdict_checksum_sha256:
      runner
        .runner_verdict_checksum_sha256
  };

  const phase8SealGateId =
    "beta25_phase8_seal_gate_" +
    betaCanonicalHash(
      gateMaterial
    ).slice(0, 24);

  return deepFreeze({
    ok: true,
    seal_gate:
      deepFreeze({
        phase8_seal_gate_id:
          phase8SealGateId,
        evidence_seal_authorised:
          true,
        canonical_input_hash:
          gateMaterial
            .canonical_input_hash,
        selection_hash:
          gateMaterial
            .selection_hash,
        projection_hash:
          gateMaterial
            .projection_hash,
        runner_verdict_id:
          gateMaterial
            .runner_verdict_id,
        runner_verdict_checksum_sha256:
          gateMaterial
            .runner_verdict_checksum_sha256,
        cl_passed: true,
        ci_passed: true,
        pre_seal_state:
          "inactive"
      })
  });
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

export function buildBeta25ChainSealManifest(
  fileTexts
) {
  const required = [
    "contract",
    "failure_tokens",
    "beta24_contract",
    "beta24_schema",
    "beta23_contract",
    "beta23_schema",
    "phase5_source",
    "phase6_source",
    "phase7_source",
    "cl_gate_source"
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
        "beta25_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta25.phase8_chain_seal_gates_manifest.v1.0.0",
    slice_id: "BETA-25",
    contract_version:
      beta25Phase8ChainSealGatesContract
        .version,
    phase8_input_field_count:
      BETA25_PHASE8_INPUT_KEYS
        .length,
    binding_rule_count:
      beta25Phase8ChainSealGatesContract
        .binding_rules.length,
    seal_precondition_count:
      beta25Phase8ChainSealGatesContract
        .seal_preconditions.length,
    evidence_envelope_materialisation:
      false,
    paths: {
      contract:
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
      failure_tokens:
        "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json",
      beta24_contract:
        "replay/contracts/beta24_phase8_evidence_schema_contract.json",
      beta24_schema:
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
      beta23_contract:
        "replay/contracts/beta23_runner_verdict_contract.json",
      beta23_schema:
        "replay/contracts/beta23_runner_verdict.schema.json",
      phase5_source:
        "engine/src/phases/beta12Phase5Materialisation.ts",
      phase6_source:
        "engine/src/runtime/beta14_phase6_runtime_reducer.js",
      phase7_source:
        "engine/src/phases/beta18Phase7SchemaBinding.ts",
      cl_gate_source:
        "src/betaClGateSeparation.mjs"
    },
    sha256:
      Object.fromEntries(
        required.map(
          (key) => [
            key,
            sha256(
              fileTexts[key]
            )
          ]
        )
      )
  });
}

export function verifyBeta25ChainSealManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta25ChainSealManifest(
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
      "beta25_manifest_invalid"
    );
  }

  return deepFreeze({
    ok: true,
    manifest_sha256:
      sha256(
        betaCanonicalJson(
          manifest
        )
      )
  });
}
