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

function runNode(scriptRelative, args = []) {
  const scriptPath = path.resolve(scriptRelative);
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

test("builder creates deterministic bounded operator freeze pack", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-pack-pass-"));

  writeFile(tempRoot, "docs/releases/V1_HANDOFF_INDEX.md", "# handoff\n");
  writeFile(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", "# runbook\n");
  writeFile(tempRoot, "ci/scripts/run_operator_freeze_check.mjs", "export {};\n");
  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        schema_version: "kolosseum.release.operator_freeze_artefact_set.v1",
        release_id: "V1",
        pack_id: "operator_freeze_pack",
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: [
          "docs/releases/V1_HANDOFF_INDEX.md",
          "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
          "ci/scripts/run_operator_freeze_check.mjs"
        ]
      },
      null,
      2
    ) + "\n"
  );

  const build = runNode("ci/scripts/build_operator_freeze_pack.mjs", ["--root", tempRoot, "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"]);
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const verify = runNode("ci/scripts/run_operator_freeze_pack_composition_verifier.mjs", ["--root", tempRoot, "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"]);
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);

  const manifestPath = path.join(tempRoot, "artifacts/operator-freeze-pack/manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.artefact_count, 3);
  assert.deepEqual(
    manifest.artefacts.map((x) => x.path),
    [
      "docs/releases/V1_HANDOFF_INDEX.md",
      "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
      "ci/scripts/run_operator_freeze_check.mjs"
    ]
  );
});

test("verifier fails when undeclared file exists in built pack", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-pack-extra-"));

  writeFile(tempRoot, "docs/releases/V1_HANDOFF_INDEX.md", "# handoff\n");
  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        schema_version: "kolosseum.release.operator_freeze_artefact_set.v1",
        release_id: "V1",
        pack_id: "operator_freeze_pack",
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: [
          "docs/releases/V1_HANDOFF_INDEX.md"
        ]
      },
      null,
      2
    ) + "\n"
  );

  const build = runNode("ci/scripts/build_operator_freeze_pack.mjs", ["--root", tempRoot, "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"]);
  assert.equal(build.status, 0, build.stderr || build.stdout);

  writeFile(tempRoot, "artifacts/operator-freeze-pack/extra.txt", "bad\n");

  const verify = runNode("ci/scripts/run_operator_freeze_pack_composition_verifier.mjs", ["--root", tempRoot, "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"]);
  assert.notEqual(verify.status, 0, "expected verifier failure");

  const report = JSON.parse(verify.stderr);
  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.details.includes("Undeclared file present")), true);
});

test("builder fails when declared source file is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-pack-missing-"));

  writeFile(
    tempRoot,
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    JSON.stringify(
      {
        schema_version: "kolosseum.release.operator_freeze_artefact_set.v1",
        release_id: "V1",
        pack_id: "operator_freeze_pack",
        output_dir: "artifacts/operator-freeze-pack",
        artefacts: [
          "docs/releases/V1_HANDOFF_INDEX.md"
        ]
      },
      null,
      2
    ) + "\n"
  );

  const build = runNode("ci/scripts/build_operator_freeze_pack.mjs", ["--root", tempRoot, "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"]);
  assert.notEqual(build.status, 0, "expected builder failure");
  assert.equal(build.stderr.includes("Declared operator freeze artefact missing"), true);
});