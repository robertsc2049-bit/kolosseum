// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-22 verify-only Phase 1-7 replay, byte, repeat, and CI immutability guard.

import fs from "node:fs";

import {
  BETA22_FAILURE_TOKENS,
  BETA22_PHASE_ORDER,
  BETA22_REPEAT_COUNT,
  beta22ReplayVerifyContract,
  buildBeta22VerifyManifest,
  parseBeta22CliMode,
  verifyBeta22Manifest,
  verifyBeta22Suite
} from "../lib/beta22_replay_verify_lib.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_22_REPLAY_VERIFY_RUNNER::FAIL::${message}`
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
    "replay/contracts/beta22_replay_verify_contract.json",
  tokens:
    "replay/contracts/beta22_replay_verify_failure_tokens.json",
  vectors:
    "replay/suite/beta_phase1_7/vectors.json",
  vectorManifest:
    "replay/suite/beta_phase1_7/manifest.json",
  verifyInputs:
    "replay/suite/beta_phase1_7/verify_inputs.json",
  expectedOutputs:
    "replay/suite/beta_phase1_7/expected_outputs.json",
  verifyManifest:
    "replay/suite/beta_phase1_7/verify_manifest.json",
  library:
    "ci/lib/beta22_replay_verify_lib.mjs",
  runner:
    "ci/scripts/run_beta_22_replay_verify.mjs",
  proofRunner:
    "ci/scripts/run_beta_22_replay_verify_tests.mjs",
  tests:
    "test/beta_22_replay_verify_runner.test.mjs",
  documentation:
    "docs/runtime/BETA_22_REPLAY_VERIFY_RUNNER.md",
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

const suite =
  readJson(files.vectors);

const bindings =
  readJson(files.verifyInputs);

const expectedOutputs =
  readJson(files.expectedOutputs);

const manifest =
  readJson(files.verifyManifest);

if (
  JSON.stringify(contract) !==
  JSON.stringify(
    beta22ReplayVerifyContract
  )
) {
  fail(
    "contract_mismatch"
  );
}

if (
  !tokens ||
  JSON.stringify(
    tokens.tokens
  ) !==
  JSON.stringify(
    BETA22_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

const fileTexts = {
  contract:
    text.contract,
  failure_tokens:
    text.tokens,
  vectors:
    text.vectors,
  vector_manifest:
    text.vectorManifest,
  verify_inputs:
    text.verifyInputs,
  expected_outputs:
    text.expectedOutputs
};

if (
  manifest
) {
  const expectedManifest =
    buildBeta22VerifyManifest(
      fileTexts
    );

  if (
    JSON.stringify(manifest) !==
    JSON.stringify(expectedManifest)
  ) {
    fail(
      "verify_manifest_not_current"
    );
  }

  const manifestResult =
    verifyBeta22Manifest(
      manifest,
      fileTexts
    );

  if (!manifestResult.ok) {
    fail(
      `verify_manifest::${manifestResult.failure_token}`
    );
  }
}

if (
  suite &&
  bindings &&
  expectedOutputs &&
  contract
) {
  const result =
    verifyBeta22Suite({
      suite,
      bindings,
      expectedOutputs,
      contract
    });

  if (!result.ok) {
    fail(
      `verify_suite::${result.failure_token}`
    );
  }
  else {
    if (
      result.verdict !==
        "ACCEPTED" ||
      result.repeat_count !==
        BETA22_REPEAT_COUNT ||
      result.accepted_vector_count !==
        5 ||
      result.rejected_vector_count !==
        3
    ) {
      fail(
        "verify_suite_summary_invalid"
      );
    }

    for (
      const vectorResult
      of result.vector_results
        .slice(0, 5)
    ) {
      if (
        vectorResult.verdict !==
          "ACCEPTED" ||
        vectorResult.runs.length !==
          BETA22_REPEAT_COUNT
      ) {
        fail(
          `accepted_vector_result_invalid::${vectorResult.vector_id}`
        );

        continue;
      }

      for (
        const run
        of vectorResult.runs
      ) {
        for (
          const phase
          of BETA22_PHASE_ORDER
        ) {
          if (
            run
              .phase_attempt_counts[phase] !==
            1
          ) {
            fail(
              `phase_attempt_invalid::${vectorResult.vector_id}::${phase}`
            );
          }
        }
      }
    }

    for (
      const vectorResult
      of result.vector_results
        .slice(5)
    ) {
      if (
        vectorResult.verdict !==
          "REJECTED" ||
        vectorResult.repeat_count !==
          0
      ) {
        fail(
          `negative_shell_result_invalid::${vectorResult.vector_id}`
        );
      }
    }
  }
}

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
  const mode =
    parseBeta22CliMode([
      flag
    ]);

  if (
    mode.ok !== false ||
    mode.failure_token !==
      "beta22_update_mode_forbidden"
  ) {
    fail(
      `update_flag_not_blocked::${flag}`
    );
  }
}

const verifyMode =
  parseBeta22CliMode([
    "--verify"
  ]);

if (
  verifyMode.ok !== true ||
  verifyMode.mode !==
    "verify"
) {
  fail(
    "verify_mode_not_admitted"
  );
}

for (
  const forbiddenWrite
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
  if (
    text.runner.includes(
      forbiddenWrite
    )
  ) {
    fail(
      `runner_write_surface_forbidden::${forbiddenWrite}`
    );
  }
}

for (
  const token
  of [
    "parseBeta22CliMode",
    "verifyBeta22Manifest",
    "verifyBeta22Suite",
    "process.exit"
  ]
) {
  if (
    !text.runner.includes(
      token
    )
  ) {
    fail(
      `runner_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    "phase1Validate",
    "phase2CanonicaliseAndHash",
    "phase3ResolveConstraintsAndLoadRegistries",
    "enumerateBeta11Phase4",
    "materialiseBeta12Phase5",
    "validateBeta13Phase6EventLog",
    "replayBeta14Phase6RuntimeEvents",
    "projectBeta20Phase7",
    "BETA22_REPEAT_COUNT = 3",
    "byte_exact_canonical_json_utf8",
    "beta22_input_mutation",
    "beta22_repeat_divergence",
    "beta22_phase_skipped"
  ]
) {
  if (
    !text.library.includes(
      token
    )
  ) {
    fail(
      `library_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    "divergent expected phase bytes replay REJECTED",
    "missing expected phase output replay REJECTED",
    "pin mismatch replay REJECTED",
    "phase omission replay REJECTED",
    "CI update mode is blocked",
    "CLI verify succeeds",
    "does not mutate vectors bindings or expected outputs"
  ]
) {
  if (
    !text.tests.includes(
      token
    )
  ) {
    fail(
      `required_test_missing::${token}`
    );
  }
}

for (
  const token
  of [
    "run_beta_22_replay_verify.mjs",
    "--verify",
    "beta_22_replay_verify_runner.test.mjs"
  ]
) {
  if (
    !text.proofRunner.includes(
      token
    )
  ) {
    fail(
      `proof_runner_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    '"proof:beta-22"',
    "run_beta_22_replay_verify_tests.mjs",
    "beta_22_replay_verify_runner_guard.mjs",
    "npm run proof:beta-22"
  ]
) {
  if (
    !text.package.includes(
      token
    )
  ) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !text.entrypoints.includes(
    '"proof:beta-22"'
  )
) {
  fail(
    "declared_entrypoint_missing"
  );
}

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
  const count =
    text.v0Core
      .split(
        `"${exactPath}"`
      )
      .length - 1;

  if (count !== 1) {
    fail(
      `v0_exact_exclusion_invalid::${exactPath}::${count}`
    );
  }
}

if (
  text.v0Core.includes(
    '"replay/suite/beta_phase1_7"'
  ) ||
  text.v0Core.includes(
    '"replay/contracts"'
  )
) {
  fail(
    "v0_broad_replay_exclusion_forbidden"
  );
}

if (
  !text.workflow.includes(
    "permissions:\n  contents: read"
  ) ||
  text.workflow.includes(
    "contents: write"
  )
) {
  fail(
    "ci_repository_write_permission_forbidden"
  );
}

for (
  const token
  of [
    "Verify-only boundary",
    "Byte-exact comparison",
    "Three-repeat rule",
    "No mutation inference skip fallback or retry",
    "Update mode",
    "ACCEPTED",
    "REJECTED",
    "CI cannot update fixtures",
    "No replay directory, wildcard"
  ]
) {
  if (
    !text.documentation.includes(
      token
    )
  ) {
    fail(
      `documentation_token_missing::${token}`
    );
  }
}

if (failed) {
  process.exitCode = 1;
}
else {
  console.log(
    JSON.stringify({
      ok: true,
      guard: "BETA-22",
      token:
        "CI_BETA_22_REPLAY_VERIFY_RUNNER",
      mode: "verify_only",
      repeat_count:
        BETA22_REPEAT_COUNT,
      accepted_vector_count: 5,
      rejected_shell_count: 3,
      message:
        "Phase 1-7 verify replay, byte-exact outputs, repeats, and CI fixture immutability passed."
    })
  );
}
