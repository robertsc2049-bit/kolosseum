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

test("verifier passes when operator freeze bundle rebuild is deterministic", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-preservation-pass-"));

  writeFile(tempRoot, "docs/releases/V1_HANDOFF_INDEX.md", "# handoff\n");
  writeFile(tempRoot, "ci/scripts/check.mjs", "export {};\n");
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
          "ci/scripts/check.mjs"
        ]
      },
      null,
      2
    ) + "\n"
  );

  const buildScript = `
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
let root = process.cwd();
let setPath = "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json";

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--root") root = path.resolve(args[i + 1]);
  if (args[i] === "--set") setPath = args[i + 1];
}
const set = JSON.parse(fs.readFileSync(path.join(root, setPath), "utf8"));
const out = path.join(root, set.output_dir);
fs.rmSync(out, { recursive: true, force: true });
for (const rel of set.artefacts) {
  const src = path.join(root, rel);
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ artefacts: set.artefacts }, null, 2) + "\\n", "utf8");
`;

  writeFile(tempRoot, "ci/scripts/build_operator_freeze_pack.mjs", buildScript);

  const result = runNode("ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs", [
    "--root", tempRoot,
    "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, true);
  assert.ok(report.first_rebuild_directory_sha256);
  assert.equal(report.first_rebuild_directory_sha256, report.second_rebuild_directory_sha256);
});

test("verifier fails when bundle rebuild drifts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-preservation-drift-"));

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

  const buildScript = `
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
let root = process.cwd();
let setPath = "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json";

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--root") root = path.resolve(args[i + 1]);
  if (args[i] === "--set") setPath = args[i + 1];
}

const stampFile = path.join(root, ".drift-counter");
let n = 0;
if (fs.existsSync(stampFile)) {
  n = Number(fs.readFileSync(stampFile, "utf8"));
}
n += 1;
fs.writeFileSync(stampFile, String(n), "utf8");

const set = JSON.parse(fs.readFileSync(path.join(root, setPath), "utf8"));
const out = path.join(root, set.output_dir);
fs.rmSync(out, { recursive: true, force: true });

for (const rel of set.artefacts) {
  const src = path.join(root, rel);
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  let content = fs.readFileSync(src, "utf8");
  if (n > 1) {
    content += "\\n# drift " + n + "\\n";
  }
  fs.writeFileSync(dst, content, "utf8");
}

fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ artefacts: set.artefacts, n }, null, 2) + "\\n", "utf8");
`;

  writeFile(tempRoot, "ci/scripts/build_operator_freeze_pack.mjs", buildScript);

  const result = runNode("ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs", [
    "--root", tempRoot,
    "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((x) => x.token === "CI_NON_DETERMINISTIC_OUTPUT"), true);
});

test("verifier fails when builder is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-bundle-preservation-missing-"));

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

  const result = runNode("ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs", [
    "--root", tempRoot,
    "--set", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "--builder", "ci/scripts/build_operator_freeze_pack.mjs",
    "--report", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");

  const report = JSON.parse(
    fs.readFileSync(path.join(tempRoot, "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json"), "utf8")
  );

  assert.equal(report.ok, false);
  assert.equal(report.failures[0].token, "CI_SPINE_MISSING_DOC");
});