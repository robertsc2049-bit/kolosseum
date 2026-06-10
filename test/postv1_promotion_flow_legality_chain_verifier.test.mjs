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

function runVerifier(promotionFlowPath, acceptanceSetPath, cwd) {
  const scriptPath = path.resolve("ci/scripts/run_postv1_promotion_flow_legality_chain_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, promotionFlowPath, acceptanceSetPath], {
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

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p52-promotion-flow-"));
  const releasesDir = path.join(root, "docs", "releases");
  const scriptsDir = path.join(root, "ci", "scripts");

  writeText(
    path.join(releasesDir, "V1_PROMOTION_FLOW.md"),
    [
      "# V1 Promotion Flow",
      "",
      "1. Complete packaging.",
      "2. Confirm evidence.",
      "3. Confirm acceptance.",
      "4. Confirm merge readiness.",
      "5. Promote."
    ].join("\n") + "\n"
  );

  writeText(path.join(releasesDir, "V1_PACKAGING_EVIDENCE_MANIFEST.json"), "{ }\n");
  writeText(path.join(releasesDir, "V1_EVIDENCE_SURFACE_REGISTRY.json"), "{ }\n");
  writeText(path.join(releasesDir, "V1_MAINLINE_GREEN_RUN_EVIDENCE.md"), "# evidence\n");
  writeText(path.join(releasesDir, "V1_ACCEPTANCE_PACK_INDEX.md"), "# acceptance\n");
  writeText(path.join(releasesDir, "V1_ACCEPTANCE_SIGNOFF.md"), "# signoff\n");
  writeText(path.join(releasesDir, "V1_RELEASE_CHECKLIST.md"), "# checklist\n");

  writeText(path.join(scriptsDir, "run_postv1_packaging_evidence_manifest_verifier.mjs"), "// verifier\n");
  writeText(path.join(scriptsDir, "run_postv1_evidence_surface_verifier.mjs"), "// verifier\n");
  writeText(path.join(scriptsDir, "run_postv1_acceptance_pack_composition_verifier.mjs"), "// verifier\n");
  writeText(path.join(scriptsDir, "run_postv1_merge_readiness_verifier.mjs"), "// verifier\n");

  writeJson(path.join(releasesDir, "V1_ACCEPTANCE_ARTEFACT_SET.json"), {
    name: "V1 acceptance artefact set",
    artefacts: [
      { path: "docs/releases/V1_PROMOTION_FLOW.md", role: "promotion" },
      { path: "docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json", role: "supporting" },
      { path: "docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json", role: "supporting" },
      { path: "docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md", role: "evidence" },
      { path: "docs/releases/V1_ACCEPTANCE_PACK_INDEX.md", role: "index" },
      { path: "docs/releases/V1_ACCEPTANCE_SIGNOFF.md", role: "signoff" },
      { path: "docs/releases/V1_RELEASE_CHECKLIST.md", role: "checklist" },
      { path: "ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs", role: "supporting" },
      { path: "ci/scripts/run_postv1_evidence_surface_verifier.mjs", role: "supporting" },
      { path: "ci/scripts/run_postv1_acceptance_pack_composition_verifier.mjs", role: "supporting" },
      { path: "ci/scripts/run_postv1_merge_readiness_verifier.mjs", role: "supporting" }
    ]
  });

  return {
    root,
    promotionFlowPath: path.join(root, "docs", "releases", "V1_PROMOTION_FLOW.md"),
    acceptanceSetPath: path.join(root, "docs", "releases", "V1_ACCEPTANCE_ARTEFACT_SET.json"),
  };
}

test("P52: promotion legality verifier passes when the chain is explicit and legally declared", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.promotionFlowPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("P52: promotion legality verifier fails when merge readiness is bypassed", () => {
  const fixture = createFixture();

  writeText(
    fixture.promotionFlowPath,
    [
      "# V1 Promotion Flow",
      "",
      "1. Complete packaging.",
      "2. Confirm evidence.",
      "3. Confirm acceptance.",
      "4. Promote."
    ].join("\n") + "\n"
  );

  const { status, report } = runVerifier(fixture.promotionFlowPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(Array.isArray(report.failures));
  assert.ok(
    report.failures.some((failure) => failure.token === "promotion_flow_missing_chain_step"),
    `expected promotion_flow_missing_chain_step, got ${JSON.stringify(report, null, 2)}`
  );
});