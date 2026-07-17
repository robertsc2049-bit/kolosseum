// DEV NOTE: BETA-22 verify-only replay runner tests.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  spawnSync
} from "node:child_process";
import test from "node:test";

import {
  BETA22_FAILURE_TOKENS,
  BETA22_PHASE_ORDER,
  BETA22_REPEAT_COUNT,
  beta22ReplayVerifyContract,
  buildBeta22VerifyManifest,
  parseBeta22CliMode,
  verifyBeta22Manifest,
  verifyBeta22PositiveVector,
  verifyBeta22Suite
} from "../ci/lib/beta22_replay_verify_lib.mjs";

const paths = {
  contract:
    "replay/contracts/beta22_replay_verify_contract.json",
  failure_tokens:
    "replay/contracts/beta22_replay_verify_failure_tokens.json",
  vectors:
    "replay/suite/beta_phase1_7/vectors.json",
  vector_manifest:
    "replay/suite/beta_phase1_7/manifest.json",
  verify_inputs:
    "replay/suite/beta_phase1_7/verify_inputs.json",
  expected_outputs:
    "replay/suite/beta_phase1_7/expected_outputs.json",
  verify_manifest:
    "replay/suite/beta_phase1_7/verify_manifest.json"
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

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256File(path) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(path)
    )
    .digest("hex");
}

function loadDocuments() {
  return {
    suite:
      readJson(paths.vectors),
    bindings:
      readJson(
        paths.verify_inputs
      ),
    expectedOutputs:
      readJson(
        paths.expected_outputs
      ),
    contract:
      readJson(paths.contract)
  };
}

function fileTexts() {
  return {
    contract:
      readText(paths.contract),
    failure_tokens:
      readText(
        paths.failure_tokens
      ),
    vectors:
      readText(paths.vectors),
    vector_manifest:
      readText(
        paths.vector_manifest
      ),
    verify_inputs:
      readText(
        paths.verify_inputs
      ),
    expected_outputs:
      readText(
        paths.expected_outputs
      )
  };
}

test(
  "BETA-22 contract is verify-only and repeats accepted vectors three times",
  () => {
    assert.equal(
      beta22ReplayVerifyContract
        .slice_id,
      "BETA-22"
    );

    assert.equal(
      beta22ReplayVerifyContract
        .mode,
      "verify_only"
    );

    assert.equal(
      BETA22_REPEAT_COUNT,
      3
    );

    assert.deepEqual(
      BETA22_PHASE_ORDER,
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

    assert.equal(
      beta22ReplayVerifyContract
        .update_mode_allowed,
      false
    );

    assert.equal(
      beta22ReplayVerifyContract
        .input_mutation_allowed,
      false
    );

    assert.equal(
      beta22ReplayVerifyContract
        .missing_data_inference_allowed,
      false
    );

    assert.equal(
      beta22ReplayVerifyContract
        .phase_skip_allowed,
      false
    );

    assert.equal(
      beta22ReplayVerifyContract
        .altered_input_retry_allowed,
      false
    );

    assert.equal(
      beta22ReplayVerifyContract
        .fallback_allowed,
      false
    );
  }
);

test(
  "BETA-22 failure-token contract is exact",
  () => {
    const contract =
      readJson(
        paths.failure_tokens
      );

    assert.deepEqual(
      contract.tokens,
      BETA22_FAILURE_TOKENS
    );
  }
);

test(
  "BETA-22 verify manifest binds exact committed bytes",
  () => {
    const actual =
      readJson(
        paths.verify_manifest
      );

    const expected =
      buildBeta22VerifyManifest(
        fileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta22Manifest(
        actual,
        fileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-22 valid vectors replay ACCEPTED and negative shells remain REJECTED",
  () => {
    const result =
      verifyBeta22Suite(
        loadDocuments()
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.verdict,
      "ACCEPTED"
    );

    assert.equal(
      result.vector_count,
      8
    );

    assert.equal(
      result.accepted_vector_count,
      5
    );

    assert.equal(
      result.rejected_vector_count,
      3
    );

    assert.deepEqual(
      result.vector_results
        .slice(0, 5)
        .map(
          (entry) =>
            entry.verdict
        ),
      [
        "ACCEPTED",
        "ACCEPTED",
        "ACCEPTED",
        "ACCEPTED",
        "ACCEPTED"
      ]
    );

    assert.deepEqual(
      result.vector_results
        .slice(5)
        .map(
          (entry) =>
            entry.verdict
        ),
      [
        "REJECTED",
        "REJECTED",
        "REJECTED"
      ]
    );
  }
);

test(
  "BETA-22 every accepted repeat executes every phase exactly once",
  () => {
    const result =
      verifyBeta22Suite(
        loadDocuments()
      );

    assert.equal(
      result.ok,
      true
    );

    for (
      const vectorResult
      of result.vector_results
        .slice(0, 5)
    ) {
      assert.equal(
        vectorResult.repeat_count,
        3
      );

      assert.equal(
        vectorResult.runs.length,
        3
      );

      for (
        const run
        of vectorResult.runs
      ) {
        assert.deepEqual(
          run.phase_attempt_counts,
          {
            phase1: 1,
            phase2: 1,
            phase3: 1,
            phase4: 1,
            phase5: 1,
            phase6: 1,
            phase7: 1
          }
        );
      }
    }
  }
);

test(
  "BETA-22 verify does not mutate vectors bindings or expected outputs",
  () => {
    const documents =
      loadDocuments();

    const before =
      JSON.stringify(documents);

    const hashesBefore =
      Object.values(paths)
        .map(
          (path) => [
            path,
            sha256File(path)
          ]
        );

    const result =
      verifyBeta22Suite(
        documents
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      JSON.stringify(documents),
      before
    );

    const hashesAfter =
      Object.values(paths)
        .map(
          (path) => [
            path,
            sha256File(path)
          ]
        );

    assert.deepEqual(
      hashesAfter,
      hashesBefore
    );
  }
);

test(
  "BETA-22 divergent expected phase bytes replay REJECTED",
  () => {
    const documents =
      loadDocuments();

    documents
      .expectedOutputs
      .outputs[0]
      .phase_outputs
      .phase7 +=
        " ";

    const vector =
      documents
        .suite
        .vectors[0];

    const binding =
      documents
        .bindings
        .bindings[0];

    const expectedEntry =
      documents
        .expectedOutputs
        .outputs[0];

    const result =
      verifyBeta22PositiveVector(
        vector,
        binding,
        expectedEntry,
        3
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.verdict,
      "REJECTED"
    );

    assert.equal(
      result.failure_token,
      "beta22_phase_output_divergence"
    );
  }
);

test(
  "BETA-22 missing expected phase output replay REJECTED",
  () => {
    const documents =
      loadDocuments();

    delete documents
      .expectedOutputs
      .outputs[0]
      .phase_outputs
      .phase6;

    const result =
      verifyBeta22Suite(
        documents
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta22_phase_output_missing"
    );
  }
);

test(
  "BETA-22 pin mismatch replay REJECTED without altered-input retry",
  () => {
    const documents =
      loadDocuments();

    documents
      .suite
      .vectors[0]
      .pins
      .enum_bundle_version =
        "EB2-invalid";

    const result =
      verifyBeta22Suite(
        documents
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta22_pin_mismatch"
    );
  }
);

test(
  "BETA-22 missing explicit Phase 4 binding replay REJECTED",
  () => {
    const documents =
      loadDocuments();

    documents
      .bindings
      .bindings
      .shift();

    const result =
      verifyBeta22Suite(
        documents
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta22_replay_binding_invalid"
    );
  }
);

test(
  "BETA-22 phase omission replay REJECTED",
  () => {
    const documents =
      loadDocuments();

    documents
      .suite
      .vectors[0]
      .cve_header
      .phases_under_test =
        [
          "phase1",
          "phase2",
          "phase3",
          "phase5",
          "phase6",
          "phase7"
        ];

    const result =
      verifyBeta22Suite(
        documents
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta22_phase_skipped"
    );
  }
);

test(
  "BETA-22 negative shells are not converted into accepted output",
  () => {
    const result =
      verifyBeta22Suite(
        loadDocuments()
      );

    const negative =
      result.vector_results
        .slice(5);

    assert.deepEqual(
      negative.map(
        (entry) =>
          entry.failure_token
      ),
      [
        "beta21_replay_divergence",
        "beta21_invalid_failure_token",
        "beta21_missing_phase_output"
      ]
    );

    assert.deepEqual(
      negative.map(
        (entry) =>
          entry.repeat_count
      ),
      [
        0,
        0,
        0
      ]
    );
  }
);

test(
  "BETA-22 CLI parser accepts verify only",
  () => {
    assert.deepEqual(
      parseBeta22CliMode([
        "--verify"
      ]),
      {
        ok: true,
        mode: "verify"
      }
    );

    assert.equal(
      parseBeta22CliMode([])
        .failure_token,
      "beta22_verify_mode_required"
    );

    assert.equal(
      parseBeta22CliMode([
        "--unknown"
      ]).failure_token,
      "beta22_cli_argument_invalid"
    );
  }
);

test(
  "BETA-22 CI update mode is blocked",
  () => {
    for (
      const flag
      of [
        "--update",
        "--write",
        "--accept",
        "--refresh",
        "--record"
      ]
    ) {
      const result =
        spawnSync(
          process.execPath,
          [
            "ci/scripts/run_beta_22_replay_verify.mjs",
            flag
          ],
          {
            cwd:
              process.cwd(),
            encoding:
              "utf8",
            env: {
              ...process.env,
              CI: "true"
            }
          }
        );

      assert.notEqual(
        result.status,
        0,
        flag
      );

      assert.equal(
        (
          result.stdout +
          result.stderr
        ).includes(
          "beta22_update_mode_forbidden"
        ),
        true,
        flag
      );
    }
  }
);

test(
  "BETA-22 CLI verify succeeds",
  () => {
    const result =
      spawnSync(
        process.execPath,
        [
          "ci/scripts/run_beta_22_replay_verify.mjs",
          "--verify"
        ],
        {
          cwd:
            process.cwd(),
          encoding:
            "utf8",
          env: {
            ...process.env,
            CI: "true"
          }
        }
      );

    assert.equal(
      result.status,
      0,
      result.stderr
    );

    const output =
      JSON.parse(
        result.stdout
      );

    assert.equal(
      output.verdict,
      "ACCEPTED"
    );

    assert.equal(
      output.repeat_count,
      3
    );
  }
);

test(
  "BETA-22 runner contains no fixture-write path",
  () => {
    const source =
      readText(
        "ci/scripts/run_beta_22_replay_verify.mjs"
      );

    for (
      const forbidden
      of [
        "writeFileSync",
        "writeFile(",
        "appendFile",
        "renameSync",
        "copyFileSync",
        "rmSync",
        "unlinkSync"
      ]
    ) {
      assert.equal(
        source.includes(forbidden),
        false,
        forbidden
      );
    }

    assert.equal(
      source.includes(
        "--verify"
      ),
      false
    );

    assert.equal(
      source.includes(
        "parseBeta22CliMode"
      ),
      true
    );
  }
);

test(
  "BETA-22 v0 compatibility uses exact replay exclusions only",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/contracts/beta22_replay_verify_contract.json",
        "replay/contracts/beta22_replay_verify_failure_tokens.json",
        "replay/suite/beta_phase1_7/verify_inputs.json",
        "replay/suite/beta_phase1_7/expected_outputs.json",
        "replay/suite/beta_phase1_7/verify_manifest.json"
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
