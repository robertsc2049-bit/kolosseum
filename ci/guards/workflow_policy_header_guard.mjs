// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * workflow_policy_header_guard
 * ---------------------------------------------
 * Contract:
 * - Every workflow file under .github/workflows must start with a small policy comment header.
 * - Specifically, we require the sentinel line: "KOLOSSEUM WORKFLOW POLICY"
 * - And we require it to appear near the top (within the first 30 non-empty lines).
 *
 * Why:
 * - Prevent "helpful" future edits from undoing intended trigger policy
 *   (main-only vs all-branches) and reintroducing CI cost/latency.
 */

import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(`workflow_policy_header_guard: FAIL: ${msg}`);
  process.exit(1);
}

function readUtf8NoBom(p) {
  const buf = fs.readFileSync(p);
  // Strip UTF-8 BOM if present
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

function ensurePolicyHeaderNearTop(filePath, maxNonEmptyLines = 30) {
  if (!fs.existsSync(filePath)) {
    fail(`missing workflow file: ${filePath}`);
  }

  const raw = readUtf8NoBom(filePath);
  const txt = normalizeLf(raw);

  const nonEmpty = firstNonEmptyLines(txt, maxNonEmptyLines);

  // Sentinel must appear in first N non-empty lines
  const sentinel = "KOLOSSEUM WORKFLOW POLICY";
  const hasSentinel = nonEmpty.some((l) => l.includes(sentinel));
  if (!hasSentinel) {
    fail(
      `policy header missing or too far down in ${filePath}. Expected sentinel "${sentinel}" within first ${maxNonEmptyLines} non-empty lines.`
    );
  }

  // Strong nudge: header should be comment lines at the top (not a random mention later)
  // We accept "=====" style banners, but require the very first non-empty line to be a YAML comment.
  if (nonEmpty.length > 0 && !nonEmpty[0].startsWith("#")) {
    fail(`first non-empty line in ${filePath} must be a YAML comment (# ...). Found: "${nonEmpty[0]}"`);
  }
}

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, ".github", "workflows");

const required = [
  path.join(workflowsDir, "green.yml"),
  path.join(workflowsDir, "ci.yml"),
  path.join(workflowsDir, "engine-status.yml"),
];

for (const f of required) {
  ensurePolicyHeaderNearTop(f, 30);
}

console.log("OK: workflow_policy_header_guard");
