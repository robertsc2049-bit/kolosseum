// @law: Repo Governance
// @severity: medium
// @scope: repo

// DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with
// readable output. Do not weaken the guard to make a failing build pass; fix the underlying
// boundary drift or update the canonical contract deliberately.

/**
 * workflow_policy_header_guard
 * ---------------------------------------------
 * Contract:
 * - Every workflow file under .github/workflows must start with a small policy comment header.
 * - Specifically, every workflow requires the sentinel line: "KOLOSSEUM WORKFLOW POLICY".
 * - The sentinel must appear near the top within the first 30 non-empty lines.
 *
 * Why:
 * - Prevent "helpful" future edits from undoing intended trigger policy
 *   (main-only vs all-branches) and reintroducing CI cost/latency.
 * - Keep workflow boundary expectations visible in the file that future
 *   developers are most likely to edit.
 */

import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(`workflow_policy_header_guard: FAIL: ${msg}`);
  process.exit(1);
}

function readUtf8NoBom(p) {
  const buf = fs.readFileSync(p);
  // Strip UTF-8 BOM if present.
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  return buf.toString("utf8");
}

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function firstNonEmptyLines(s, maxNonEmpty) {
  const out = [];
  const lines = s.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed);
    if (out.length >= maxNonEmpty) break;
  }
  return out;
}

/**
 * DEV NOTE: Workflow discovery is intentionally non-recursive.
 * GitHub workflow files must live directly under .github/workflows. Nested files
 * are not valid workflow entrypoints and should not silently gain policy status.
 */
function listWorkflowYamlFiles(workflowsDir) {
  if (!fs.existsSync(workflowsDir)) {
    fail(`missing workflow directory: ${workflowsDir}`);
  }

  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".yml") || name.toLowerCase().endsWith(".yaml"))
    .sort()
    .map((name) => path.join(workflowsDir, name));
}

function ensurePolicyHeaderNearTop(filePath, maxNonEmptyLines = 30) {
  if (!fs.existsSync(filePath)) {
    fail(`missing workflow file: ${filePath}`);
  }

  const raw = readUtf8NoBom(filePath);
  const txt = normalizeLf(raw);
  const nonEmpty = firstNonEmptyLines(txt, maxNonEmptyLines);

  const sentinel = "KOLOSSEUM WORKFLOW POLICY";
  const hasSentinel = nonEmpty.some((line) => line.includes(sentinel));

  if (!hasSentinel) {
    fail(
      `policy header missing or too far down in ${filePath}. Expected sentinel "${sentinel}" within first ${maxNonEmptyLines} non-empty lines.`
    );
  }

  if (nonEmpty.length > 0 && !nonEmpty[0].startsWith("#")) {
    fail(`first non-empty line in ${filePath} must be a YAML comment (# ...). Found: "${nonEmpty[0]}"`);
  }
}

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, ".github", "workflows");
const workflowFiles = listWorkflowYamlFiles(workflowsDir);

if (workflowFiles.length === 0) {
  fail("no workflow YAML files found under .github/workflows");
}

for (const workflowFile of workflowFiles) {
  ensurePolicyHeaderNearTop(workflowFile, 30);
}

console.log(`OK: workflow_policy_header_guard (${workflowFiles.length} workflow file(s))`);
