#!/usr/bin/env node
/**
 * DEV NOTE: S-V0-27 workflow parity closure guard.
 * Purpose: lock the workflow command surface that S-V0-27 closes: policy
 * headers, green CI parity, comprehensive suite ownership, and v0 suite
 * ownership.
 * Boundary: this guard reads workflow text only. It must not execute CI,
 * replace GitHub Actions semantics, add workflows, or weaken branch protection.
 * Failure: emits a stable S_V0_27_* token and exits non-zero so local and CI
 * users can identify the exact workflow contract drift.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, ".github", "workflows");

function fail(token, message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    token,
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function readUtf8(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    fail("S_V0_27_WORKFLOW_FILE_MISSING", `Missing required file: ${relPath}`);
  }

  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function listWorkflowFiles() {
  if (!fs.existsSync(workflowsDir)) {
    fail("S_V0_27_WORKFLOW_DIR_MISSING", ".github/workflows is missing");
  }

  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".yml") || name.toLowerCase().endsWith(".yaml"))
    .sort();
}

function assertIncludes(text, required, label) {
  if (!text.includes(required)) {
    fail("S_V0_27_REQUIRED_WORKFLOW_TEXT_MISSING", `${label} is missing required text`, {
      required
    });
  }
}

const workflowFiles = listWorkflowFiles();

if (workflowFiles.length !== new Set(workflowFiles.map((name) => name.toLowerCase())).size) {
  fail("S_V0_27_DUPLICATE_WORKFLOW_FILENAME", "Duplicate workflow filename detected.");
}

for (const workflowFile of workflowFiles) {
  const relPath = path.join(".github", "workflows", workflowFile).replaceAll(path.sep, "/");
  const text = readUtf8(relPath);
  const firstNonEmpty = text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 30);

  if (!firstNonEmpty.some((line) => line.includes("KOLOSSEUM WORKFLOW POLICY"))) {
    fail("S_V0_27_POLICY_HEADER_MISSING", `${relPath} is missing KOLOSSEUM WORKFLOW POLICY near the top.`);
  }

  if (firstNonEmpty.length > 0 && !firstNonEmpty[0].startsWith("#")) {
    fail("S_V0_27_POLICY_HEADER_NOT_FIRST", `${relPath} first non-empty line must be a comment.`);
  }
}

const greenWorkflow = readUtf8(".github/workflows/green.yml");
assertIncludes(greenWorkflow, "npm run green:ci", "green.yml");
assertIncludes(greenWorkflow, "npm run build:fast", "green.yml");
assertIncludes(greenWorkflow, "npm run test:ci:integration", "green.yml");

const comprehensiveWorkflow = readUtf8(".github/workflows/comprehensive-test-suite.yml");
assertIncludes(comprehensiveWorkflow, "npm run test:full", "comprehensive-test-suite.yml");

const v0Workflow = readUtf8(".github/workflows/v0-test-suite.yml");
assertIncludes(v0Workflow, "npm run test:v0", "v0-test-suite.yml");

const ciWorkflow = readUtf8(".github/workflows/ci.yml");
assertIncludes(ciWorkflow, "npm run ci", "ci.yml");

console.log(JSON.stringify({
  ok: true,
  guard: "s_v0_27_workflow_policy_and_parity_guard",
  workflow_count: workflowFiles.length
}, null, 2));
