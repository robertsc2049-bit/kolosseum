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

function runVerifier(indexPath, cwd) {
  const scriptPath = path.resolve("ci/scripts/run_postv1_acceptance_pack_composition_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, indexPath], {
    cwd,
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

function createPackFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p50-acceptance-pack-"));
  const releasesDir = path.join(root, "docs", "releases");

  writeText(path.join(releasesDir, "acceptance-pack-index.md"), "# acceptance pack index\n");
  writeText(path.join(releasesDir, "acceptance-pack-signoff.md"), "# signoff\n");
  writeText(path.join(releasesDir, "acceptance-pack-checklist.md"), "# checklist\n");
  writeText(path.join(releasesDir, "acceptance-pack-evidence-01.md"), "# evidence 01\n");
  writeText(path.join(releasesDir, "acceptance-pack-evidence-02.md"), "# evidence 02\n");
  writeText(path.join(releasesDir, "acceptance-pack-rollback.md"), "# rollback\n");
  writeText(path.join(releasesDir, "acceptance-pack-promotion.md"), "# promotion\n");

  writeText(path.join(root, "ci", "scripts", "run_postv1_final_acceptance_gate.mjs"), "// script\n");

  const indexPath = path.join(releasesDir, "V1_ACCEPTANCE_ARTEFACT_SET.json");
  writeJson(indexPath, {
    name: "V1 acceptance artefact set",
    artefacts: [
      { path: "docs/releases/acceptance-pack-index.md", role: "index" },
      { path: "docs/releases/acceptance-pack-signoff.md", role: "signoff" },
      { path: "docs/releases/acceptance-pack-checklist.md", role: "checklist" },
      { path: "docs/releases/acceptance-pack-evidence-01.md", role: "evidence" },
      { path: "docs/releases/acceptance-pack-evidence-02.md", role: "evidence" },
      { path: "docs/releases/acceptance-pack-rollback.md", role: "rollback" },
      { path: "docs/releases/acceptance-pack-promotion.md", role: "promotion" },
      { path: "ci/scripts/run_postv1_final_acceptance_gate.mjs", role: "supporting" }
    ]
  });

  return {
    root,
    releasesDir,
    indexPath,
  };
}

test("P50: acceptance pack composition verifier passes when all declared surfaces are complete", () => {
  const fixture = createPackFixture();
  const { status, report } = runVerifier(fixture.indexPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("P50: acceptance pack composition verifier fails missing reference with closed token", () => {
  const fixture = createPackFixture();
  fs.rmSync(path.join(fixture.releasesDir, "acceptance-pack-promotion.md"));

  const { status, report } = runVerifier(fixture.indexPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(Array.isArray(report.failures));
  assert.ok(
    report.failures.some(
      (failure) =>
        failure.token === "missing_reference" &&
        failure.path === "docs/releases/acceptance-pack-promotion.md"
    ),
    `expected missing_reference for docs/releases/acceptance-pack-promotion.md, got ${JSON.stringify(report, null, 2)}`
  );
});