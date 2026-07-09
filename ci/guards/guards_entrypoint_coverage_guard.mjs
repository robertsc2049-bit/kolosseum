// @law: CI Integrity
// @severity: high
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

// DEV NOTE: Guard entrypoint coverage guard.
// Purpose: prove every tracked ci/guards/*.mjs file is reachable from at least
// one declared repo entrypoint. BETA-04 expands committed split-script configs
// referenced by declared package scripts so Windows-safe npm splitting does not
// make guards appear dormant.
// Boundary: this guard reads package/workflow/split-config text only. It does
// not execute guards, mutate product code, alter engine behaviour, or interpret
// runtime state.

const DECLARED_PACKAGE_SCRIPTS = Object.freeze([
  "lint:fast",
  "dev:fast",
  "green",
  "ci",
  "green:ci",
  "build:fast",
  "test:unit",
  "test:ci",
  "e2e:golden",
  "guard:index",
  "guard:constraints",
  "guard:version"
]);

const WORKFLOW_PATHS = Object.freeze([
  ".github/workflows/green.yml",
  ".github/workflows/green.yaml"
]);

function normRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function fail(message, lines = []) {
  console.error(`[ERR] ${message}`);
  for (const line of lines) {
    console.error(line);
  }
  process.exit(1);
}

function gitLines(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.error) {
    fail(`git ${args.join(" ")} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`git ${args.join(" ")} failed.`, [
      result.stdout.trim(),
      result.stderr.trim()
    ].filter(Boolean));
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normRel);
}

function readTextIfExists(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(abs)) {
    return "";
  }

  return fs.readFileSync(abs, "utf8");
}

function readJsonIfExists(relPath) {
  const text = readTextIfExists(relPath);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in ${relPath}: ${error.message}`);
  }
}

function extractSplitConfigPaths(commandText) {
  const out = [];
  const pattern = /node\s+ci\/scripts\/run_split_npm_script\.mjs\s+([^\s"'`]+)/g;
  let match;

  while ((match = pattern.exec(commandText)) !== null) {
    out.push(normRel(match[1]));
  }

  return out;
}

function expandSplitConfigs(entrypointTexts) {
  const seen = new Set();
  const queue = [];

  for (const text of entrypointTexts) {
    for (const configPath of extractSplitConfigPaths(text)) {
      queue.push(configPath);
    }
  }

  while (queue.length > 0) {
    const configPath = queue.shift();
    if (!configPath || seen.has(configPath)) {
      continue;
    }

    seen.add(configPath);

    const config = readJsonIfExists(configPath);
    if (!config) {
      fail(`Declared split npm script config is missing: ${configPath}`);
    }

    if (!Array.isArray(config.commands) || config.commands.length === 0) {
      fail(`Split npm script config has no commands: ${configPath}`);
    }

    for (const command of config.commands) {
      if (typeof command !== "string" || !command.trim()) {
        fail(`Split npm script config contains a non-string command: ${configPath}`);
      }

      entrypointTexts.push(command);

      for (const nestedConfigPath of extractSplitConfigPaths(command)) {
        queue.push(nestedConfigPath);
      }
    }
  }

  return entrypointTexts;
}

function packageEntrypointTexts() {
  const pkg = readJsonIfExists("package.json");
  if (!pkg || typeof pkg !== "object") {
    fail("package.json must contain a JSON object.");
  }

  const scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  const texts = [];

  for (const scriptName of DECLARED_PACKAGE_SCRIPTS) {
    const value = scripts[scriptName];
    if (typeof value === "string" && value.trim()) {
      texts.push(value);
    }
  }

  return texts;
}

function workflowEntrypointTexts() {
  const trackedWorkflowPaths = new Set(gitLines(["ls-files", ".github/workflows/*.yml", ".github/workflows/*.yaml"]));
  const selected = new Set(WORKFLOW_PATHS.filter((relPath) => trackedWorkflowPaths.has(relPath)));

  if (selected.size === 0 && trackedWorkflowPaths.has(".github/workflows/green.yml")) {
    selected.add(".github/workflows/green.yml");
  }

  return [...selected].map((relPath) => readTextIfExists(relPath)).filter(Boolean);
}

function trackedGuardFiles() {
  return gitLines(["ls-files", "ci/guards/*.mjs"])
    .filter((relPath) => relPath.startsWith("ci/guards/"))
    .sort((a, b) => a.localeCompare(b));
}

const guardFiles = trackedGuardFiles();
const entrypointTexts = expandSplitConfigs([
  ...packageEntrypointTexts(),
  ...workflowEntrypointTexts()
]);

const combinedEntrypointText = entrypointTexts.join("\n");
const missing = guardFiles.filter((guardPath) => !combinedEntrypointText.includes(guardPath));

if (missing.length > 0) {
  fail("Unreferenced guard(s) detected. Every ci/guards/*.mjs must be referenced by at least one DECLARED entrypoint:", [
    "- package.json scripts: " + DECLARED_PACKAGE_SCRIPTS.join(", "),
    "- workflow files: " + WORKFLOW_PATHS.join(", "),
    "- split configs referenced by declared scripts are expanded",
    "",
    "Missing:",
    ...missing.map((guardPath) => `- ${guardPath}`)
  ]);
}

console.log("OK: guards_entrypoint_coverage_guard");
