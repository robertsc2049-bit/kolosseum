import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function createGitShim(filePath) {
  writeText(
    filePath,
    [
      'const args = process.argv.slice(2);',
      'if (args[0] === "branch" && args[1] === "--show-current") {',
      '  process.stdout.write(process.env.TEST_GIT_BRANCH ?? "main");',
      '  process.exit(0);',
      '}',
      'if (args[0] === "status" && args[1] === "--porcelain") {',
      '  process.stdout.write(process.env.TEST_GIT_STATUS ?? "");',
      '  process.exit(0);',
      '}',
      'process.stderr.write(`unexpected git args: ${JSON.stringify(args)}`);',
      'process.exit(1);',
    ].join("\n") + "\n"
  );
}

function createCheckScript(filePath, logPath, label) {
  writeText(
    filePath,
    [
      'import fs from "node:fs";',
      `const logPath = ${JSON.stringify(logPath)};`,
      `fs.appendFileSync(logPath, ${JSON.stringify(`${label}\n`)});`,
      'process.stdout.write(`${JSON.stringify({ ok: true, failures: [] }, null, 2)}\\n`);',
    ].join("\n") + "\n"
  );
}

function runVerifier(declarationPath, cwd, env = {}) {
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_release_closure_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, declarationPath], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });

  const stdout = result.stdout.trim();
  assert.notEqual(stdout, "", "verifier should emit JSON report to stdout");

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    assert.fail(`verifier stdout was not valid JSON.\nstdout:\n${stdout}\nerror: ${error}`);
  }

  return {
    status: result.status,
    report,
  };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p56-release-closure-"));
  const logPath = path.join(root, "execution.log");
  const gitShimPath = path.join(root, "git-shim.mjs");
  const scriptsDir = path.join(root, "ci", "scripts");
  const declarationPath = path.join(root, "docs", "releases", "V1_RELEASE_CLOSURE.json");

  createGitShim(gitShimPath);
  createCheckScript(path.join(scriptsDir, "declared-check.mjs"), logPath, "declared-check");

  writeText(path.join(root, "docs", "releases", "V1_FINAL_ACCEPTANCE_BOUNDARY.json"), "{}\n");
  writeText(path.join(root, "docs", "releases", "V1_PROMOTION_READINESS.json"), "{}\n");

  writeJson(declarationPath, {
    closure_id: "v1_release_closure",
    required_release_surfaces: [
      "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json",
      "docs/releases/V1_PROMOTION_READINESS.json",
    ],
    post_merge_checks: [
      {
        check_id: "declared_check",
        script_path: "ci/scripts/declared-check.mjs",
      },
    ],
  });

  return {
    root,
    logPath,
    gitShimPath,
    declarationPath,
  };
}

test("P56: release closure verifier proves clean main post-merge state using declared checks only", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root, {
    KOLOSSEUM_GIT_BIN: fixture.gitShimPath,
    TEST_GIT_BRANCH: "main",
    TEST_GIT_STATUS: "",
  });

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.equal(report.current_branch, "main");
  assert.deepEqual(report.executed_checks.map((item) => item.check_id), ["declared_check"]);
  assert.deepEqual(report.verified_release_surfaces, [
    "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json",
    "docs/releases/V1_PROMOTION_READINESS.json",
  ]);

  const log = fs.readFileSync(fixture.logPath, "utf8");
  assert.equal(log, "declared-check\n");
});

test("P56: release closure verifier fails when declared release surface does not survive merge state", () => {
  const fixture = createFixture();

  writeJson(fixture.declarationPath, {
    closure_id: "v1_release_closure",
    required_release_surfaces: [
      "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json",
      "docs/releases/V1_MISSING_SURFACE.json",
    ],
    post_merge_checks: [
      {
        check_id: "declared_check",
        script_path: "ci/scripts/declared-check.mjs",
      },
    ],
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root, {
    KOLOSSEUM_GIT_BIN: fixture.gitShimPath,
    TEST_GIT_BRANCH: "main",
    TEST_GIT_STATUS: "",
  });

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "closure_declared_path_missing"),
    `expected closure_declared_path_missing, got ${JSON.stringify(report, null, 2)}`
  );
});