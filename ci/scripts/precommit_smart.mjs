import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const AFFECTED_WORKFLOW_CONTRACT_TESTS = new Set([
  "test/ci_test_affected_composition.test.mjs",
  "test/ci_test_affected_script.test.mjs",
  "test/ci_test_affected_mode_semantics_source_contract.test.mjs",
  "test/ci_precommit_smart_workflow_source_contract.test.mjs",
  "test/ci_precommit_smart_routing_contract.test.mjs"
]);

const SHARED_FULL_RISK_FILES = new Set([
  "package.json",
  "ci/contracts/test_ci_composition.json",
  "ci/scripts/precommit_smart.mjs",
  "ci/scripts/compose_test_affected_from_changed_files.mjs",
  "ci/scripts/run_test_affected_from_changed_files.mjs",
  "ci/scripts/compose_test_ci_from_index.mjs",
  "ci/scripts/run_test_ci_from_index.mjs"
]);

function sh(command) {
  execSync(command, { stdio: "inherit" });
}

function read(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

export function normalizeRepoPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function isDocsOnlySurface(file) {
  return file === "README.md" || file.startsWith("docs/");
}

function isSharedFullRiskFile(file) {
  return SHARED_FULL_RISK_FILES.has(file);
}

function isAffectedWorkflowContractTest(file) {
  return AFFECTED_WORKFLOW_CONTRACT_TESTS.has(file);
}

export function getPrecommitRoute(stagedFiles) {
  const files = unique(
    stagedFiles
      .map(normalizeRepoPath)
      .filter(Boolean)
  );

  if (files.length === 0) {
    return {
      kind: "docs",
      banner: "[pre-commit] no staged files -> skip",
      commands: []
    };
  }

  if (files.every(isDocsOnlySurface)) {
    return {
      kind: "docs",
      banner: "[pre-commit] docs fast-path -> skip heavy checks",
      commands: []
    };
  }

  const hasSharedFullRisk = files.some(isSharedFullRiskFile);

  if (hasSharedFullRisk) {
    return {
      kind: "full",
      banner: "[pre-commit] shared/full-risk surface -> green:fast",
      commands: ["npm run green:fast"]
    };
  }

  const onlyAffectedWorkflowContractTests = files.every(isAffectedWorkflowContractTest);

  if (onlyAffectedWorkflowContractTests) {
    return {
      kind: "affected",
      banner: "[pre-commit] affected-workflow contract tests -> build:fast + test:affected",
      commands: ["npm run build:fast", "npm run test:affected"]
    };
  }

  return {
    kind: "affected",
    banner: "[pre-commit] app/test surface -> build:fast + test:affected",
    commands: ["npm run build:fast", "npm run test:affected"]
  };
}

function getStagedFiles() {
  const raw = read("git diff --cached --name-only --diff-filter=ACMR");
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map(normalizeRepoPath)
    .filter(Boolean);
}

function main() {
  const stagedFiles = getStagedFiles();

  console.log("[pre-commit] smart dispatcher");
  console.log(`[pre-commit] staged files: ${stagedFiles.length}`);

  const route = getPrecommitRoute(stagedFiles);
  console.log(route.banner);

  for (const command of route.commands) {
    sh(command);
  }

  console.log("[pre-commit] OK");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
