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

function makeEntry(sliceId, proofSurface, invariant, proofType) {
  return {
    slice_id: sliceId,
    proof_surface: proofSurface,
    invariant,
    proof_type: proofType
  };
}

function seedRequiredSurfaces(root) {
  const required = [
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
    "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
    "docs/releases/V1_PROMOTION_READINESS.json",
    "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json"
  ];

  for (const relPath of required) {
    writeFile(root, relPath, "{\n  \"ok\": true\n}\n");
  }
}

function canonicalIndexObject() {
  return {
    ok: true,
    verifier_id: "freeze_proof_index_verifier",
    checked_at_utc: "2026-04-02T13:30:00.000Z",
    invariant: "freeze governance must be inspectable from one authoritative proof map",
    proof_entry_count: 13,
    proof_entries: [
      makeEntry("P114", "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json", "freeze rollback must stay compatible with sealed freeze semantics", "verifier_report"),
      makeEntry("P115", "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json", "mainline freeze preservation must remain byte-stable across governed surfaces", "verifier_report"),
      makeEntry("P116", "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json", "operator freeze bundle input surface must stay deterministic and bounded", "bundle_spec"),
      makeEntry("P117", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json", "operator freeze bundle rebuild must not drift from governed source artefacts", "verifier_report"),
      makeEntry("P118", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json", "freeze manifest must fully enumerate governed byte identities", "verifier_report"),
      makeEntry("P119", "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json", "freeze evidence manifest cannot drift structurally without fresh governed artefact recomputation", "verifier_report"),
      makeEntry("P120", "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json", "handoff bundle must be minimal and sufficient", "verifier_report"),
      makeEntry("P121", "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json", "freeze packaging and preservation checks must not run before freeze state + manifest integrity are established", "verifier_report"),
      makeEntry("P122", "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json", "sealed freeze surfaces cannot change silently on mainline", "verifier_report"),
      makeEntry("P123", "docs/releases/V1_FREEZE_DRIFT_REPORT.json", "freeze state must be inspectable from one bounded report", "aggregate_report"),
      makeEntry("P124", "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", "freeze cannot be declared complete while any freeze-proof surface is absent or failing", "verifier_report"),
      makeEntry("P125", "docs/releases/V1_PROMOTION_READINESS.json", "promotion readiness must depend on completed freeze proof chain", "readiness_report"),
      makeEntry("P126", "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json", "standard freeze build path must leave clean working tree", "verifier_report")
    ]
  };
}

test("passes when freeze proof index lists every P114-P126 proof surface exactly once", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-index-pass-"));
  seedRequiredSurfaces(tempRoot);

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_PROOF_INDEX.json",
    JSON.stringify(canonicalIndexObject(), null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_proof_index_verifier.mjs", [
    "--root", tempRoot,
    "--index", "docs/releases/V1_FREEZE_PROOF_INDEX.json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("fails when a required proof entry is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-index-missing-"));
  seedRequiredSurfaces(tempRoot);

  const broken = canonicalIndexObject();
  broken.proof_entries = broken.proof_entries.filter((entry) => entry.slice_id !== "P126");
  broken.proof_entry_count = broken.proof_entries.length;

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_PROOF_INDEX.json",
    JSON.stringify(broken, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_proof_index_verifier.mjs", [
    "--root", tempRoot,
    "--index", "docs/releases/V1_FREEZE_PROOF_INDEX.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(result.stderr);
  assert.equal(report.failures.some((x) => x.details.includes("Required freeze proof index entry missing")), true);
});

test("fails when a proof surface is duplicated", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-index-duplicate-"));
  seedRequiredSurfaces(tempRoot);

  const broken = canonicalIndexObject();
  broken.proof_entries.push(
    makeEntry(
      "P126_DUP",
      "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json",
      "duplicate invariant",
      "verifier_report"
    )
  );
  broken.proof_entry_count = broken.proof_entries.length;

  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_PROOF_INDEX.json",
    JSON.stringify(broken, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_proof_index_verifier.mjs", [
    "--root", tempRoot,
    "--index", "docs/releases/V1_FREEZE_PROOF_INDEX.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(result.stderr);
  assert.equal(report.failures.some((x) => x.details.includes("Duplicate freeze proof index entry by proof_surface")), true);
});

test("fails when indexed proof surface is missing from repo", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-proof-index-missing-surface-"));

  const indexOnly = canonicalIndexObject();
  writeFile(
    tempRoot,
    "docs/releases/V1_FREEZE_PROOF_INDEX.json",
    JSON.stringify(indexOnly, null, 2) + "\n"
  );

  const result = runNode("ci/scripts/run_freeze_proof_index_verifier.mjs", [
    "--root", tempRoot,
    "--index", "docs/releases/V1_FREEZE_PROOF_INDEX.json"
  ]);

  assert.notEqual(result.status, 0, "expected verifier failure");
  const report = JSON.parse(result.stderr);
  assert.equal(report.failures.some((x) => x.token === "CI_SPINE_MISSING_DOC"), true);
});