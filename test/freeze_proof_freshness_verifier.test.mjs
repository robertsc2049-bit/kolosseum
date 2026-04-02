import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { verifyFreezeProofFreshness } from "../ci/scripts/run_freeze_proof_freshness_verifier.mjs";

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-proof-freshness-"));
}

function seedBase(repoRoot) {
  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json"), {
    schema_version: "kolosseum.freeze.governed_surface.v1",
    governed_artefacts: [
      { path: "docs/releases/a.json" },
      { path: "ci/scripts/b.mjs" }
    ]
  });

  writeJson(path.join(repoRoot, "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json"), {
    schema_version: "kolosseum.freeze.proof_report_set.v1",
    proof_reports: [
      { path: "docs/releases/proof-one.json", required: true }
    ]
  });

  writeJson(path.join(repoRoot, "docs/releases/a.json"), {
    id: "a",
    ok: true
  });

  fs.mkdirSync(path.join(repoRoot, "ci/scripts"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "ci/scripts/b.mjs"), "export const x = 1;\n", "utf8");
}

function buildCurrentSurface(repoRoot) {
  const artefacts = [
    { path: "ci/scripts/b.mjs", sha256: sha256File(path.join(repoRoot, "ci/scripts/b.mjs")) },
    { path: "docs/releases/a.json", sha256: sha256File(path.join(repoRoot, "docs/releases/a.json")) }
  ].sort((a, b) => a.path.localeCompare(b.path, "en"));

  return {
    artefacts,
    governed_surface_hash: sha256Text(canonicalJson({ governed_artefacts: artefacts }))
  };
}

test("passes when proof report exactly matches current governed surface", () => {
  const repoRoot = makeRepo();
  seedBase(repoRoot);

  const current = buildCurrentSurface(repoRoot);

  writeJson(path.join(repoRoot, "docs/releases/proof-one.json"), {
    schema_version: "kolosseum.freeze.proof_report.v1",
    ok: true,
    proof_report_id: "proof-one",
    governed_surface_hash: current.governed_surface_hash,
    covered_artefacts: current.artefacts
  });

  const report = verifyFreezeProofFreshness({ repoRoot });
  assert.equal(report.ok, true);
  assert.equal(report.stale_reports.length, 0);
  assert.equal(report.governed_artefact_count, 2);
});

test("fails when a governed artefact changes after proof report creation", () => {
  const repoRoot = makeRepo();
  seedBase(repoRoot);

  const current = buildCurrentSurface(repoRoot);

  writeJson(path.join(repoRoot, "docs/releases/proof-one.json"), {
    schema_version: "kolosseum.freeze.proof_report.v1",
    ok: true,
    proof_report_id: "proof-one",
    governed_surface_hash: current.governed_surface_hash,
    covered_artefacts: current.artefacts
  });

  fs.writeFileSync(path.join(repoRoot, "ci/scripts/b.mjs"), "export const x = 2;\n", "utf8");

  const report = verifyFreezeProofFreshness({ repoRoot });
  assert.equal(report.ok, false);
  assert.equal(report.stale_reports.length, 1);
  assert.match(
    JSON.stringify(report.stale_reports[0]),
    /FREEZE_PROOF_REPORT_STALE_SURFACE_HASH|FREEZE_PROOF_REPORT_STALE_ARTEFACT_HASH/
  );
});

test("fails when proof report omits governed_surface_hash", () => {
  const repoRoot = makeRepo();
  seedBase(repoRoot);

  const current = buildCurrentSurface(repoRoot);

  writeJson(path.join(repoRoot, "docs/releases/proof-one.json"), {
    schema_version: "kolosseum.freeze.proof_report.v1",
    ok: true,
    proof_report_id: "proof-one",
    covered_artefacts: current.artefacts
  });

  const report = verifyFreezeProofFreshness({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.stale_reports[0]), /FREEZE_PROOF_REPORT_MISSING_GOVERNED_SURFACE_HASH/);
});

test("fails when proof report coverage is incomplete or out of scope", () => {
  const repoRoot = makeRepo();
  seedBase(repoRoot);

  const current = buildCurrentSurface(repoRoot);

  writeJson(path.join(repoRoot, "docs/releases/proof-one.json"), {
    schema_version: "kolosseum.freeze.proof_report.v1",
    ok: true,
    proof_report_id: "proof-one",
    governed_surface_hash: current.governed_surface_hash,
    covered_artefacts: [
      current.artefacts[0],
      { path: "docs/releases/not-governed.json", sha256: "a".repeat(64) }
    ]
  });

  const report = verifyFreezeProofFreshness({ repoRoot });
  assert.equal(report.ok, false);
  assert.match(
    JSON.stringify(report.stale_reports[0]),
    /FREEZE_PROOF_REPORT_MISSING_ARTEFACT_BINDING|FREEZE_PROOF_REPORT_OUT_OF_SCOPE_ARTEFACT/
  );
});