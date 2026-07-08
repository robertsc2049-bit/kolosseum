#!/usr/bin/env node
/**
 * DEV NOTE: CI wrapper contract guard.
 * Purpose: lock the relationship between human npm entrypoints, wrapper scripts,
 * and GitHub workflow commands so local and CI gates keep the same core checks.
 * Boundary: this guard checks wiring only. It must not weaken individual guards,
 * reinterpret failures, or replace direct test/build execution.
 * Determinism: reads committed package/workflow/script files and compares exact
 * command strings plus required workflow invocations.
 * Failure: reports a stable CI_WRAPPER_CONTRACT_* token and exits non-zero.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readUtf8(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    fail("CI_WRAPPER_CONTRACT_FILE_MISSING", `${relPath} is missing`);
  }
  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readJson(relPath) {
  try {
    return JSON.parse(readUtf8(relPath));
  } catch (error) {
    fail("CI_WRAPPER_CONTRACT_JSON_INVALID", `${relPath} is invalid JSON: ${String(error?.message ?? error)}`);
  }
}

function fail(token, message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    token,
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail("CI_WRAPPER_CONTRACT_SCRIPT_DRIFT", `${label} drifted`, {
      expected,
      actual
    });
  }
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    fail("CI_WRAPPER_CONTRACT_REQUIRED_TEXT_MISSING", `${label} does not include required text`, {
      required: needle
    });
  }
}

function readWorkflowTexts() {
  const dir = path.join(repoRoot, ".github", "workflows");
  if (!fs.existsSync(dir)) {
    fail("CI_WRAPPER_CONTRACT_WORKFLOW_DIR_MISSING", ".github/workflows is missing");
  }

  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort()
    .map((name) => ({
      name,
      text: readUtf8(path.join(".github", "workflows", name))
    }));
}

const pkg = readJson("package.json");
const scripts = pkg.scripts || {};

const expectedScripts = {
  "build": "tsc -p tsconfig.json && npm run engine:shim:check",
  "build:fast": "node ci/guards/green_entrypoint_guard.mjs && node ci/guards/clean_tree_guard.mjs && tsc -p tsconfig.json && npm run engine:shim:check && node ci/guards/run_pipeline_contract_version_guard.mjs",
  "lint": "npm run lint:fast && npm run test:ci",
  "test:ci": "node ci/scripts/run_test_ci_from_index.mjs",
  "test:ci:integration": "node ci/scripts/run_test_ci_integration_from_index.mjs",
  "test:v0": "node ci/scripts/kolosseum_v0_test_suite.mjs",
  "test:change": "node ci/scripts/kolosseum_full_test_suite.mjs --failed-only",
  "test:full": "node ci/scripts/kolosseum_full_test_suite.mjs --full --failed-only",
  "green:ci": "node ci/guards/clean_tree_guard.mjs && npm run guard:constraints && npm run guard:version && npm run green && npm run build:fast && npm run e2e:golden",
  "ci": "npm run green:ci"
};

for (const [scriptName, expected] of Object.entries(expectedScripts)) {
  if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
    fail("CI_WRAPPER_CONTRACT_SCRIPT_MISSING", `package.json script is missing: ${scriptName}`);
  }
  assertEqual(String(scripts[scriptName]), expected, `package.json scripts.${scriptName}`);
}

assertIncludes(String(scripts["lint:fast"] || ""), "node ci/guards/clean_tree_guard.mjs", "lint:fast");
assertIncludes(String(scripts["lint:fast"] || ""), "node ci/scripts/run_failure_token_index_guard.mjs", "lint:fast");
assertIncludes(String(scripts["lint:fast"] || ""), "node ci/scripts/run_ci_wrapper_contract_guard.mjs", "lint:fast");

const fullSuite = readUtf8("ci/scripts/kolosseum_full_test_suite.mjs");
assertIncludes(fullSuite, 'const npmCommand = isWindows ? "npm.cmd" : "npm";', "kolosseum_full_test_suite.mjs");
assertIncludes(fullSuite, 'runNpm(pkg, "v0_boundary_suite", "test:v0", true);', "kolosseum_full_test_suite.mjs");
assertIncludes(fullSuite, 'runNpm(pkg, "build", "build", true);', "kolosseum_full_test_suite.mjs");
assertIncludes(fullSuite, 'runNpm(pkg, "lint_fast_clean_tree_gate", "lint:fast", true);', "kolosseum_full_test_suite.mjs");

const v0Suite = readUtf8("ci/scripts/kolosseum_v0_test_suite.mjs");
assertIncludes(v0Suite, 'pkg.scripts["test:v0"] !== "node ci/scripts/kolosseum_v0_test_suite.mjs"', "kolosseum_v0_test_suite.mjs");
assertIncludes(v0Suite, 'pkg.scripts["test:v0:json"] !== "node ci/scripts/kolosseum_v0_test_suite.mjs --json"', "kolosseum_v0_test_suite.mjs");

const workflows = readWorkflowTexts();
const workflowText = workflows.map((entry) => `\n# ${entry.name}\n${entry.text}`).join("\n");

assertIncludes(workflowText, "npm run ci", ".github/workflows");
assertIncludes(workflowText, "npm run green:ci", ".github/workflows");
assertIncludes(workflowText, "npm run test:v0", ".github/workflows");
assertIncludes(workflowText, "npm run test:full", ".github/workflows");
assertIncludes(workflowText, "npm run build:fast", ".github/workflows");

const commandsDoc = readUtf8("docs/COMMANDS.md");
assertIncludes(commandsDoc, "npm.cmd run lint:fast", "docs/COMMANDS.md");
assertIncludes(commandsDoc, "npm.cmd run test:v0", "docs/COMMANDS.md");
assertIncludes(commandsDoc, "npm.cmd run test:change", "docs/COMMANDS.md");
assertIncludes(commandsDoc, "npm.cmd run test:full", "docs/COMMANDS.md");
assertIncludes(commandsDoc, "npm.cmd run build", "docs/COMMANDS.md");

console.log(JSON.stringify({
  ok: true,
  guard: "ci_wrapper_contract_guard",
  checked_scripts: Object.keys(expectedScripts).length,
  checked_workflows: workflows.length
}, null, 2));
