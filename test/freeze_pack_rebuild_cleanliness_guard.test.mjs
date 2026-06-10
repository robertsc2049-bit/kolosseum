import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
}

function runNode(scriptRelative, args = [], cwd = process.cwd()) {
  const scriptPath = path.resolve(scriptRelative);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runGit(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initRepo(root) {
  runGit(root, ["init"]);
  runGit(root, ["config", "user.name", "Test User"]);
  runGit(root, ["config", "user.email", "test@example.com"]);
}

test("passes when builder writes only to disposable output and leaves repo clean", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-pack-clean-pass-"));
  initRepo(tempRoot);

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: [
          "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"
        ]
      },
      null,
      2
    ) + "\n"
  );

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# runbook\n");

  writeFile(
    tempRoot,
    "ci/scripts/build_operator_freeze_pack.mjs",
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      "",
      "const args = process.argv.slice(2);",
      "let root = process.cwd();",
      'let setPath = "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json";',
      "let outDir = null;",
      "",
      "for (let i = 0; i < args.length; i += 1) {",
      '  if (args[i] === "--root") root = path.resolve(args[i + 1]);',
      '  if (args[i] === "--set") setPath = args[i + 1];',
      '  if (args[i] === "--out-dir") outDir = args[i + 1];',
      "}",
      "",
      "const set = JSON.parse(fs.readFileSync(path.join(root, setPath), 'utf8'));",
      "const outputDir = path.join(root, outDir ?? set.output_dir);",
      "fs.rmSync(outputDir, { recursive: true, force: true });",
      "for (const rel of set.artefacts) {",
      "  const src = path.join(root, rel);",
      "  const dst = path.join(outputDir, rel);",
      "  fs.mkdirSync(path.dirname(dst), { recursive: true });",
      "  fs.copyFileSync(src, dst);",
      "}",
      "fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify({ ok: true }, null, 2) + '\\n', 'utf8');",
      "console.log(JSON.stringify({ ok: true, output_dir: outputDir }, null, 2));",
      ""
    ].join("\n")
  );

  runGit(tempRoot, ["add", "."]);
  runGit(tempRoot, ["commit", "-m", "init"]);

  const result = runNode(
    "ci/scripts/run_freeze_pack_rebuild_cleanliness_guard.mjs",
    [
      "--root", tempRoot,
      "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
      "--artefact-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
      "--report", "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"
    ]
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"), "utf8")
  );

  assert.equal(report.ok, true);
  assert.deepEqual(report.before_status, []);
  assert.deepEqual(report.after_status, []);
});

test("fails when builder dirties repo with untracked output", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-pack-clean-fail-"));
  initRepo(tempRoot);

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: [
          "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"
        ]
      },
      null,
      2
    ) + "\n"
  );

  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# runbook\n");

  writeFile(
    tempRoot,
    "ci/scripts/build_operator_freeze_pack.mjs",
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      "",
      "const args = process.argv.slice(2);",
      "let root = process.cwd();",
      "",
      "for (let i = 0; i < args.length; i += 1) {",
      '  if (args[i] === "--root") root = path.resolve(args[i + 1]);',
      "}",
      "",
      "const dirty = path.join(root, 'artifacts/operator-freeze-pack');",
      "fs.mkdirSync(dirty, { recursive: true });",
      "fs.writeFileSync(path.join(dirty, 'manifest.json'), JSON.stringify({ ok: true }, null, 2) + '\\n', 'utf8');",
      "console.log(JSON.stringify({ ok: true }, null, 2));",
      ""
    ].join("\n")
  );

  runGit(tempRoot, ["add", "."]);
  runGit(tempRoot, ["commit", "-m", "init"]);

  const result = runNode(
    "ci/scripts/run_freeze_pack_rebuild_cleanliness_guard.mjs",
    [
      "--root", tempRoot,
      "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
      "--artefact-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
      "--report", "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"
    ]
  );

  assert.notEqual(result.status, 0, "expected cleanliness failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_DIRTY_TREE_AFTER_BUILD"), true);
});

test("fails when builder is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-pack-clean-missing-"));
  initRepo(tempRoot);

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: []
      },
      null,
      2
    ) + "\n"
  );

  runGit(tempRoot, ["add", "."]);
  runGit(tempRoot, ["commit", "-m", "init"]);

  const result = runNode(
    "ci/scripts/run_freeze_pack_rebuild_cleanliness_guard.mjs",
    [
      "--root", tempRoot,
      "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
      "--artefact-set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
      "--report", "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"
    ]
  );

  assert.notEqual(result.status, 0, "expected missing-builder failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});