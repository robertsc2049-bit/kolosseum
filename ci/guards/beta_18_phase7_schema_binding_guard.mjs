// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-18 Phase 7 schema, binding, isolation, and exact v0 exclusion guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  pathToFileURL
} from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_18_PHASE7_SCHEMA_BINDING::FAIL::${message}`
  );
}

function read(relativePath) {
  const absolutePath =
    path.join(
      root,
      relativePath
    );

  if (
    !fs.existsSync(
      absolutePath
    )
  ) {
    fail(
      `missing::${relativePath}`
    );

    return "";
  }

  return fs.readFileSync(
    absolutePath,
    "utf8"
  );
}

function readJson(relativePath) {
  const content =
    read(relativePath);

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  }
  catch (error) {
    fail(
      `invalid_json::${relativePath}::${String(error?.message ?? error)}`
    );

    return null;
  }
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const files = {
  source:
    "engine/src/phases/beta18Phase7SchemaBinding.ts",
  inputSchema:
    "schema/beta18_phase7_input.schema.json",
  outputSchema:
    "schema/beta18_phase7_output.schema.json",
  failureContract:
    "engine/contracts/beta18_phase7_failure_tokens.json",
  test:
    "test/beta_18_phase7_schema_binding.test.mjs",
  runner:
    "ci/scripts/run_beta_18_phase7_schema_binding_tests.mjs",
  fixture:
    "test/fixtures/beta_18_phase7_schema_binding/completed_projection.json",
  manifest:
    "test/fixtures/beta_18_phase7_schema_binding/manifest.json",
  doc:
    "docs/runtime/BETA_18_PHASE7_SCHEMA_BINDING.md",
  v0Core:
    "ci/scripts/kolosseum_v0_test_suite_core.mjs",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json"
};

const source = {};

for (
  const [name, relativePath]
  of Object.entries(files)
) {
  source[name] =
    read(relativePath);
}

for (const token of [
  "beta18_phase7_schema_binding",
  "input_source:",
  '"phase6_output_only"',
  "phase7_projection_id",
  "canonical_input_hash",
  "selection_hash",
  "execution_status",
  "execution_state",
  "content_format",
  "rendered_output",
  "projection_hash",
  "projectBeta18Phase7",
  "validateBeta18Phase7Input",
  "validateBeta18Phase7Output",
  "tryProjectBeta18Phase7"
]) {
  if (
    !source.source.includes(token)
  ) {
    fail(
      `source_token_missing::${token}`
    );
  }
}

for (const token of [
  "phase7_binding_mismatch",
  "phase7_forbidden_input",
  "phase7_input_invalid",
  "phase7_output_invalid",
  "phase7_projection_hash_mismatch",
  "phase7_projection_id_missing"
]) {
  if (
    !source.source.includes(token)
  ) {
    fail(
      `source_failure_token_missing::${token}`
    );
  }

  if (
    !source.failureContract
      .includes(`"${token}"`)
  ) {
    fail(
      `failure_contract_token_missing::${token}`
    );
  }
}

for (const forbiddenImport of [
  "src/api",
  "server/",
  "public/",
  "copy/",
  "stripe",
  "billing",
  "coachNotes"
]) {
  if (
    source.source.includes(
      `from "${forbiddenImport}`
    )
  ) {
    fail(
      `forbidden_import::${forbiddenImport}`
    );
  }
}

for (const forbiddenGate of [
  "coach_note",
  "payment_state",
  "product_tier",
  "org_metadata",
  "ui_state",
  "copy_id",
  "copy_text"
]) {
  if (
    !source.source.includes(
      `"${forbiddenGate}"`
    )
  ) {
    fail(
      `forbidden_input_gate_missing::${forbiddenGate}`
    );
  }
}

const inputSchema =
  readJson(files.inputSchema);

const outputSchema =
  readJson(files.outputSchema);

if (
  !inputSchema ||
  inputSchema.additionalProperties !==
    false ||
  inputSchema.properties
    ?.phase6_output
    ?.additionalProperties !==
      false ||
  inputSchema.$defs
    ?.execution_state
    ?.additionalProperties !==
      false
) {
  fail(
    "input_schema_not_closed"
  );
}

if (
  !outputSchema ||
  outputSchema.additionalProperties !==
    false
) {
  fail(
    "output_schema_not_closed"
  );
}

const expectedOutputFields = [
  "phase7_projection_id",
  "canonical_input_hash",
  "selection_hash",
  "execution_status",
  "execution_state",
  "content_format",
  "rendered_output",
  "projection_hash"
];

if (
  JSON.stringify(
    outputSchema?.required
  ) !==
  JSON.stringify(
    expectedOutputFields
  )
) {
  fail(
    "output_schema_required_fields_invalid"
  );
}

const failureContract =
  readJson(files.failureContract);

const expectedFailureTokens = [
  "phase7_binding_mismatch",
  "phase7_forbidden_input",
  "phase7_input_invalid",
  "phase7_output_invalid",
  "phase7_projection_hash_mismatch",
  "phase7_projection_id_missing"
];

if (
  !failureContract ||
  failureContract.slice_id !==
    "BETA-18" ||
  failureContract.token_surface !==
    "closed" ||
  JSON.stringify(
    failureContract
      .valid_failure_tokens
  ) !==
  JSON.stringify(
    expectedFailureTokens
  )
) {
  fail(
    "failure_token_contract_invalid"
  );
}

for (const requiredTest of [
  "actual Phase 5 binding and BETA-14 Phase 6 reducer state",
  "missing projection ID fails with registered token",
  "canonical hash echo mismatch fails closed",
  "selection hash echo mismatch fails closed",
  "execution status echo mismatch fails closed",
  "execution state echo mismatch fails closed",
  "rejects product coach payment organisation UI and copy state",
  "projection hash tamper fails closed",
  "v0 compatibility uses exact Phase 7 path exclusions only"
]) {
  if (
    !source.test.includes(
      requiredTest
    )
  ) {
    fail(
      `test_contract_missing::${requiredTest}`
    );
  }
}

for (const token of [
  "npm run build",
  "beta_18_phase7_schema_binding.test.mjs"
]) {
  if (
    !source.runner.includes(token)
  ) {
    fail(
      `runner_token_missing::${token}`
    );
  }
}

for (const token of [
  '"proof:beta-18"',
  "run_beta_18_phase7_schema_binding_tests.mjs",
  "beta_18_phase7_schema_binding_guard.mjs",
  "npm run proof:beta-18"
]) {
  if (
    !source.package.includes(token)
  ) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !source.entrypoints.includes(
    '"proof:beta-18"'
  )
) {
  fail(
    "declared_entrypoint_missing"
  );
}

const exactV0Exclusions = [
  "engine/src/phases/beta18Phase7SchemaBinding.ts",
  "engine/contracts/beta18_phase7_failure_tokens.json"
];

for (
  const exactPath
  of exactV0Exclusions
) {
  const quoted =
    `"${exactPath}"`;

  const count =
    source.v0Core
      .split(quoted)
      .length - 1;

  if (count !== 1) {
    fail(
      `v0_exact_exclusion_invalid::${exactPath}::${count}`
    );
  }
}

if (
  source.v0Core.includes(
    '"engine/src/phases"'
  ) ||
  source.v0Core.includes(
    '"engine/contracts"'
  )
) {
  fail(
    "v0_broad_exclusion_forbidden"
  );
}

for (const token of [
  "Phase 7 accepts one truth-bearing object",
  "coach notes",
  "Canonical input hash echo mismatch",
  "projection_hash",
  "No directory, wildcard, or broad Phase 7 exclusion"
]) {
  if (
    !source.doc.includes(token)
  ) {
    fail(
      `documentation_token_missing::${token}`
    );
  }
}

const manifest =
  readJson(files.manifest);

if (
  !manifest ||
  manifest.slice_id !== "BETA-18" ||
  !Array.isArray(
    manifest.fixtures
  ) ||
  manifest.fixtures.length !== 1
) {
  fail(
    "fixture_manifest_invalid"
  );
}
else {
  const entry =
    manifest.fixtures[0];

  if (
    sha256(source.fixture) !==
      entry.sha256
  ) {
    fail(
      "fixture_hash_mismatch"
    );
  }
}

if (!failed) {
  const runtimePath =
    path.join(
      root,
      "engine",
      "dist",
      "src",
      "phases",
      "beta18Phase7SchemaBinding.js"
    );

  if (
    !fs.existsSync(
      runtimePath
    )
  ) {
    fail(
      "compiled_phase7_module_missing"
    );
  }
  else {
    const runtime =
      await import(
        pathToFileURL(
          runtimePath
        ).href
      );

    const fixture =
      readJson(files.fixture);

    const positive =
      runtime
        .tryProjectBeta18Phase7(
          fixture.phase7_input
        );

    if (
      positive.ok !== true ||
      positive.phase7
        .canonical_input_hash !==
        fixture.phase7_input
          .phase6_output
          .canonical_input_hash ||
      positive.phase7
        .selection_hash !==
        fixture.phase7_input
          .phase6_output
          .selection_hash
    ) {
      fail(
        "compiled_positive_projection_failed"
      );
    }

    const missingId =
      JSON.parse(
        JSON.stringify(
          fixture.phase7_input
        )
      );

    delete missingId
      .phase7_projection_id;

    const missingResult =
      runtime
        .tryProjectBeta18Phase7(
          missingId
        );

    if (
      missingResult.ok !== false ||
      missingResult.failure_token !==
        "phase7_projection_id_missing"
    ) {
      fail(
        "compiled_missing_projection_id_gate_failed"
      );
    }

    const mismatchedOutput =
      JSON.parse(
        JSON.stringify(
          positive.phase7
        )
      );

    mismatchedOutput
      .selection_hash =
      "0".repeat(64);

    let mismatchPassed = false;

    try {
      runtime
        .validateBeta18Phase7Output(
          fixture.phase7_input,
          mismatchedOutput
        );
    }
    catch (error) {
      mismatchPassed =
        error?.failure_token ===
        "phase7_binding_mismatch";
    }

    if (!mismatchPassed) {
      fail(
        "compiled_binding_mismatch_gate_failed"
      );
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
else {
  console.log(
    JSON.stringify({
      ok: true,
      guard: "BETA-18",
      token:
        "CI_BETA_18_PHASE7_SCHEMA_BINDING",
      failure_token_count:
        expectedFailureTokens.length,
      exact_v0_exclusion_count:
        exactV0Exclusions.length,
      message:
        "Phase 7 schema and Phase 6 binding echoes passed."
    })
  );
}
