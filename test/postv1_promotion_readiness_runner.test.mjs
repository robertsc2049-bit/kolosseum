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

function runRunner(declarationPath, cwd) {
  const scriptPath = path.resolve("ci/scripts/run_postv1_promotion_readiness_runner.mjs");
  const result = spawnSync(process.execPath, [scriptPath, declarationPath], {
    cwd,
    encoding: "utf8",
  });

  const stdout = result.stdout.trim();
  assert.notEqual(stdout, "", "runner should emit JSON report to stdout");

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    assert.fail(`runner stdout was not valid JSON.\nstdout:\n${stdout}\nerror: ${error}`);
  }

  return {
    status: result.status,
    report,
  };
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

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p55-promotion-readiness-"));
  const logPath = path.join(root, "execution.log");
  const scriptsDir = path.join(root, "ci", "scripts");
  const declarationPath = path.join(root, "docs", "releases", "V1_PROMOTION_READINESS.json");

  createCheckScript(path.join(scriptsDir, "declared-first.mjs"), logPath, "declared-first");
  createCheckScript(path.join(scriptsDir, "declared-second.mjs"), logPath, "declared-second");
  createCheckScript(path.join(scriptsDir, "undeclared-third.mjs"), logPath, "undeclared-third");

  writeJson(declarationPath, {
    readiness_id: "v1_promotion_readiness",
    prerequisites: [
      {
        prereq_id: "declared_first",
        script_path: "ci/scripts/declared-first.mjs",
      },
      {
        prereq_id: "declared_second",
        script_path: "ci/scripts/declared-second.mjs",
      },
    ],
  });

  return {
    root,
    declarationPath,
    logPath,
  };
}

test("P55: promotion readiness runner executes only declared prerequisites in declared order", () => {
  const fixture = createFixture();
  const { status, report } = runRunner(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.executed_prerequisites.map((item) => item.prereq_id),
    ["declared_first", "declared_second"]
  );

  const log = fs.readFileSync(fixture.logPath, "utf8");
  assert.equal(log, "declared-first\ndeclared-second\n");
  assert.equal(log.includes("undeclared-third"), false);
});

test("P55: promotion readiness runner fails when a declared prerequisite script is missing", () => {
  const fixture = createFixture();

  writeJson(fixture.declarationPath, {
    readiness_id: "v1_promotion_readiness",
    prerequisites: [
      {
        prereq_id: "declared_first",
        script_path: "ci/scripts/declared-first.mjs",
      },
      {
        prereq_id: "missing_prerequisite",
        script_path: "ci/scripts/missing-prerequisite.mjs",
      },
    ],
  });

  const { status, report } = runRunner(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "readiness_prereq_path_missing"),
    `expected readiness_prereq_path_missing, got ${JSON.stringify(report, null, 2)}`
  );
});