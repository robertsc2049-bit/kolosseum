// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-15 closed Phase 6 invalid-runtime failure guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_15_PHASE6_NEGATIVE_GATES::FAIL::${message}`
  );
}

function read(relativePath) {
  const absolutePath = path.join(
    root,
    relativePath
  );

  if (!fs.existsSync(absolutePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }

  return fs.readFileSync(
    absolutePath,
    "utf8"
  );
}

function readJson(relativePath) {
  const content = read(relativePath);

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

function extractTokens(source) {
  const tokens = new Set();
  const pattern =
    /["'](phase6_[a-z0-9_]+)["']/gu;

  for (const match of source.matchAll(pattern)) {
    tokens.add(match[1]);
  }

  return [...tokens].sort();
}

const schemaPath =
  "engine/src/runtime/beta13_phase6_event_schema.js";

const reducerPath =
  "engine/src/runtime/beta14_phase6_runtime_reducer.js";

const tokenManifestPath =
  "engine/contracts/beta15_phase6_failure_tokens.json";

const fixtureManifestPath =
  "test/fixtures/beta_15_phase6_negative_gates/manifest.json";

const testPath =
  "test/beta_15_phase6_negative_gates.test.mjs";

const runnerPath =
  "ci/scripts/run_beta_15_phase6_negative_gates_tests.mjs";

const docPath =
  "docs/runtime/BETA_15_PHASE6_NEGATIVE_GATES.md";

const schemaSource = read(schemaPath);
const reducerSource = read(reducerPath);
const publicSource = read(
  "engine/src/runtime/session_summary.js"
);
const typeSource = read(
  "engine/types/runtime/session_summary.d.ts"
);
const testSource = read(testPath);
const runnerSource = read(runnerPath);
const docSource = read(docPath);
const packageSource = read("package.json");
const entrypointsSource = read(
  "ci/guards/_entrypoints.json"
);

const tokenManifest = readJson(
  tokenManifestPath
);

const fixtureManifest = readJson(
  fixtureManifestPath
);

for (const token of [
  "phase6_event_schema_event_order_invalid",
  "phase6_event_schema_append_only_violation",
  "phase6_event_schema_unknown_event_type",
  "phase6_event_schema_unknown_work_item",
  "phase6_event_schema_return_decision_required",
  "phase6_event_schema_pain_follow_up_required",
  "phase6_event_schema_unknown_session",
  "phase6_event_schema_event_invalid"
]) {
  if (!schemaSource.includes(token)) {
    fail(`schema_token_missing::${token}`);
  }
}

for (const token of [
  "phase6_runtime_reducer_return_decision_required",
  "phase6_runtime_reducer_pain_follow_up_required",
  "phase6_runtime_reducer_state_divergence",
  "assertBeta14Phase6RuntimeStateMatchesEventLog"
]) {
  if (!reducerSource.includes(token)) {
    fail(`reducer_token_missing::${token}`);
  }
}

for (const forbidden of [
  "Math.random",
  "Date.now",
  "new Date(",
  "randomUUID",
  "performance.now"
]) {
  if (
    schemaSource.includes(forbidden) ||
    reducerSource.includes(forbidden)
  ) {
    fail(`forbidden_runtime_token::${forbidden}`);
  }
}

if (
  !publicSource.includes(
    "assertBeta14Phase6RuntimeStateMatchesEventLog"
  )
) {
  fail("public_state_divergence_export_missing");
}

if (
  !typeSource.includes(
    "assertBeta14Phase6RuntimeStateMatchesEventLog"
  )
) {
  fail("public_state_divergence_type_missing");
}

if (
  !tokenManifest ||
  tokenManifest.slice_id !== "BETA-15" ||
  tokenManifest.token_surface !== "closed" ||
  !Array.isArray(
    tokenManifest.valid_failure_tokens
  )
) {
  fail("failure_token_manifest_invalid");
}
else {
  const actual = new Set();

  for (const source of [
    schemaSource,
    reducerSource
  ]) {
    for (const token of extractTokens(source)) {
      actual.add(token);
    }
  }

  const actualTokens =
    [...actual].sort();

  const declaredTokens =
    [...tokenManifest.valid_failure_tokens]
      .sort();

  if (
    JSON.stringify(actualTokens) !==
    JSON.stringify(declaredTokens)
  ) {
    fail("failure_token_surface_not_closed");
  }

  if (
    new Set(declaredTokens).size !==
    declaredTokens.length
  ) {
    fail("failure_token_manifest_duplicate");
  }
}

const expectedScenarios = [
  "duplicate_illegal_event",
  "event_crossing_session_boundary",
  "invalid_event_order",
  "missing_pain_follow_up",
  "missing_return_decision",
  "mutation_after_event_append",
  "runtime_state_divergence",
  "unknown_event_type",
  "unknown_work_item"
];

if (
  !fixtureManifest ||
  fixtureManifest.slice_id !== "BETA-15" ||
  !Array.isArray(fixtureManifest.scenarios)
) {
  fail("fixture_manifest_invalid");
}
else {
  const actualScenarios =
    fixtureManifest.scenarios
      .map((entry) => entry.scenario_id)
      .sort();

  if (
    JSON.stringify(actualScenarios) !==
    JSON.stringify(expectedScenarios)
  ) {
    fail("fixture_scenario_set_invalid");
  }

  const tokenContent =
    read(tokenManifestPath);

  if (
    sha256(tokenContent) !==
    fixtureManifest.token_manifest_sha256
  ) {
    fail("fixture_token_manifest_hash_mismatch");
  }

  const allowed = new Set(
    tokenManifest?.valid_failure_tokens ?? []
  );

  for (const entry of fixtureManifest.scenarios) {
    const fixturePath = path.join(
      "test",
      "fixtures",
      "beta_15_phase6_negative_gates",
      entry.file
    );

    const fixtureContent = read(fixturePath);

    if (
      sha256(fixtureContent) !==
      entry.sha256
    ) {
      fail(
        `fixture_hash_mismatch::${entry.file}`
      );
    }

    if (
      !allowed.has(
        entry.expected_failure_token
      )
    ) {
      fail(
        `fixture_token_unregistered::${entry.scenario_id}`
      );
    }
  }
}

for (const scenarioId of expectedScenarios) {
  if (!testSource.includes(scenarioId)) {
    fail(`negative_test_missing::${scenarioId}`);
  }
}

for (const token of [
  "failure token manifest exactly matches",
  "emits only its registered deterministic token",
  "direct reducer requires return decision",
  "direct reducer requires pain follow-up",
  "leaves prior event log and state unchanged"
]) {
  if (!testSource.includes(token)) {
    fail(`test_contract_missing::${token}`);
  }
}

for (const token of [
  "npm run build",
  "beta_15_phase6_negative_gates.test.mjs"
]) {
  if (!runnerSource.includes(token)) {
    fail(`runner_token_missing::${token}`);
  }
}

for (const token of [
  '"proof:beta-15"',
  "run_beta_15_phase6_negative_gates_tests.mjs",
  "beta_15_phase6_negative_gates_guard.mjs",
  "npm run proof:beta-15"
]) {
  if (!packageSource.includes(token)) {
    fail(`package_entrypoint_missing::${token}`);
  }
}

if (
  !entrypointsSource.includes(
    '"proof:beta-15"'
  )
) {
  fail("declared_entrypoint_missing");
}

for (const token of [
  "Closed failure token surface",
  "invalid event order",
  "runtime state that diverges",
  "events crossing",
  "canonical event mutation",
  "do not produce advice"
]) {
  if (!docSource.includes(token)) {
    fail(`documentation_token_missing::${token}`);
  }
}

if (!failed) {
  const runtimePath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "runtime",
    "beta14_phase6_runtime_reducer.js"
  );

  if (!fs.existsSync(runtimePath)) {
    fail("compiled_runtime_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(runtimePath).href
    );

    if (
      typeof runtime
        .assertBeta14Phase6RuntimeStateMatchesEventLog !==
      "function"
    ) {
      fail("compiled_state_divergence_gate_missing");
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
      guard: "BETA-15",
      token:
        "CI_BETA_15_PHASE6_NEGATIVE_GATES",
      failure_token_count:
        tokenManifest.valid_failure_tokens.length,
      negative_scenario_count:
        fixtureManifest.scenarios.length,
      message:
        "Phase 6 negative gates and closed failure-token surface passed."
    })
  );
}
