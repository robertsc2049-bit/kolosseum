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

function runVerifier(versionTagPath, acceptanceSetPath, cwd) {
  const scriptPath = path.resolve("ci/scripts/run_postv1_release_version_tag_evidence_binding_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, versionTagPath, acceptanceSetPath], {
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p53-version-tag-"));
  const releasesDir = path.join(root, "docs", "releases");

  writeText(
    path.join(releasesDir, "V1_VERSION_AND_TAG.md"),
    [
      "# V1 Version And Tag",
      "",
      "Version: 1.0.0",
      "Tag: v1.0.0",
      "",
      "Binding:",
      "- accepted release state is declared through V1_ACCEPTANCE_ARTEFACT_SET.json, V1_ACCEPTANCE_PACK_INDEX.md, signoff, and checklist surfaces.",
      "- release evidence is declared through V1_MAINLINE_GREEN_RUN_EVIDENCE.md, V1_PACKAGING_EVIDENCE_MANIFEST.json, and V1_EVIDENCE_SURFACE_REGISTRY.json."
    ].join("\n") + "\n"
  );

  writeText(path.join(releasesDir, "V1_ACCEPTANCE_PACK_INDEX.md"), "# acceptance pack\n");
  writeText(path.join(releasesDir, "V1_ACCEPTANCE_SIGNOFF.md"), "# signoff\n");
  writeText(path.join(releasesDir, "V1_RELEASE_CHECKLIST.md"), "# checklist\n");
  writeText(path.join(releasesDir, "V1_MAINLINE_GREEN_RUN_EVIDENCE.md"), "# evidence\n");
  writeText(path.join(releasesDir, "V1_PACKAGING_EVIDENCE_MANIFEST.json"), "{ }\n");
  writeText(path.join(releasesDir, "V1_EVIDENCE_SURFACE_REGISTRY.json"), "{ }\n");

  writeJson(path.join(releasesDir, "V1_ACCEPTANCE_ARTEFACT_SET.json"), {
    name: "V1 acceptance artefact set",
    artefacts: [
      { path: "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json", role: "index" },
      { path: "docs/releases/V1_ACCEPTANCE_PACK_INDEX.md", role: "index" },
      { path: "docs/releases/V1_ACCEPTANCE_SIGNOFF.md", role: "signoff" },
      { path: "docs/releases/V1_RELEASE_CHECKLIST.md", role: "checklist" },
      { path: "docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md", role: "evidence" },
      { path: "docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json", role: "evidence" },
      { path: "docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json", role: "evidence" },
      { path: "docs/releases/V1_VERSION_AND_TAG.md", role: "supporting" }
    ]
  });

  return {
    root,
    versionTagPath: path.join(root, "docs", "releases", "V1_VERSION_AND_TAG.md"),
    acceptanceSetPath: path.join(root, "docs", "releases", "V1_ACCEPTANCE_ARTEFACT_SET.json"),
  };
}

test("P53: version/tag binding verifier passes when version/tag is bound to accepted evidence surfaces", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.versionTagPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("P53: version/tag binding verifier fails drift when binding references are omitted", () => {
  const fixture = createFixture();

  writeText(
    fixture.versionTagPath,
    [
      "# V1 Version And Tag",
      "",
      "Version: 1.0.0",
      "Tag: v1.0.0"
    ].join("\n") + "\n"
  );

  const { status, report } = runVerifier(fixture.versionTagPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(Array.isArray(report.failures));
  assert.ok(
    report.failures.some((failure) => failure.token === "version_tag_missing_binding_reference"),
    `expected version_tag_missing_binding_reference, got ${JSON.stringify(report, null, 2)}`
  );
});