// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-23 RunnerVerdict shape, checksum, scope honesty, and Phase 8 dependency guard.

import fs from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

import {
  verifyBeta22Suite
} from "../lib/beta22_replay_verify_lib.mjs";

import {
  BETA23_FAILURE_TOKENS,
  BETA23_RUNNER_VERDICT_KEYS,
  beta23RunnerVerdictContract,
  buildBeta23RunnerVerdictManifest,
  buildBeta23RunnerVerdicts,
  verifyBeta23RunnerVerdict,
  verifyBeta23RunnerVerdictManifest
} from "../lib/beta23_runner_verdict_lib.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_23_RUNNER_VERDICT_CONTRACT::FAIL::${message}`
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
    "replay/contracts/beta23_runner_verdict_contract.json",
  schema:
    "replay/contracts/beta23_runner_verdict.schema.json",
  tokens:
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
    "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
  library:
    "ci/lib/beta23_runner_verdict_lib.mjs",
  runner:
    "ci/scripts/run_beta_22_replay_verify.mjs",
  proofRunner:
    "ci/scripts/run_beta_23_runner_verdict_tests.mjs",
  tests:
    "test/beta_23_runner_verdict_contract.test.mjs",
  documentation:
    "docs/runtime/BETA_23_RUNNER_VERDICT_CONTRACT.md",
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

const suite =
  readJson(files.vectors);

const bindings =
  readJson(files.verifyInputs);

const expectedOutputs =
  readJson(files.expectedOutputs);

const upstreamContract =
  readJson(
    files.upstreamVerifyContract
  );

const manifest =
  readJson(files.manifest);

if (
  JSON.stringify(contract) !==
  JSON.stringify(
    beta23RunnerVerdictContract
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
    BETA23_FAILURE_TOKENS
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
}

const fileTexts = {
  contract:
    text.contract,
  schema:
    text.schema,
  failure_tokens:
    text.tokens,
  upstream_verify_contract:
    text.upstreamVerifyContract,
  upstream_verify_manifest:
    text.upstreamVerifyManifest,
  vectors:
    text.vectors,
  expected_outputs:
    text.expectedOutputs
};

if (manifest) {
  const expectedManifest =
    buildBeta23RunnerVerdictManifest(
      fileTexts
    );

  if (
    JSON.stringify(manifest) !==
    JSON.stringify(
      expectedManifest
    )
  ) {
    fail(
      "manifest_not_current"
    );
  }

  if (
    verifyBeta23RunnerVerdictManifest(
      manifest,
      fileTexts
    ).ok !== true
  ) {
    fail(
      "manifest_verification_failed"
    );
  }
}

if (
  suite &&
  bindings &&
  expectedOutputs &&
  upstreamContract
) {
  const verifyResult =
    verifyBeta22Suite({
      suite,
      bindings,
      expectedOutputs,
      contract:
        upstreamContract
    });

  if (!verifyResult.ok) {
    fail(
      `upstream_verify_failed::${verifyResult.failure_token ?? "unknown"}`
    );
  }
  else {
    const built =
      buildBeta23RunnerVerdicts({
        suite,
        verifyResult,
        expectedOutputs
      });

    if (!built.ok) {
      fail(
        `runner_verdict_build_failed::${built.failure_token ?? "unknown"}`
      );
    }
    else {
      if (
        built.runner_verdicts.length !==
        8
      ) {
        fail(
          "runner_verdict_count_invalid"
        );
      }

      const accepted =
        built.runner_verdicts.filter(
          (verdict) =>
            verdict.verdict ===
            "ACCEPTED"
        );

      const rejected =
        built.runner_verdicts.filter(
          (verdict) =>
            verdict.verdict ===
            "REJECTED"
        );

      if (
        accepted.length !== 5 ||
        rejected.length !== 3
      ) {
        fail(
          "runner_verdict_class_count_invalid"
        );
      }

      for (
        const verdict
        of built.runner_verdicts
      ) {
        if (
          JSON.stringify(
            Object.keys(verdict)
          ) !==
          JSON.stringify(
            BETA23_RUNNER_VERDICT_KEYS
          )
        ) {
          fail(
            "runner_verdict_key_order_invalid"
          );
        }

        const validation =
          verifyBeta23RunnerVerdict(
            verdict
          );

        if (!validation.ok) {
          fail(
            `runner_verdict_invalid::${validation.failure_token ?? "unknown"}`
          );
        }
      }
    }
  }
}

for (
  const required
  of [
    "RunnerVerdict",
    "runner_verdict_id",
    "runner_verdict_checksum_sha256",
    "replayed_phase_scope",
    "Phase 8",
    "No narrative",
    "ACCEPTED",
    "REJECTED"
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
  !text.runner.includes(
    "attachBeta23RunnerVerdicts"
  )
) {
  fail(
    "runner_not_wired"
  );
}

if (
  !text.package.includes(
    '"proof:beta-23"'
  ) ||
  !text.package.includes(
    "run_beta_23_runner_verdict_tests.mjs"
  )
) {
  fail(
    "package_proof_missing"
  );
}

if (
  !text.entrypoints.includes(
    '"proof:beta-23"'
  )
) {
  fail(
    "entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/contracts/beta23_runner_verdict_contract.json",
    "replay/contracts/beta23_runner_verdict.schema.json",
    "replay/contracts/beta23_runner_verdict_failure_tokens.json",
    "replay/suite/beta_phase1_7/runner_verdict_manifest.json"
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
    guard: "BETA-23",
    token:
      "CI_BETA_23_RUNNER_VERDICT_CONTRACT",
    verdict_count: 8,
    accepted_count: 5,
    rejected_count: 3,
    phase8_dependency_ready:
      true,
    message:
      "RunnerVerdict shape, canonical checksum, honest scope, and machine-only output passed."
  })
);
