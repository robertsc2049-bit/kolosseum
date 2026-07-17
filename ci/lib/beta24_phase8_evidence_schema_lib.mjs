// DEV NOTE: BETA-24 closed-world Phase 8 EvidenceEnvelope schema metadata.
// This CI-only library defines schema law and manifest binding. It does not
// create, persist, regenerate, or seal runtime evidence envelopes.

import crypto from "node:crypto";

import {
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

export const BETA24_EVIDENCE_ENVELOPE_KEYS =
  Object.freeze([
    "evidence_envelope_id",
    "engine_version",
    "enum_bundle_version",
    "replay_suite_version",
    "canonical_input_hash",
    "selection_hash",
    "execution_trace_hash",
    "projection_hash",
    "runner_verdict_id",
    "runner_verdict_checksum_sha256",
    "runner_verdict",
    "phase5_output_checksum_sha256",
    "phase6_output_checksum_sha256",
    "phase7_output_checksum_sha256",
    "evidence_envelope_checksum_sha256",
    "evidence_scope",
    "limitations",
    "failure_tokens"
  ]);

export const BETA24_PHASE_OUTPUT_CHECKSUM_KEYS =
  Object.freeze([
    "phase5_output_checksum_sha256",
    "phase6_output_checksum_sha256",
    "phase7_output_checksum_sha256"
  ]);

export const BETA24_LIMITATIONS =
  Object.freeze([
    "no_correctness_claim",
    "no_safety_claim",
    "no_suitability_claim",
    "no_effectiveness_claim",
    "no_outcome_quality_claim",
    "no_external_approval"
  ]);

export const BETA24_FORBIDDEN_METADATA_FIELDS =
  Object.freeze([
    "sealed_at",
    "user_narrative",
    "coach_notes",
    "payment_state",
    "commercial_state",
    "org_metadata",
    "organization_metadata",
    "organisation_metadata",
    "marketing_copy"
  ]);

export const BETA24_FAILURE_TOKENS =
  Object.freeze([
    "beta24_schema_invalid",
    "beta24_missing_required_field",
    "beta24_extra_field",
    "beta24_invalid_enum",
    "beta24_illegal_null",
    "beta24_manifest_invalid"
  ]);

export const beta24Phase8EvidenceSchemaContract =
  Object.freeze({
    contract_id:
      "beta24_phase8_evidence_schema_contract",
    slice_id: "BETA-24",
    version: "1.0.0",
    schema_id:
      "kolosseum.beta24.phase8_evidence_envelope.v1",
    engine_version:
      "EB2-1.0.0",
    enum_bundle_version:
      "EB2-1.0.0",
    replay_suite_version:
      "1.0.0",
    runner_verdict_required:
      "ACCEPTED",
    evidence_scope:
      "process_verification_only",
    required_fields:
      BETA24_EVIDENCE_ENVELOPE_KEYS,
    phase_output_checksum_fields:
      BETA24_PHASE_OUTPUT_CHECKSUM_KEYS,
    limitations:
      BETA24_LIMITATIONS,
    failure_tokens_allowed:
      Object.freeze([]),
    additional_properties:
      false,
    null_values_allowed:
      false,
    sealed_at_admitted:
      false,
    sealed_at_reason:
      "no_canonical_replay_safe_clock_contract",
    forbidden_metadata_fields:
      BETA24_FORBIDDEN_METADATA_FIELDS,
    runtime_sealing_implemented:
      false,
    persistence_implemented:
      false
  });

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
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
      JSON.parse(
        JSON.stringify(details)
      )
  });
}

export function buildBeta24EvidenceSchemaManifest(
  fileTexts
) {
  const required = [
    "contract",
    "schema",
    "failure_tokens",
    "runner_verdict_contract",
    "runner_verdict_schema",
    "runner_verdict_manifest",
    "v1_evidence_contract"
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
        "beta24_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta24.phase8_evidence_schema_manifest.v1.0.0",
    slice_id: "BETA-24",
    contract_version:
      beta24Phase8EvidenceSchemaContract
        .version,
    schema_id:
      beta24Phase8EvidenceSchemaContract
        .schema_id,
    upstream_runner_verdict_contract_version:
      "1.0.0",
    evidence_scope:
      beta24Phase8EvidenceSchemaContract
        .evidence_scope,
    required_field_count:
      BETA24_EVIDENCE_ENVELOPE_KEYS
        .length,
    phase_output_checksum_count:
      BETA24_PHASE_OUTPUT_CHECKSUM_KEYS
        .length,
    sealed_at_admitted:
      false,
    runtime_sealing_implemented:
      false,
    paths: {
      contract:
        "replay/contracts/beta24_phase8_evidence_schema_contract.json",
      schema:
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
      failure_tokens:
        "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
      runner_verdict_contract:
        "replay/contracts/beta23_runner_verdict_contract.json",
      runner_verdict_schema:
        "replay/contracts/beta23_runner_verdict.schema.json",
      runner_verdict_manifest:
        "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
      v1_evidence_contract:
        "docs/v1/V1_EVIDENCE_ENVELOPE_CONTRACT.md"
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

export function verifyBeta24EvidenceSchemaManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta24EvidenceSchemaManifest(
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
      "beta24_manifest_invalid"
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
