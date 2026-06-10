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

function runVerifier(releaseNotesPath, acceptanceSetPath, cwd) {
  const scriptPath = path.resolve("ci/scripts/run_postv1_release_note_claim_boundary_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, releaseNotesPath, acceptanceSetPath], {
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p51-release-note-"));
  const releasesDir = path.join(root, "docs", "releases");

  writeText(
    path.join(releasesDir, "V1_RELEASE_NOTES.md"),
    [
      "# V1 Release Notes",
      "",
      "- Acceptance pack composition verifier added.",
      "- Release note claim boundary verifier added.",
      "- Release notes are constrained to declared acceptance surfaces and evidence.",
      "- Rollback and promotion surfaces remain explicitly declared in the acceptance pack."
    ].join("\n") + "\n"
  );

  writeText(path.join(releasesDir, "V1_ACCEPTANCE_PACK_INDEX.md"), "# pack index\n");
  writeText(path.join(releasesDir, "V1_ACCEPTANCE_SIGNOFF.md"), "# signoff\n");
  writeText(path.join(releasesDir, "V1_RELEASE_CHECKLIST.md"), "# checklist\n");
  writeText(path.join(releasesDir, "V1_MAINLINE_GREEN_RUN_EVIDENCE.md"), "# evidence\n");
  writeText(path.join(releasesDir, "V1_ROLLBACK.md"), "# rollback\n");
  writeText(path.join(releasesDir, "V1_PROMOTION_FLOW.md"), "# promotion\n");

  writeJson(path.join(releasesDir, "V1_ACCEPTANCE_ARTEFACT_SET.json"), {
    name: "V1 acceptance artefact set",
    artefacts: [
      { path: "docs/releases/V1_ACCEPTANCE_PACK_INDEX.md", role: "index" },
      { path: "docs/releases/V1_ACCEPTANCE_SIGNOFF.md", role: "signoff" },
      { path: "docs/releases/V1_RELEASE_CHECKLIST.md", role: "checklist" },
      { path: "docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md", role: "evidence" },
      { path: "docs/releases/V1_ROLLBACK.md", role: "rollback" },
      { path: "docs/releases/V1_PROMOTION_FLOW.md", role: "promotion" }
    ]
  });

  return {
    root,
    releaseNotesPath: path.join(root, "docs", "releases", "V1_RELEASE_NOTES.md"),
    acceptanceSetPath: path.join(root, "docs", "releases", "V1_ACCEPTANCE_ARTEFACT_SET.json"),
  };
}

test("P51: release-note claim boundary verifier passes for scoped claims backed by declared surfaces", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.releaseNotesPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("P51: release-note claim boundary verifier fails overclaim phrase with closed token", () => {
  const fixture = createFixture();

  writeText(
    fixture.releaseNotesPath,
    [
      "# V1 Release Notes",
      "",
      "- This release is fully proven and production ready."
    ].join("\n") + "\n"
  );

  const { status, report } = runVerifier(fixture.releaseNotesPath, fixture.acceptanceSetPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(Array.isArray(report.failures));
  assert.ok(
    report.failures.some((failure) => failure.token === "release_note_forbidden_phrase"),
    `expected release_note_forbidden_phrase, got ${JSON.stringify(report, null, 2)}`
  );
});