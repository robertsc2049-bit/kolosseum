#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const mode = process.argv.includes("--full") ? "full" : "change";
const failedOnly = process.argv.includes("--failed-only") || process.env.KOLOSSEUM_FAILED_ONLY === "1";

const results = [];
const failures = [];

function normalisePath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function printSection(title) {
  if (!failedOnly) {
    console.log("");
    console.log("== " + title + " ==");
  }
}

function fail(token, gate, file, details) {
  failures.push({ token, gate, file: file || null, details });
}

function requireFile(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    fail("CI_REQUIRED_FILE_MISSING", "required_files", relPath, "Required file missing.");
  }
}

function readPackageJson() {
  const packagePath = path.join(repoRoot, "package.json");

  if (!fs.existsSync(packagePath)) {
    fail("CI_PACKAGE_JSON_MISSING", "package_json", "package.json", "package.json is missing.");
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (err) {
    fail("CI_PACKAGE_JSON_INVALID", "package_json", "package.json", String(err.message || err));
    return null;
  }
}

function runCommand(name, command, args, required = true) {
  const rendered = command + " " + args.join(" ");

  if (!failedOnly) {
    console.log("");
    console.log("== " + name + " ==");
    console.log(rendered);
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: isWindows,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    },
    windowsHide: true
  });

  const exitCode = typeof result.status === "number" ? result.status : 1;
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  const record = {
    name,
    status: exitCode === 0 ? "passed" : "failed",
    command: rendered,
    exit_code: exitCode
  };

  results.push(record);

  if (exitCode !== 0) {
    console.log("");
    console.log("==== FAILED GATE: " + name + " ====");
    console.log("Command: " + rendered);
    console.log("ExitCode: " + exitCode);

    const output = (stdout + stderr).trim();
    if (output.length > 0) {
      console.log("");
      console.log("-- output --");
      console.log(output);
    }

    fail(required ? "CI_GATE_FAILED" : "CI_OPTIONAL_GATE_FAILED", name, null, "Command exited non-zero: " + exitCode);
    return;
  }

  if (!failedOnly) {
    console.log(name + " passed.");
  }
}

function runNpm(pkg, gateName, scriptName, required = true) {
  if (!pkg || !pkg.scripts || !pkg.scripts[scriptName]) {
    fail("CI_TEST_WIRING_MISSING", gateName, "package.json", "Missing npm script: " + scriptName);
    return;
  }

  runCommand(gateName, npmCommand, ["run", scriptName], required);
}

function runJsonValidity() {
  const jsonFiles = [
    "package.json",
    "ci/evidence/evidence_envelope.v1.json",
    "ci/evidence/evidence_seal.v1.json",
    "ci/schemas/phase1.input.schema.v1.0.0.json",
    "replay/suite/v0_minimal_positive/envelope.json"
  ];

  for (const relPath of jsonFiles) {
    const fullPath = path.join(repoRoot, relPath);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (err) {
      fail("CI_JSON_INVALID", "json_validity", relPath, String(err.message || err));
    }
  }
}

function runNodeSyntaxChecks() {
  const files = [
    "ci/scripts/kolosseum_v0_test_suite.mjs",
    "ci/scripts/kolosseum_full_test_suite.mjs"
  ];

  for (const relPath of files) {
    const fullPath = path.join(repoRoot, relPath);

    if (!fs.existsSync(fullPath)) {
      fail("CI_NODE_SYNTAX_FILE_MISSING", "node_syntax", relPath, "Syntax-check target missing.");
      continue;
    }

    const result = spawnSync("node", ["--check", relPath], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: isWindows,
      env: {
        ...process.env,
        FORCE_COLOR: "0"
      },
      windowsHide: true
    });

    const exitCode = typeof result.status === "number" ? result.status : 1;

    if (exitCode !== 0) {
      fail(
        "CI_NODE_SYNTAX_INVALID",
        "node_syntax",
        relPath,
        (result.stdout || "") + (result.stderr || "") || "node --check failed"
      );
    }
  }
}

function runRepoRootCheck() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: isWindows,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    },
    windowsHide: true
  });

  const exitCode = typeof result.status === "number" ? result.status : 1;

  if (exitCode !== 0) {
    fail("CI_GIT_REPO_INVALID", "git_repo", null, "Not inside a Git repository.");
    return;
  }

  const topLevel = normalisePath((result.stdout || "").trim());
  const expected = normalisePath(repoRoot);

  if (topLevel !== expected) {
    fail("CI_GIT_REPO_ROOT_MISMATCH", "git_repo", null, "Expected " + expected + " but got " + topLevel);
  }
}

function printSummary() {
  const failed = results.filter((result) => result.status !== "passed");

  if (failed.length > 0) {
    console.log("");
    console.log("== Failed gates only ==");
    for (const item of failed) {
      console.log(JSON.stringify(item, null, 2));
    }
  }

  const summary = {
    ok: failures.length === 0,
    suite: "kolosseum_comprehensive_test_suite",
    version: "2.2.0",
    mode,
    node_version: process.version.replace(/^v/, ""),
    failed_gate_count: failures.length,
    failures
  };

  console.log("");
  console.log("== Summary JSON ==");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

console.log("== Kolosseum desktop-current comprehensive suite ==");

const pkg = readPackageJson();

requireFile("package.json");
requireFile("ci/scripts/kolosseum_v0_test_suite.mjs");
requireFile("ci/scripts/kolosseum_full_test_suite.mjs");
requireFile("replay/suite/v0_minimal_positive/envelope.json");

runRepoRootCheck();
runJsonValidity();
runNodeSyntaxChecks();

if (failures.length === 0) {
  runNpm(pkg, "v0_boundary_suite", "test:v0", true);
  runNpm(pkg, "build", "build", true);

  if (mode === "full") {
    runNpm(pkg, "lint_fast_clean_tree_gate", "lint:fast", true);
  }
}

printSummary();