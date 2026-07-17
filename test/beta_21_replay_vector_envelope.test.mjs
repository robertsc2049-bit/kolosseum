// DEV NOTE: BETA-21 deterministic Phase 1-7 replay-vector envelope tests.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  BETA21_FAILURE_TOKENS,
  BETA21_VECTOR_IDS,
  beta21ReplayVectorEnvelopeContract,
  buildBeta21ReplayVectorManifest,
  buildBeta21ReplayVectorSuite,
  renderBeta21ReplayVectorSuite,
  validateBeta21ReplayVectorSuite,
  verifyBeta21ReplayVectorSuite
} from "../ci/lib/beta21_replay_vector_envelope_lib.mjs";

const suitePath =
  "replay/suite/beta_phase1_7/vectors.json";

const manifestPath =
  "replay/suite/beta_phase1_7/manifest.json";

function readJson(path) {
  return JSON.parse(
    fs.readFileSync(
      path,
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256(text) {
  return crypto
    .createHash("sha256")
    .update(
      text,
      "utf8"
    )
    .digest("hex");
}

test(
  "BETA-21 schema validates the committed vector suite",
  () => {
    const schema =
      readJson(
        "replay/contracts/beta21_replay_vector_envelope.schema.json"
      );

    const suite =
      readJson(
        suitePath
      );

    const ajv =
      new Ajv2020({
        allErrors: true,
        strict: true
      });

    const validate =
      ajv.compile(schema);

    assert.equal(
      validate(suite),
      true,
      JSON.stringify(
        validate.errors
      )
    );
  }
);

test(
  "BETA-21 extends CVE without implementation mutation",
  () => {
    assert.equal(
      beta21ReplayVectorEnvelopeContract
        .cve_version,
      "BETA-CVE-1.0.0"
    );

    assert.equal(
      beta21ReplayVectorEnvelopeContract
        .extends_cve_version,
      "CVE-1.0.0"
    );

    assert.equal(
      beta21ReplayVectorEnvelopeContract
        .implementation_mutation_allowed,
      false
    );

    assert.deepEqual(
      beta21ReplayVectorEnvelopeContract
        .phases_under_test,
      [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7"
      ]
    );
  }
);

test(
  "BETA-21 generation is byte-stable",
  () => {
    const first =
      renderBeta21ReplayVectorSuite(
        buildBeta21ReplayVectorSuite()
      );

    const second =
      renderBeta21ReplayVectorSuite(
        buildBeta21ReplayVectorSuite()
      );

    assert.equal(first, second);
    assert.equal(
      sha256(first),
      sha256(second)
    );

    assert.equal(
      fs.readFileSync(
        suitePath,
        "utf8"
      ),
      first
    );
  }
);

test(
  "BETA-21 contains the exact required vector order",
  () => {
    const suite =
      readJson(suitePath);

    assert.deepEqual(
      suite.vectors.map(
        (vector) =>
          vector.cve_header
            .vector_id
      ),
      BETA21_VECTOR_IDS
    );

    assert.equal(
      suite.vectors.filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "positive"
      ).length,
      5
    );

    assert.equal(
      suite.vectors.filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "negative_shell"
      ).length,
      3
    );
  }
);

test(
  "BETA-21 positive vectors contain all Phase 5-7 output hashes",
  () => {
    const suite =
      readJson(suitePath);

    const hashFields = [
      "phase5_output_hash_sha256",
      "phase6_output_hash_sha256",
      "phase6_reducer_state_hash_sha256",
      "phase7_output_hash_sha256",
      "phase7_projection_hash_sha256"
    ];

    for (
      const vector
      of suite.vectors.filter(
        (candidate) =>
          candidate.cve_header
            .vector_class ===
          "positive"
      )
    ) {
      assert.equal(
        vector.expected.verdict,
        "PASS"
      );

      assert.equal(
        vector.expected
          .failure_token,
        null
      );

      assert.equal(
        vector.pins
          .enum_bundle_version,
        "EB2-1.0.0"
      );

      assert.equal(
        vector.pins
          .registry_references
          .length,
        2
      );

      for (const field of hashFields) {
        assert.match(
          vector.expected[field],
          /^[a-f0-9]{64}$/u
        );
      }
    }
  }
);

test(
  "BETA-21 required execution scenarios are factual",
  () => {
    const suite =
      readJson(suitePath);

    const split =
      suite.vectors.find(
        (vector) =>
          vector.cve_header
            .vector_id ===
          "beta21_split_continue"
      );

    const partial =
      suite.vectors.find(
        (vector) =>
          vector.cve_header
            .vector_id ===
          "beta21_partial_completion"
      );

    assert.ok(split);
    assert.ok(partial);

    assert.equal(
      split.execution_plan
        .phase6_events
        .some(
          (event) =>
            event.event_type ===
              "SPLIT_RETURN_DECISION" &&
            event.payload
              ?.decision ===
              "continue"
        ),
      true
    );

    assert.equal(
      partial.execution_plan
        .phase6_events
        .at(-1)
        .payload
        .end_code,
      "stopped"
    );
  }
);

test(
  "BETA-21 coach-managed rugby vector carries its Phase 1 authority binding",
  () => {
    const suite =
      readJson(suitePath);

    const vector =
      suite.vectors.find(
        (candidate) =>
          candidate.cve_header
            .vector_id ===
          "beta21_coach_managed_rugby_union"
      );

    assert.ok(vector);

    assert.equal(
      vector.cve_header
        .execution_scope,
      "coach_managed"
    );

    assert.equal(
      vector.cve_header
        .activity_id,
      "rugby_union"
    );

    assert.equal(
      vector
        .canonical_phase1_input
        .governing_authority_id,
      "beta21_governing_authority"
    );
  }
);

test(
  "BETA-21 negative shells use exact registered failure tokens",
  () => {
    const suite =
      readJson(suitePath);

    const negative =
      suite.vectors.filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "negative_shell"
      );

    assert.deepEqual(
      negative.map(
        (vector) =>
          vector.expected
            .failure_token
      ),
      BETA21_FAILURE_TOKENS
    );

    for (const vector of negative) {
      assert.equal(
        vector.expected.verdict,
        "FAIL"
      );

      assert.equal(
        vector.expected
          .phase5_output_hash_sha256,
        null
      );

      assert.equal(
        vector.expected
          .phase6_output_hash_sha256,
        null
      );

      assert.equal(
        vector.expected
          .phase7_output_hash_sha256,
        null
      );

      assert.ok(
        vector.negative_case
      );
    }
  }
);

test(
  "BETA-21 invalid failure tokens fail closed",
  () => {
    const suite =
      clone(
        readJson(suitePath)
      );

    const vector =
      suite.vectors.find(
        (candidate) =>
          candidate.cve_header
            .vector_id ===
          "beta21_negative_invalid_token"
      );

    vector.expected.failure_token =
      "not_registered";

    const result =
      validateBeta21ReplayVectorSuite(
        suite
      );

    assert.equal(result.ok, false);
    assert.equal(
      result.failure_token,
      "beta21_invalid_failure_token"
    );
  }
);

test(
  "BETA-21 missing phase output fails closed",
  () => {
    const suite =
      clone(
        readJson(suitePath)
      );

    suite.vectors[0]
      .expected
      .phase6_output_hash_sha256 =
        null;

    const result =
      validateBeta21ReplayVectorSuite(
        suite
      );

    assert.equal(result.ok, false);
    assert.equal(
      result.failure_token,
      "beta21_missing_phase_output"
    );
  }
);

test(
  "BETA-21 output divergence fails closed",
  () => {
    const suite =
      clone(
        readJson(suitePath)
      );

    suite.vectors[0]
      .expected
      .phase7_output_hash_sha256 =
        "0".repeat(64);

    const result =
      verifyBeta21ReplayVectorSuite(
        suite
      );

    assert.equal(result.ok, false);
    assert.equal(
      result.failure_token,
      "beta21_replay_divergence"
    );
  }
);

test(
  "BETA-21 committed suite matches the current Phase 1-7 chain",
  () => {
    const result =
      verifyBeta21ReplayVectorSuite(
        readJson(suitePath)
      );

    assert.equal(result.ok, true);
    assert.equal(
      result.verdict,
      "PASS"
    );

    assert.equal(
      result.vector_count,
      8
    );
  }
);

test(
  "BETA-21 manifest binds exact vector bytes",
  () => {
    const suiteText =
      fs.readFileSync(
        suitePath,
        "utf8"
      );

    const actual =
      readJson(manifestPath);

    const expected =
      buildBeta21ReplayVectorManifest(
        suiteText
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      actual.suite_sha256,
      sha256(suiteText)
    );
  }
);

test(
  "BETA-21 vectors contain no implementation mutation or product state",
  () => {
    const text =
      fs.readFileSync(
        suitePath,
        "utf8"
      );

    for (
      const forbidden
      of [
        "implementation_patch",
        "source_override",
        "engine_override",
        "registry_mutation",
        "coach_note",
        "payment_state",
        "product_tier"
      ]
    ) {
      assert.equal(
        text.includes(forbidden),
        false,
        forbidden
      );
    }

    assert.equal(
      text.includes(
        '"implementation_mutation_allowed": false'
      ),
      true
    );
  }
);

test(
  "BETA-21 v0 compatibility uses exact file exclusions only",
  () => {
    const source =
      fs.readFileSync(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs",
        "utf8"
      );

    for (
      const exactPath
      of [
        "replay/contracts/beta21_replay_vector_envelope.schema.json",
        "replay/contracts/beta21_replay_failure_tokens.json",
        "replay/suite/beta_phase1_7/vectors.json",
        "replay/suite/beta_phase1_7/manifest.json"
      ]
    ) {
      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1
      );
    }

    assert.equal(
      source.includes(
        '"replay/suite/beta_phase1_7"'
      ),
      false
    );

    assert.equal(
      source.includes(
        '"replay/contracts"'
      ),
      false
    );
  }
);
