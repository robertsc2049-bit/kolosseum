// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-14 deterministic Phase 6 factual runtime reducer guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_14_PHASE6_RUNTIME_REDUCER::FAIL::${message}`
  );
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const source = read(
  "engine/src/runtime/beta14_phase6_runtime_reducer.js"
);

const publicSource = read(
  "engine/src/runtime/session_summary.js"
);

const typeSource = read(
  "engine/types/runtime/session_summary.d.ts"
);

const testSource = read(
  "test/beta_14_phase6_runtime_reducer.test.mjs"
);

const runnerSource = read(
  "ci/scripts/run_beta_14_phase6_runtime_reducer_tests.mjs"
);

const docSource = read(
  "docs/runtime/BETA_14_PHASE6_RUNTIME_REDUCER.md"
);

const packageSource = read("package.json");

for (const token of [
  "beta14_phase6_runtime_reducer",
  "validateBeta13Phase6CanonicalEvent",
  "validateBeta13Phase6EventLog",
  "appendBeta13Phase6EventLog",
  "initialiseBeta14Phase6RuntimeState",
  "applyBeta14Phase6RuntimeEvent",
  "replayBeta14Phase6RuntimeEvents",
  "appendAndReduceBeta14Phase6RuntimeEvent",
  "phase6_runtime_reducer_append_only_violation",
  "phase6_runtime_reducer_event_order_invalid",
  "phase6_runtime_reducer_state_tampered",
  "split_return_skip",
  "completed",
  "partial",
  "terminated",
  'future_engine_effect: "none"'
]) {
  if (!source.includes(token)) {
    fail(`source_token_missing::${token}`);
  }
}

for (const forbidden of [
  "Math.random",
  "Date.now",
  "new Date(",
  "randomUUID",
  "performance.now",
  "../phases/",
  "../registries/",
  "billing_state",
  "payment_state",
  "coach_note"
]) {
  if (source.includes(forbidden)) {
    fail(`forbidden_source_token::${forbidden}`);
  }
}

if (
  !publicSource.includes(
    'from "./beta14_phase6_runtime_reducer.js"'
  )
) {
  fail("public_runtime_re_export_missing");
}

for (const token of [
  "beta14Phase6RuntimeReducerContract",
  "initialiseBeta14Phase6RuntimeState",
  "applyBeta14Phase6RuntimeEvent",
  "replayBeta14Phase6RuntimeEvents",
  "appendAndReduceBeta14Phase6RuntimeEvent"
]) {
  if (!typeSource.includes(token)) {
    fail(`public_type_missing::${token}`);
  }
}

for (const token of [
  "happy path completed session",
  "happy path partial completion",
  "happy path split return continue",
  "happy path split return skip",
  "terminated classification is factual",
  "replay is byte-stable",
  "append-only truth rejects duplicate sequence",
  "rejects post-hoc reducer state editing",
  "rejects post-hoc canonical event editing",
  "cannot mutate future engine input"
]) {
  if (!testSource.includes(token)) {
    fail(`test_missing::${token}`);
  }
}

for (const token of [
  "npm run build",
  "beta_14_phase6_runtime_reducer.test.mjs"
]) {
  if (!runnerSource.includes(token)) {
    fail(`runner_token_missing::${token}`);
  }
}

for (const token of [
  '"proof:beta-14"',
  "npm run proof:beta-14",
  "run_beta_14_phase6_runtime_reducer_tests.mjs",
  "beta_14_phase6_runtime_reducer_guard.mjs"
]) {
  if (!packageSource.includes(token)) {
    fail(`package_entrypoint_missing::${token}`);
  }
}

for (const token of [
  "completed, partial or terminated classification",
  "exact next sequence only",
  "do not alter later engine input",
  "deeply frozen",
  "emits no advice"
]) {
  if (!docSource.includes(token)) {
    fail(`documentation_token_missing::${token}`);
  }
}

const fixtureRoot = path.join(
  root,
  "test",
  "fixtures",
  "beta_14_phase6_runtime_reducer"
);

const manifestPath = path.join(
  fixtureRoot,
  "manifest.json"
);

if (!fs.existsSync(manifestPath)) {
  fail("fixture_manifest_missing");
}
else {
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );

  const expected = [
    "completed",
    "partial",
    "split_continue",
    "split_skip",
    "terminated"
  ];

  const actual = manifest.scenarios
    .map((entry) => entry.scenario_id)
    .sort();

  if (
    JSON.stringify(actual) !==
    JSON.stringify(expected)
  ) {
    fail("fixture_scenario_set_invalid");
  }

  for (const entry of manifest.scenarios) {
    const filePath = path.join(
      fixtureRoot,
      entry.file
    );

    if (!fs.existsSync(filePath)) {
      fail(`fixture_missing::${entry.file}`);
      continue;
    }

    const content = fs.readFileSync(
      filePath,
      "utf8"
    );

    if (sha256(content) !== entry.sha256) {
      fail(`fixture_hash_mismatch::${entry.file}`);
    }
  }
}

if (!failed) {
  const compiledPath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "runtime",
    "beta14_phase6_runtime_reducer.js"
  );

  if (!fs.existsSync(compiledPath)) {
    fail("compiled_runtime_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(compiledPath).href
    );

    if (
      runtime
        .beta14Phase6RuntimeReducerContract
        .slice_id !== "BETA-14"
    ) {
      fail("compiled_contract_slice_mismatch");
    }

    if (
      runtime
        .beta14Phase6RuntimeReducerContract
        .future_engine_effect !== "none"
    ) {
      fail("compiled_future_engine_effect_drift");
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
      guard: "BETA-14",
      token:
        "CI_BETA_14_PHASE6_RUNTIME_REDUCER",
      message:
        "Phase 6 runtime reducer contract passed."
    })
  );
}
