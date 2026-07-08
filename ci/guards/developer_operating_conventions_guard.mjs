// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @law docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md
 * @severity error
 * @scope dev
 */
import fs from "node:fs";

const requiredFiles = [
  "docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md",
  "docs/dev/NAMING_CONVENTIONS.md",
  "docs/dev/BRANCH_AND_PR_CONVENTIONS.md",
  "docs/dev/SLICE_TEMPLATE.md",
  "docs/dev/REPO_MAP.md",
  "docs/dev/CI_FAILURE_GUIDE.md",
  "docs/dev/CODE_COMMENT_POLICY.md",
  "docs/dev/FUNCTION_DOCUMENTATION_POLICY.md",
  ".github/pull_request_template.md",
];

const requiredNamingMarkers = [
  "# Naming Conventions",
  "## Branch names",
  "## Slice IDs",
  "## File and folder names",
  "## TypeScript names",
  "## Functions",
  "## Tests",
  "## Failure tokens",
  "## Registry IDs",
  "## Runtime events",
  "## API routes",
  "## Database names",
  "## Forbidden naming patterns",
];

const requiredOperatingMarkers = [
  "# Developer Operating Conventions",
  "Docs define law.",
  "Tests prove behaviour.",
  "Comments explain boundaries.",
  "CI blocks drift.",
  "One active slice at a time.",
];

const requiredBranchPrMarkers = [
  "# Branch and PR Conventions",
  "ticket/s-v1-00-short-name",
  "PR body must include",
  "delete the remote branch",
];

const requiredPrTemplateMarkers = [
  "Target",
  "Boundary",
  "Non-scope",
  "Tests",
];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`developer_operating_conventions_guard failed: ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    fail(`missing required file: ${file}`);
  }
}

if (process.exitCode) {
  process.exit();
}

const naming = read("docs/dev/NAMING_CONVENTIONS.md");
const operating = read("docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md");
const branchPr = read("docs/dev/BRANCH_AND_PR_CONVENTIONS.md");
const prTemplate = read(".github/pull_request_template.md");
const packageJson = JSON.parse(read("package.json"));

for (const marker of requiredNamingMarkers) {
  if (!naming.includes(marker)) {
    fail(`NAMING_CONVENTIONS.md missing marker: ${marker}`);
  }
}

for (const marker of requiredOperatingMarkers) {
  if (!operating.includes(marker)) {
    fail(`DEVELOPER_OPERATING_CONVENTIONS.md missing marker: ${marker}`);
  }
}

for (const marker of requiredBranchPrMarkers) {
  if (!branchPr.includes(marker)) {
    fail(`BRANCH_AND_PR_CONVENTIONS.md missing marker: ${marker}`);
  }
}

for (const marker of requiredPrTemplateMarkers) {
  if (!prTemplate.includes(marker)) {
    fail(`pull_request_template.md missing marker: ${marker}`);
  }
}

const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
if (!lintFast.includes("ci/guards/developer_operating_conventions_guard.mjs")) {
  fail("package.json lint:fast does not invoke developer_operating_conventions_guard.mjs");
}

if (process.exitCode) {
  process.exit();
}

console.log("OK: developer_operating_conventions_guard");
