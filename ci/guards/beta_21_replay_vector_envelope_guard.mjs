// @law: Repo Governance
// @severity: high
// @scope: replay
// DEV NOTE: BETA-21 replay-vector envelope, byte, schema, pin, and non-mutation guard.

import crypto from "node:crypto";
import fs from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

import {
  BETA21_FAILURE_TOKENS,
  BETA21_VECTOR_IDS,
  buildBeta21ReplayVectorManifest,
  validateBeta21ReplayVectorSuite,
  verifyBeta21ReplayVectorSuite
} from "../lib/beta21_replay_vector_envelope_lib.mjs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_21_REPLAY_VECTOR_ENVELOPE::FAIL::${message}`
  );
}

function read(path) {
  if (!fs.existsSync(path)) {
    fail(`missing::${path}`);
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

function sha256(text) {
  return crypto
    .createHash("sha256")
    .update(
      text,
      "utf8"
    )
    .digest("hex");
}

const files = {
  schema:
    "replay/contracts/beta21_replay_vector_envelope.schema.json",
  tokens:
    "replay/contracts/beta21_replay_failure_tokens.json",
  vectors:
    "replay/suite/beta_phase1_7/vectors.json",
  manifest:
    "replay/suite/beta_phase1_7/manifest.json",
  library:
    "ci/lib/beta21_replay_vector_envelope_lib.mjs",
  generator:
    "ci/scripts/generate_beta_21_replay_vectors.mjs",
  runner:
    "ci/scripts/run_beta_21_replay_vector_envelope_tests.mjs",
  tests:
    "test/beta_21_replay_vector_envelope.test.mjs",
  documentation:
    "docs/runtime/BETA_21_REPLAY_VECTOR_ENVELOPE.md",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json",
  v0Core:
    "ci/scripts/kolosseum_v0_test_suite_core.mjs"
};

const text = {};

for (
  const [key, path]
  of Object.entries(files)
) {
  text[key] = read(path);
}

const schema =
  readJson(files.schema);

const suite =
  readJson(files.vectors);

const manifest =
  readJson(files.manifest);

const tokenContract =
  readJson(files.tokens);

if (
  schema &&
  suite
) {
  try {
    const ajv =
      new Ajv2020({
        allErrors: true,
        strict: true
      });

    const validate =
      ajv.compile(schema);

    if (!validate(suite)) {
      fail(
        `schema_validation::${JSON.stringify(validate.errors)}`
      );
    }
  }
  catch (error) {
    fail(
      `schema_compile::${String(error?.message ?? error)}`
    );
  }
}

if (
  !tokenContract ||
  JSON.stringify(
    tokenContract.tokens
  ) !==
  JSON.stringify(
    BETA21_FAILURE_TOKENS
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

if (suite) {
  const validation =
    validateBeta21ReplayVectorSuite(
      suite
    );

  if (!validation.ok) {
    fail(
      `suite_validation::${validation.failure_token}`
    );
  }

  const verification =
    verifyBeta21ReplayVectorSuite(
      suite
    );

  if (!verification.ok) {
    fail(
      `implementation_verification::${verification.failure_token}`
    );
  }
}

if (
  !manifest ||
  manifest.slice_id !==
    "BETA-21" ||
  manifest.suite_id !==
    "beta_phase1_7" ||
  JSON.stringify(
    manifest.vector_ids
  ) !==
  JSON.stringify(
    BETA21_VECTOR_IDS
  ) ||
  manifest.positive_vector_count !==
    5 ||
  manifest.negative_shell_count !==
    3
) {
  fail(
    "manifest_identity_invalid"
  );
}
else {
  const expectedManifest =
    buildBeta21ReplayVectorManifest(
      text.vectors
    );

  if (
    JSON.stringify(manifest) !==
    JSON.stringify(expectedManifest)
  ) {
    fail(
      "manifest_not_current"
    );
  }

  if (
    manifest.suite_sha256 !==
    sha256(text.vectors)
  ) {
    fail(
      "manifest_suite_hash_invalid"
    );
  }
}

for (
  const token
  of [
    "beta21_individual_powerlifting",
    "beta21_individual_general_strength",
    "beta21_coach_managed_rugby_union",
    "beta21_split_continue",
    "beta21_partial_completion",
    "beta21_negative_divergence",
    "beta21_negative_invalid_token",
    "beta21_negative_missing_phase_output"
  ]
) {
  if (!text.vectors.includes(token)) {
    fail(
      `required_vector_missing::${token}`
    );
  }
}

for (
  const token
  of [
    "canonical_phase1_input",
    "enum_bundle_version",
    "registry_references",
    "phase5_output_hash_sha256",
    "phase6_output_hash_sha256",
    "phase6_reducer_state_hash_sha256",
    "phase7_output_hash_sha256",
    "phase7_projection_hash_sha256"
  ]
) {
  if (!text.vectors.includes(token)) {
    fail(
      `required_field_missing::${token}`
    );
  }
}

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
  if (text.vectors.includes(forbidden)) {
    fail(
      `forbidden_vector_state::${forbidden}`
    );
  }
}

for (
  const token
  of [
    "generate_beta_21_replay_vectors.mjs",
    "--check",
    "beta_21_replay_vector_envelope.test.mjs"
  ]
) {
  if (!text.runner.includes(token)) {
    fail(
      `runner_token_missing::${token}`
    );
  }
}

for (
  const token
  of [
    '"proof:beta-21"',
    "run_beta_21_replay_vector_envelope_tests.mjs",
    "beta_21_replay_vector_envelope_guard.mjs",
    "npm run proof:beta-21"
  ]
) {
  if (!text.package.includes(token)) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !text.entrypoints.includes(
    '"proof:beta-21"'
  )
) {
  fail(
    "declared_entrypoint_missing"
  );
}

for (
  const exactPath
  of [
    "replay/contracts/beta21_replay_vector_envelope.schema.json",
    "replay/contracts/beta21_replay_failure_tokens.json",
    "replay/suite/beta_phase1_7/vectors.json",
    "replay/suite/beta_phase1_7/manifest.json"
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

for (
  const token
  of [
    "BETA-CVE-1.0.0",
    "Positive vectors",
    "Negative shells",
    "Canonical Phase 1 input",
    "Phase 3 and Phase 4 binding",
    "Expected output hashes",
    "implementation_mutation_allowed: false",
    "No replay directory, wildcard"
  ]
) {
  if (!text.documentation.includes(token)) {
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
      guard: "BETA-21",
      token:
        "CI_BETA_21_REPLAY_VECTOR_ENVELOPE",
      vector_count:
        BETA21_VECTOR_IDS.length,
      positive_vector_count: 5,
      negative_shell_count: 3,
      suite_sha256:
        manifest.suite_sha256,
      message:
        "Phase 1-7 replay inputs, pins, expected hashes, verdicts, and negative shells passed."
    })
  );
}
