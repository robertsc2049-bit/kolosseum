import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { verifyFreezeDrift } from "../ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs";

function normalizeText(value) {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, normalizeText(content), "utf8");
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + "\n");
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "p108-"));
  git(repoDir, ["init"]);
  git(repoDir, ["config", "user.name", "Kolosseum Test"]);
  git(repoDir, ["config", "user.email", "test@example.com"]);

  writeText(path.join(repoDir, "README.md"), "# test\n");
  git(repoDir, ["add", "README.md"]);
  git(repoDir, ["commit", "-m", "initial"]);

  git(repoDir, ["branch", "-M", "main"]);
  git(repoDir, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  return repoDir;
}

function runVerifier(cwd, manifest, evidence) {
  const manifestPath = path.join(cwd, "ci", "freeze", "freeze_sensitive_surfaces.v1.json");
  const evidencePath = path.join(cwd, "docs", "releases", "V1_FREEZE_DRIFT_EVIDENCE.json");

  writeJson(manifestPath, manifest);
  writeJson(evidencePath, evidence);

  return verifyFreezeDrift({
    baseRef: "origin/main",
    manifestPath,
    evidencePath,
    repoRoot: cwd,
  });
}

test("passes when no freeze-sensitive files changed since merge-base", (t) => {
  const repoDir = initRepo();
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));

  writeText(path.join(repoDir, "src", "feature.txt"), "ok\n");
  git(repoDir, ["add", "src/feature.txt"]);
  git(repoDir, ["commit", "-m", "non-freeze change"]);

  const result = runVerifier(
    repoDir,
    {
      schema_version: "kolosseum.freeze_sensitive_surfaces.v1",
      freeze_sensitive_surfaces: ["docs/releases/**", "ci/evidence/**"],
    },
    {
      schema_version: "kolosseum.freeze_drift_evidence.v1",
      base_ref: "origin/main",
      freeze_drift_attested: "false",
      freeze_surface_changes: [],
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.changed_freeze_sensitive_files, []);
});

test("fails when freeze-sensitive drift exists without attestation", (t) => {
  const repoDir = initRepo();
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));

  writeText(path.join(repoDir, "docs", "releases", "V1_RELEASE_NOTES.md"), "freeze notes\n");
  git(repoDir, ["add", "docs/releases/V1_RELEASE_NOTES.md"]);
  git(repoDir, ["commit", "-m", "freeze notes change"]);

  const result = runVerifier(
    repoDir,
    {
      schema_version: "kolosseum.freeze_sensitive_surfaces.v1",
      freeze_sensitive_surfaces: ["docs/releases/**"],
    },
    {
      schema_version: "kolosseum.freeze_drift_evidence.v1",
      base_ref: "origin/main",
      freeze_drift_attested: "false",
      freeze_surface_changes: [],
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_DRIFT_SINCE_MERGE_BASE");
  assert.match(result.failures[0].details, /not explicitly attested/i);
});

test("fails when changed freeze-sensitive file is not listed in evidence", (t) => {
  const repoDir = initRepo();
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));

  writeText(path.join(repoDir, "docs", "releases", "V1_RELEASE_NOTES.md"), "freeze notes\n");
  git(repoDir, ["add", "docs/releases/V1_RELEASE_NOTES.md"]);
  git(repoDir, ["commit", "-m", "freeze notes change"]);

  const result = runVerifier(
    repoDir,
    {
      schema_version: "kolosseum.freeze_sensitive_surfaces.v1",
      freeze_sensitive_surfaces: ["docs/releases/**"],
    },
    {
      schema_version: "kolosseum.freeze_drift_evidence.v1",
      base_ref: "origin/main",
      freeze_drift_attested: "true",
      freeze_surface_changes: ["docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"],
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_DRIFT_SINCE_MERGE_BASE");
  assert.match(result.failures[0].details, /without corresponding evidence entry/i);
});

test("fails when evidence lists a file not changed since merge-base", (t) => {
  const repoDir = initRepo();
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));

  writeText(path.join(repoDir, "docs", "releases", "V1_RELEASE_NOTES.md"), "freeze notes\n");
  git(repoDir, ["add", "docs/releases/V1_RELEASE_NOTES.md"]);
  git(repoDir, ["commit", "-m", "freeze notes change"]);

  const result = runVerifier(
    repoDir,
    {
      schema_version: "kolosseum.freeze_sensitive_surfaces.v1",
      freeze_sensitive_surfaces: ["docs/releases/**"],
    },
    {
      schema_version: "kolosseum.freeze_drift_evidence.v1",
      base_ref: "origin/main",
      freeze_drift_attested: "true",
      freeze_surface_changes: [
        "docs/releases/V1_RELEASE_NOTES.md",
        "docs/releases/NOT_CHANGED.md"
      ],
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_DRIFT_SINCE_MERGE_BASE");
  assert.match(result.failures[0].details, /not changed since merge-base/i);
});

test("passes when changed freeze-sensitive files are fully attested in evidence", (t) => {
  const repoDir = initRepo();
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));

  writeText(path.join(repoDir, "docs", "releases", "V1_RELEASE_NOTES.md"), "freeze notes\n");
  writeText(path.join(repoDir, "ci", "evidence", "freeze.txt"), "evidence\n");
  git(repoDir, ["add", "docs/releases/V1_RELEASE_NOTES.md", "ci/evidence/freeze.txt"]);
  git(repoDir, ["commit", "-m", "freeze-sensitive change"]);

  const result = runVerifier(
    repoDir,
    {
      schema_version: "kolosseum.freeze_sensitive_surfaces.v1",
      freeze_sensitive_surfaces: ["docs/releases/**", "ci/evidence/**"],
    },
    {
      schema_version: "kolosseum.freeze_drift_evidence.v1",
      base_ref: "origin/main",
      freeze_drift_attested: "true",
      freeze_surface_changes: [
        "ci/evidence/freeze.txt",
        "docs/releases/V1_RELEASE_NOTES.md"
      ],
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.changed_freeze_sensitive_files.sort(),
    ["ci/evidence/freeze.txt", "docs/releases/V1_RELEASE_NOTES.md"].sort()
  );
});