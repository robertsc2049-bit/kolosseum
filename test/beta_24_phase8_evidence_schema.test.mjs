// DEV NOTE: BETA-24 closed-world Phase 8 EvidenceEnvelope schema tests.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

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
} from "../ci/lib/beta24_phase8_evidence_schema_lib.mjs";

const paths = {
  contract:
    "replay/contracts/beta24_phase8_evidence_schema_contract.json",
  schema:
    "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
  failureTokens:
    "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
  runnerVerdictContract:
    "replay/contracts/beta23_runner_verdict_contract.json",
  runnerVerdictSchema:
    "replay/contracts/beta23_runner_verdict.schema.json",
  runnerVerdictManifest:
    "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
  v1EvidenceContract:
    "docs/v1/V1_EVIDENCE_ENVELOPE_CONTRACT.md",
  manifest:
    "replay/suite/beta_phase1_8/evidence_schema_manifest.json"
};

function readText(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

function readJson(path) {
  return JSON.parse(
    readText(path)
  );
}

function fileTexts() {
  return {
    contract:
      readText(paths.contract),
    schema:
      readText(paths.schema),
    failure_tokens:
      readText(paths.failureTokens),
    runner_verdict_contract:
      readText(
        paths.runnerVerdictContract
      ),
    runner_verdict_schema:
      readText(
        paths.runnerVerdictSchema
      ),
    runner_verdict_manifest:
      readText(
        paths.runnerVerdictManifest
      ),
    v1_evidence_contract:
      readText(
        paths.v1EvidenceContract
      )
  };
}

function validEnvelope() {
  return {
    evidence_envelope_id:
      `beta24_evidence_envelope_${"a".repeat(24)}`,
    engine_version:
      "EB2-1.0.0",
    enum_bundle_version:
      "EB2-1.0.0",
    replay_suite_version:
      "1.0.0",
    canonical_input_hash:
      "1".repeat(64),
    selection_hash:
      "2".repeat(64),
    execution_trace_hash:
      "3".repeat(64),
    projection_hash:
      "4".repeat(64),
    runner_verdict_id:
      `beta23_runner_verdict_${"b".repeat(24)}`,
    runner_verdict_checksum_sha256:
      "5".repeat(64),
    runner_verdict:
      "ACCEPTED",
    phase5_output_checksum_sha256:
      "6".repeat(64),
    phase6_output_checksum_sha256:
      "7".repeat(64),
    phase7_output_checksum_sha256:
      "8".repeat(64),
    evidence_envelope_checksum_sha256:
      "9".repeat(64),
    evidence_scope:
      "process_verification_only",
    limitations:
      [...BETA24_LIMITATIONS],
    failure_tokens: []
  };
}

function validator() {
  const ajv =
    new Ajv2020({
      allErrors: true,
      strict: true
    });

  return ajv.compile(
    readJson(paths.schema)
  );
}

test(
  "BETA-24 contract and schema expose the exact closed EvidenceEnvelope field set",
  () => {
    const schema =
      readJson(paths.schema);

    assert.deepEqual(
      readJson(paths.contract),
      beta24Phase8EvidenceSchemaContract
    );

    assert.equal(
      schema.additionalProperties,
      false
    );

    assert.deepEqual(
      schema.required,
      BETA24_EVIDENCE_ENVELOPE_KEYS
    );

    assert.deepEqual(
      Object.keys(
        schema.properties
      ),
      BETA24_EVIDENCE_ENVELOPE_KEYS
    );

    assert.deepEqual(
      beta24Phase8EvidenceSchemaContract
        .phase_output_checksum_fields,
      BETA24_PHASE_OUTPUT_CHECKSUM_KEYS
    );

    assert.equal(
      beta24Phase8EvidenceSchemaContract
        .runtime_sealing_implemented,
      false
    );

    assert.equal(
      beta24Phase8EvidenceSchemaContract
        .persistence_implemented,
      false
    );

    assert.deepEqual(
      readJson(
        paths.failureTokens
      ).tokens,
      BETA24_FAILURE_TOKENS
    );
  }
);

test(
  "BETA-24 valid EvidenceEnvelope passes strict JSON Schema validation",
  () => {
    const validate =
      validator();

    assert.equal(
      validate(
        validEnvelope()
      ),
      true,
      JSON.stringify(
        validate.errors
      )
    );
  }
);

test(
  "BETA-24 missing required field fails closed",
  () => {
    const validate =
      validator();

    const envelope =
      validEnvelope();

    delete envelope
      .phase7_output_checksum_sha256;

    assert.equal(
      validate(envelope),
      false
    );

    assert.equal(
      validate.errors.some(
        (error) =>
          error.keyword ===
          "required"
      ),
      true
    );
  }
);

test(
  "BETA-24 extra field fails closed",
  () => {
    const validate =
      validator();

    const envelope =
      validEnvelope();

    envelope.coach_notes =
      "forbidden";

    assert.equal(
      validate(envelope),
      false
    );

    assert.equal(
      validate.errors.some(
        (error) =>
          error.keyword ===
          "additionalProperties"
      ),
      true
    );
  }
);

test(
  "BETA-24 invalid enum fails closed",
  () => {
    const validate =
      validator();

    const envelope =
      validEnvelope();

    envelope.runner_verdict =
      "APPROVED";

    assert.equal(
      validate(envelope),
      false
    );

    assert.equal(
      validate.errors.some(
        (error) =>
          error.keyword ===
          "const"
      ),
      true
    );
  }
);

test(
  "BETA-24 illegal null fails closed",
  () => {
    const validate =
      validator();

    const envelope =
      validEnvelope();

    envelope.selection_hash =
      null;

    assert.equal(
      validate(envelope),
      false
    );

    assert.equal(
      validate.errors.some(
        (error) =>
          error.keyword ===
          "type"
      ),
      true
    );
  }
);

test(
  "BETA-24 sealed_at is not admitted without a canonical replay-safe clock",
  () => {
    const validate =
      validator();

    const envelope =
      validEnvelope();

    envelope.sealed_at =
      "2026-09-01T00:00:00.000Z";

    assert.equal(
      beta24Phase8EvidenceSchemaContract
        .sealed_at_admitted,
      false
    );

    assert.equal(
      validate(envelope),
      false
    );

    assert.equal(
      validate.errors.some(
        (error) =>
          error.keyword ===
          "additionalProperties"
      ),
      true
    );
  }
);

test(
  "BETA-24 user narrative coach notes payment org and marketing metadata are impossible",
  () => {
    const schema =
      readJson(paths.schema);

    for (
      const field
      of BETA24_FORBIDDEN_METADATA_FIELDS
    ) {
      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            schema.properties,
            field
          ),
        false,
        field
      );
    }

    assert.deepEqual(
      schema
        .properties
        .limitations
        .const,
      BETA24_LIMITATIONS
    );

    assert.deepEqual(
      schema
        .properties
        .failure_tokens
        .const,
      []
    );
  }
);

test(
  "BETA-24 manifest binds exact schema contract and upstream RunnerVerdict bytes",
  () => {
    const actual =
      readJson(paths.manifest);

    const expected =
      buildBeta24EvidenceSchemaManifest(
        fileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta24EvidenceSchemaManifest(
        actual,
        fileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-24 v0 compatibility uses exact replay exclusions only",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/contracts/beta24_phase8_evidence_schema_contract.json",
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json",
        "replay/contracts/beta24_phase8_evidence_schema_failure_tokens.json",
        "replay/suite/beta_phase1_8/evidence_schema_manifest.json"
      ]
    ) {
      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1,
        exactPath
      );
    }

    assert.equal(
      source.includes(
        '"replay/contracts"'
      ),
      false
    );

    assert.equal(
      source.includes(
        '"replay/suite/beta_phase1_8"'
      ),
      false
    );
  }
);
