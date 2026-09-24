// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @law docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md
 * @severity error
 * @scope dev
 *
 * DEV NOTE: ADMIN-02 extends this existing developer-conventions owner to prove
 * one canonical human verification entrypoint and portable developer paths.
 * This remains a documentation/repo-operating guard only; it does not change
 * engine, runtime, registry, release, or workflow semantics.
 */
import fs from "node:fs";

const CANONICAL_NPM_COMMAND = "npm run verify";
const CANONICAL_NPM_CMD_COMMAND = "npm.cmd run verify";
const EXPECTED_VERIFY_SCRIPT = "node ci/scripts/green_fast.mjs";

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

const commandSurfaceExpectations = new Map([
  ["README.md", [CANONICAL_NPM_COMMAND, CANONICAL_NPM_CMD_COMMAND]],
  ["CONTRIBUTING.md", [CANONICAL_NPM_COMMAND]],
  ["DEV_OPERATING_RULES.md", [CANONICAL_NPM_COMMAND]],
  ["docs/COMMANDS.md", [CANONICAL_NPM_COMMAND]],
  ["docs/DEVELOPER_ONBOARDING.md", [CANONICAL_NPM_COMMAND, CANONICAL_NPM_CMD_COMMAND]],
  ["docs/dev/GETTING_STARTED.md", [CANONICAL_NPM_CMD_COMMAND]],
  ["docs/dev/COMMAND_GUIDE.md", [CANONICAL_NPM_CMD_COMMAND]],
  ["docs/dev/CI_FAILURE_GUIDE.md", [CANONICAL_NPM_CMD_COMMAND]],
  ["docs/dev/SLICE_TEMPLATE.md", [CANONICAL_NPM_CMD_COMMAND]],
  ["docs/ARCHITECTURE.md", [CANONICAL_NPM_COMMAND]],
  ["docs/v0/P154_OPERATOR_QUICKSTART_PACK.md", [CANONICAL_NPM_CMD_COMMAND]],
  ["docs/v1/V1_CI_MASTER_GATE.md", [CANONICAL_NPM_CMD_COMMAND]],
]);

const portablePathSurfaces = [
  ...commandSurfaceExpectations.keys(),
  "watch-latest.ps1",
  "scripts/engine-health-ci.ps1",
  "scripts/engine-health-local.ps1",
  "scripts/kolosseum_pr_helpers.ps1",
  "scripts/install-hooks.ps1",
  "scripts/install-githooks.ps1",
  ".githooks/pre-push",
];

const stalePrimaryGatePatterns = [
  /Primary local check command:\s*\n\s*npm(?:\.cmd)? run lint:fast/i,
  /Primary local gate:\s*\n\s*npm(?:\.cmd)? run lint:fast/i,
  /Primary local check:\s*\n\s*npm(?:\.cmd)? run lint:fast/i,
  /canonical local verification command:\s*\n\s*npm(?:\.cmd)? run lint:fast/i,
  /normal local workflow:\s*\n\s*npm(?:\.cmd)? run lint:fast/i,
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
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

for (const file of new Set([...commandSurfaceExpectations.keys(), ...portablePathSurfaces, "package.json", "docs/v1/V1_CI_MASTER_GATE.json"])) {
  if (!fs.existsSync(file)) {
    fail(`missing canonical developer-command surface: ${file}`);
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

const verifyScript = packageJson.scripts?.verify;
if (verifyScript !== EXPECTED_VERIFY_SCRIPT) {
  fail(`package.json verify must equal '${EXPECTED_VERIFY_SCRIPT}', actual='${verifyScript ?? ""}'`);
}

for (const [file, markers] of commandSurfaceExpectations.entries()) {
  const text = read(file);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail(`${file} missing canonical developer verification command: ${marker}`);
    }
  }

  for (const pattern of stalePrimaryGatePatterns) {
    if (pattern.test(text)) {
      fail(`${file} advertises lint:fast as the primary/normal developer gate`);
    }
  }
}

const userSpecificWindowsPath = /[A-Za-z]:\\Users\\[^\\\r\n]+\\/i;
for (const file of portablePathSurfaces) {
  const text = read(file);
  const match = text.match(userSpecificWindowsPath);
  if (match) {
    fail(`${file} contains a user-specific absolute Windows path: ${match[0]}`);
  }
}

const masterGateManifest = JSON.parse(read("docs/v1/V1_CI_MASTER_GATE.json"));
if (masterGateManifest.current_primary_local_gate !== CANONICAL_NPM_CMD_COMMAND) {
  fail(`docs/v1/V1_CI_MASTER_GATE.json current_primary_local_gate must equal '${CANONICAL_NPM_CMD_COMMAND}'`);
}

if (process.exitCode) {
  process.exit();
}

console.log(JSON.stringify({
  ok: true,
  guard: "developer_operating_conventions_guard",
  canonical_command: CANONICAL_NPM_COMMAND,
  windows_command: CANONICAL_NPM_CMD_COMMAND,
  verify_script: verifyScript,
  command_surfaces_checked: commandSurfaceExpectations.size,
  portable_path_surfaces_checked: portablePathSurfaces.length,
}, null, 2));
