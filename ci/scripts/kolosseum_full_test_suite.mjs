#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

const mode = process.argv.includes("--full") ? "full" : "change";
const onlyFailures = process.argv.includes("--failed-only") || process.env.KOLOSSEUM_FAILED_ONLY === "1";

const report = {
  ok: true,
  suite: "kolosseum_comprehensive_test_suite",
  version: "2.1.0",
  checked_at_utc: new Date(0).toISOString(),
  mode,
  node_version: process.versions.node,
  gates: [],
  failures: []
};

function normalisePath(p) {
  if (!p) return null;
  return String(p).replaceAll("\\", "/");
}

function gate(name, status, details = {}) {
  report.gates.push({ name, status, ...details });
}

function fail(token, gateName, file, details) {
  report.ok = false;
  report.failures.push({
    token,
    gate: gateName,
    file: normalisePath(file),
    details
  });
}

function readText(abs) {
  let text = fs.readFileSync(abs, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function exists(rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

function walk(dirRel) {
  const start = path.join(repoRoot, dirRel);
  const out = [];

  if (!fs.existsSync(start)) return out;

  const stack = [start];

  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      const base = path.basename(current);

      if ([
        ".git",
        "node_modules",
        "dist",
        "build",
        ".next",
        "coverage",
        ".turbo",
        ".vercel",
        ".cache"
      ].includes(base)) {
        continue;
      }

      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child));
      }
    } else {
      out.push(current);
    }
  }

  return out;
}

function repoFiles() {
  const roots = [
    ".github",
    "app",
    "ci",
    "docs",
    "engine",
    "lib",
    "registries",
    "replay",
    "schema",
    "schemas",
    "server",
    "shared",
    "src",
    "ui",
    "web"
  ];

  const files = [];

  for (const root of roots) {
    for (const file of walk(root)) {
      files.push(file);
    }
  }

  for (const rel of ["package.json", "tsconfig.json"]) {
    if (exists(rel)) files.push(path.join(repoRoot, rel));
  }

  return Array.from(new Set(files));
}

function parsePackage() {
  const file = path.join(repoRoot, "package.json");

  if (!fs.existsSync(file)) {
    gate("package_json", "failed");
    fail("CI_PACKAGE_JSON_MISSING", "package_json", "package.json", "package.json is missing.");
    return null;
  }

  try {
    const pkg = JSON.parse(readText(file));
    gate("package_json", "passed");
    return pkg;
  } catch (err) {
    gate("package_json", "failed");
    fail("CI_PACKAGE_JSON_INVALID", "package_json", "package.json", String(err.message || err));
    return null;
  }
}

function scriptExists(pkg, scriptName) {
  return Boolean(pkg?.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, scriptName));
}

function runCommand(gateName, command, args, required = true) {
  if (!onlyFailures) {
    console.log("");
    console.log("== " + gateName + " ==");
    console.log([command, ...args].join(" "));
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });

  const code = typeof result.status === "number" ? result.status : 1;
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (code === 0) {
    gate(gateName, "passed", { command: [command, ...args].join(" ") });

    if (!onlyFailures) {
      if (stdout.trim()) console.log(stdout);
      if (stderr.trim()) console.error(stderr);
    }

    return true;
  }

  gate(gateName, "failed", { command: [command, ...args].join(" "), exit_code: code });

  fail(
    required ? "CI_GATE_FAILED" : "CI_OPTIONAL_GATE_FAILED",
    gateName,
    null,
    "Command exited non-zero: " + code
  );

  console.log("");
  console.log("==== FAILED GATE: " + gateName + " ====");
  console.log("Command: " + [command, ...args].join(" "));
  console.log("ExitCode: " + code);

  if (stdout.trim()) {
    console.log("");
    console.log("-- stdout --");
    console.log(stdout);
  }

  if (stderr.trim()) {
    console.log("");
    console.log("-- stderr --");
    console.log(stderr);
  }

  return false;
}

function runNpm(pkg, gateName, scriptName, required = true) {
  if (!scriptExists(pkg, scriptName)) {
    if (required) {
      gate(gateName, "failed", { script: scriptName });
      fail("CI_TEST_WIRING_MISSING", gateName, "package.json", "Missing npm script: " + scriptName);
      return false;
    }

    gate(gateName, "skipped", { script: scriptName, reason: "script not present" });
    return true;
  }

  return runCommand(gateName, npmCommand, ["run", scriptName], required);
}

function testGitRepo() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false
  });

  if (result.status !== 0) {
    gate("git_repo", "failed");
    fail("CI_GIT_REPO_INVALID", "git_repo", null, "Not inside a Git repository.");
    return;
  }

  gate("git_repo", "passed", { root: normalisePath(result.stdout.trim()) });
}

function testNodeVersion() {
  gate("node_version", "passed", {
    actual: process.versions.node,
    policy: "desktop-current-node-accepted"
  });
}

function testRequiredFiles() {
  const required = [
    "ci/scripts/kolosseum_v0_test_suite.mjs",
    "ci/scripts/kolosseum_full_test_suite.mjs",
    "docs/dev/V0_TEST_SUITE_BRIEF.md",
    "docs/dev/COMPREHENSIVE_TEST_SUITE.md"
  ];

  let failed = 0;

  for (const rel of required) {
    if (!exists(rel)) {
      failed += 1;
      fail("CI_TEST_WIRING_MISSING", "required_files", rel, "Required file missing.");
    }
  }

  gate("required_files", failed === 0 ? "passed" : "failed", {
    files_checked: required.length,
    failed
  });
}

function testJsonValidity() {
  const files = repoFiles().filter(file => /\.json$/i.test(file));
  let failed = 0;

  for (const file of files) {
    try {
      JSON.parse(readText(file));
    } catch (err) {
      failed += 1;
      fail("CI_JSON_INVALID", "json_validity", file, String(err.message || err));
    }
  }

  gate("json_validity", failed === 0 ? "passed" : "failed", {
    files_checked: files.length,
    failed
  });
}

function testNodeSyntax() {
  const files = repoFiles()
    .filter(file => /\.(mjs|cjs|js)$/i.test(file))
    .filter(file => !/\/test\/|\/tests\/|\\test\\|\\tests\\/i.test(file))
    .filter(file => !/\.config\.(js|mjs|cjs)$/i.test(file));

  let failed = 0;

  for (const file of files) {
    const result = spawnSync("node", ["--check", file], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false
    });

    if (result.status !== 0) {
      failed += 1;
      fail("CI_NODE_SYNTAX_INVALID", "node_syntax", file, result.stderr || result.stdout || "node --check failed");
    }
  }

  gate("node_syntax", failed === 0 ? "passed" : "failed", {
    files_checked: files.length,
    failed
  });
}

function testReplayVectorPresence() {
  const roots = ["replay/suite", "vectors", "test/vectors", "tests/vectors"];
  const envelopes = [];

  for (const root of roots) {
    for (const file of walk(root)) {
      if (/envelope\.json$/i.test(file)) envelopes.push(file);
    }
  }

  if (envelopes.length === 0) {
    gate("replay_vector_presence", "failed");
    fail("CI_REPLAY_VECTOR_MISSING", "replay_vector_presence", "replay/suite", "No replay vector envelope.json files found.");
    return;
  }

  gate("replay_vector_presence", "passed", {
    envelope_count: envelopes.length,
    envelopes: envelopes.map(file => normalisePath(path.relative(repoRoot, file)))
  });
}

function printFinalReport() {
  console.log("");
  console.log("== Failed gates only ==");
  const failedGates = report.gates.filter(g => g.status === "failed");

  if (failedGates.length === 0) {
    console.log("No failed gates.");
  } else {
    for (const failed of failedGates) {
      console.log(JSON.stringify(failed, null, 2));
    }
  }

  console.log("");
  console.log("== Summary JSON ==");
  console.log(JSON.stringify({
    ok: report.ok,
    suite: report.suite,
    version: report.version,
    mode: report.mode,
    node_version: report.node_version,
    failed_gate_count: failedGates.length,
    failures: report.failures
  }, null, 2));
}

function main() {
  if (!onlyFailures) {
    console.log("");
    console.log("== Kolosseum desktop-current comprehensive suite ==");
  }

  testGitRepo();
  testNodeVersion();

  const pkg = parsePackage();

  if (!pkg) {
    printFinalReport();
    process.exit(1);
  }

  testRequiredFiles();
  testJsonValidity();
  testNodeSyntax();
  testReplayVectorPresence();

  runNpm(pkg, "v0_boundary_suite", "test:v0", true);
  runNpm(pkg, "build", "build", true);

  if (mode === "full") {
    /*
      Full mode deliberately uses clean-tree gated repo-owned checks only.
      It still does not call raw npm test, because raw npm test currently includes
      DB-bound, Vitest-bound, and module-mock-sensitive tests that require separate setup.
    */
    runNpm(pkg, "lint_fast_clean_tree_gate", "lint:fast", true);
  }

  printFinalReport();
  process.exit(report.ok ? 0 : 1);
}

main();