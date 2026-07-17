// DEV NOTE: BETA-23 stable RunnerVerdict contract tests.

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  spawnSync
} from "node:child_process";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  verifyBeta22Suite
} from "../ci/lib/beta22_replay_verify_lib.mjs";

import {
  BETA23_FAILURE_TOKENS,
  BETA23_RUNNER_VERDICT_KEYS,
  beta23RunnerVerdictContract,
  buildBeta23RunnerVerdictManifest,
  buildBeta23RunnerVerdicts,
  computeBeta23RunnerVerdictChecksum,
  sealBeta23RunnerVerdict,
  verifyBeta23RunnerVerdict,
  verifyBeta23RunnerVerdictManifest
} from "../ci/lib/beta23_runner_verdict_lib.mjs";

const paths = {
  contract:
    "replay/contracts/beta23_runner_verdict_contract.json",
  schema:
    "replay/contracts/beta23_runner_verdict.schema.json",
  failureTokens:
    "replay/contracts/beta23_runner_verdict_failure_tokens.json",
  upstreamVerifyContract:
    "replay/contracts/beta22_replay_verify_contract.json",
  upstreamVerifyManifest:
    "replay/suite/beta_phase1_7/verify_manifest.json",
  vectors:
    "replay/suite/beta_phase1_7/vectors.json",
  verifyInputs:
    "replay/suite/beta_phase1_7/verify_inputs.json",
  expectedOutputs:
    "replay/suite/beta_phase1_7/expected_outputs.json",
  manifest:
    "replay/suite/beta_phase1_7/runner_verdict_manifest.json"
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

function documents() {
  return {
    suite:
      readJson(paths.vectors),
    bindings:
      readJson(paths.verifyInputs),
    expectedOutputs:
      readJson(paths.expectedOutputs),
    contract:
      readJson(
        paths.upstreamVerifyContract
      )
  };
}

function fileTexts() {
  return {
    contract:
      readText(paths.contract),
    schema:
      readText(paths.schema),
    failure_tokens:
      readText(paths.failureTokens),
    upstream_verify_contract:
      readText(
        paths.upstreamVerifyContract
      ),
    upstream_verify_manifest:
      readText(
        paths.upstreamVerifyManifest
      ),
    vectors:
      readText(paths.vectors),
    expected_outputs:
      readText(paths.expectedOutputs)
  };
}

function builtVerdicts() {
  const docs =
    documents();

  const verifyResult =
    verifyBeta22Suite(docs);

  assert.equal(
    verifyResult.ok,
    true
  );

  const built =
    buildBeta23RunnerVerdicts({
      suite:
        docs.suite,
      verifyResult,
      expectedOutputs:
        docs.expectedOutputs
    });

  assert.equal(
    built.ok,
    true
  );

  return built.runner_verdicts;
}

test(
  "BETA-23 contract is closed and Phase 8 dependency-ready",
  () => {
    assert.equal(
      beta23RunnerVerdictContract
        .slice_id,
      "BETA-23"
    );

    assert.equal(
      beta23RunnerVerdictContract
        .phase8_sealing_dependency_ready,
      true
    );

    assert.equal(
      beta23RunnerVerdictContract
        .narrative_fields_allowed,
      false
    );

    assert.deepEqual(
      readJson(paths.contract),
      beta23RunnerVerdictContract
    );

    assert.deepEqual(
      readJson(
        paths.failureTokens
      ).tokens,
      BETA23_FAILURE_TOKENS
    );
  }
);

test(
  "BETA-23 schema validates accepted and rejected RunnerVerdict outputs",
  () => {
    const ajv =
      new Ajv2020({
        allErrors: true,
        strict: true
      });

    const validate =
      ajv.compile(
        readJson(paths.schema)
      );

    const verdicts =
      builtVerdicts();

    assert.equal(
      verdicts.length,
      8
    );

    for (
      const verdict
      of verdicts
    ) {
      assert.equal(
        validate(verdict),
        true,
        JSON.stringify(
          validate.errors
        )
      );
    }
  }
);

test(
  "BETA-23 accepted RunnerVerdict carries exact Phase 1-7 hashes and scope",
  () => {
    const accepted =
      builtVerdicts()[0];

    assert.equal(
      accepted.verdict,
      "ACCEPTED"
    );

    assert.match(
      accepted.canonical_input_hash,
      /^[a-f0-9]{64}$/u
    );

    assert.match(
      accepted.selection_hash,
      /^[a-f0-9]{64}$/u
    );

    assert.match(
      accepted.projection_hash,
      /^[a-f0-9]{64}$/u
    );

    assert.deepEqual(
      accepted.replayed_phase_scope,
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

    assert.deepEqual(
      accepted.failure_tokens,
      []
    );

    assert.equal(
      verifyBeta23RunnerVerdict(
        accepted
      ).ok,
      true
    );

    assert.equal(
      computeBeta23RunnerVerdictChecksum(
        accepted
      ),
      accepted
        .runner_verdict_checksum_sha256
    );
  }
);

test(
  "BETA-23 rejected RunnerVerdict reports no replayed phases and one permitted failure token",
  () => {
    const rejected =
      builtVerdicts()[5];

    assert.equal(
      rejected.verdict,
      "REJECTED"
    );

    assert.equal(
      rejected.selection_hash,
      null
    );

    assert.equal(
      rejected.projection_hash,
      null
    );

    assert.deepEqual(
      rejected.replayed_phase_scope,
      []
    );

    assert.deepEqual(
      rejected.failure_tokens,
      [
        "beta21_replay_divergence"
      ]
    );

    assert.equal(
      verifyBeta23RunnerVerdict(
        rejected
      ).ok,
      true
    );
  }
);

test(
  "BETA-23 checksum mismatch fails closed",
  () => {
    const tampered =
      clone(
        builtVerdicts()[0]
      );

    tampered
      .runner_verdict_checksum_sha256 =
        "0".repeat(64);

    const result =
      verifyBeta23RunnerVerdict(
        tampered
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta23_runner_verdict_checksum_mismatch"
    );
  }
);

test(
  "BETA-23 dishonest replay scope fails even with a recomputed checksum",
  () => {
    const accepted =
      clone(
        builtVerdicts()[0]
      );

    const fields = {
      verdict:
        accepted.verdict,
      canonical_input_hash:
        accepted.canonical_input_hash,
      selection_hash:
        accepted.selection_hash,
      projection_hash:
        accepted.projection_hash,
      replayed_phase_scope: [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6"
      ],
      engine_version:
        accepted.engine_version,
      enum_bundle_version:
        accepted.enum_bundle_version,
      replay_suite_version:
        accepted.replay_suite_version,
      failure_tokens:
        accepted.failure_tokens
    };

    const result =
      sealBeta23RunnerVerdict(
        fields
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta23_scope_dishonest"
    );
  }
);

test(
  "BETA-23 missing required field fails closed",
  () => {
    const verdict =
      clone(
        builtVerdicts()[0]
      );

    delete verdict.projection_hash;

    const result =
      verifyBeta23RunnerVerdict(
        verdict
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "beta23_missing_required_field"
    );
  }
);

test(
  "BETA-23 RunnerVerdict emits only exact machine fields",
  () => {
    for (
      const verdict
      of builtVerdicts()
    ) {
      assert.deepEqual(
        Object.keys(verdict),
        BETA23_RUNNER_VERDICT_KEYS
      );

      for (
        const forbidden
        of [
          "message",
          "description",
          "explanation",
          "advice",
          "recommendation",
          "narrative",
          "correctness",
          "safety",
          "readiness"
        ]
      ) {
        assert.equal(
          Object.prototype
            .hasOwnProperty.call(
              verdict,
              forbidden
            ),
          false,
          forbidden
        );
      }
    }
  }
);

test(
  "BETA-23 manifest binds exact contract schema upstream replay and suite bytes",
  () => {
    const actual =
      readJson(paths.manifest);

    const expected =
      buildBeta23RunnerVerdictManifest(
        fileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta23RunnerVerdictManifest(
        actual,
        fileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-23 CLI verify emits eight valid RunnerVerdict records",
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
      output
        .runner_verdict_contract_version,
      "1.0.0"
    );

    assert.equal(
      output.runner_verdicts.length,
      8
    );

    for (
      const verdict
      of output.runner_verdicts
    ) {
      assert.equal(
        verifyBeta23RunnerVerdict(
          verdict
        ).ok,
        true
      );
    }
  }
);

test(
  "BETA-23 v0 compatibility uses exact replay exclusions only",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/contracts/beta23_runner_verdict_contract.json",
        "replay/contracts/beta23_runner_verdict.schema.json",
        "replay/contracts/beta23_runner_verdict_failure_tokens.json",
        "replay/suite/beta_phase1_7/runner_verdict_manifest.json"
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
        '"replay/suite/beta_phase1_7"'
      ),
      false
    );
  }
);
