import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  verifyFreezeEvidencePackIndexCompleteness,
  REQUIRED_REVIEW_SURFACES
} from "../ci/scripts/run_freeze_evidence_pack_index_completeness_verifier.mjs";

function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return fullPath;
}

function writeText(root, relativePath, content = "ok\n") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
  return fullPath;
}

function materializeRequiredSurfaces(root) {
  for (const surface of REQUIRED_REVIEW_SURFACES) {
    if (surface.path.endsWith(".md")) {
      writeText(root, surface.path, "# Freeze runbook\n");
      continue;
    }

    writeJson(root, surface.path, {
      ok: true,
      verifier_id: `${surface.id}_verifier`,
      checked_at_utc: "2026-04-03T00:00:00.000Z",
      failures: []
    });
  }
}

function makeIndex(reviewSurfaces) {
  return {
    ok: true,
    verifier_id: "freeze_evidence_pack_index",
    checked_at_utc: "2026-04-03T00:00:00.000Z",
    invariant: "human freeze review must be possible from one declared evidence pack index without repo spelunking",
    review_pack_id: "v1_freeze_evidence_pack",
    review_surfaces: reviewSurfaces,
    failures: []
  };
}

test("passes when declared index exists and covers all required human-review freeze surfaces", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-evidence-pack-pass-"));
  materializeRequiredSurfaces(tempRoot);

  const indexPath = writeJson(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json",
    makeIndex(REQUIRED_REVIEW_SURFACES)
  );

  const result = verifyFreezeEvidencePackIndexCompleteness({
    root: tempRoot,
    inputPath: path.relative(tempRoot, indexPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, true);
  assert.equal(result.review_surface_count, REQUIRED_REVIEW_SURFACES.length);
});

test("fails when a required review surface is missing from the declared index", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-evidence-pack-missing-"));
  materializeRequiredSurfaces(tempRoot);

  const reduced = REQUIRED_REVIEW_SURFACES.filter(
    (entry) => entry.path !== "docs/releases/V1_PROMOTION_READINESS.json"
  );

  const indexPath = writeJson(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json",
    makeIndex(reduced)
  );

  const result = verifyFreezeEvidencePackIndexCompleteness({
    root: tempRoot,
    inputPath: path.relative(tempRoot, indexPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].missing_required_paths.includes("docs/releases/V1_PROMOTION_READINESS.json"), true);
});

test("fails when an orphan review surface is indexed", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-evidence-pack-orphan-"));
  materializeRequiredSurfaces(tempRoot);
  writeJson(tempRoot, "docs/releases/V1_EXTRA_FREEZE_NOTE.json", {
    ok: true,
    verifier_id: "extra_note",
    checked_at_utc: "2026-04-03T00:00:00.000Z",
    failures: []
  });

  const withOrphan = [
    ...REQUIRED_REVIEW_SURFACES,
    {
      id: "extra_note",
      path: "docs/releases/V1_EXTRA_FREEZE_NOTE.json",
      role: "extra"
    }
  ];

  const indexPath = writeJson(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json",
    makeIndex(withOrphan)
  );

  const result = verifyFreezeEvidencePackIndexCompleteness({
    root: tempRoot,
    inputPath: path.relative(tempRoot, indexPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_MANIFEST_MISMATCH");
  assert.equal(result.failures[0].orphan_indexed_paths.includes("docs/releases/V1_EXTRA_FREEZE_NOTE.json"), true);
});

test("fails when an indexed file does not exist", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-evidence-pack-stale-"));
  materializeRequiredSurfaces(tempRoot);

  const indexPath = writeJson(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json",
    makeIndex(REQUIRED_REVIEW_SURFACES)
  );

  fs.unlinkSync(path.join(tempRoot, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"));

  const result = verifyFreezeEvidencePackIndexCompleteness({
    root: tempRoot,
    inputPath: path.relative(tempRoot, indexPath).replace(/\\/g, "/")
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_SPINE_MISSING_DOC");
});

test("emits JSON-safe success shape", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-evidence-pack-shape-"));
  materializeRequiredSurfaces(tempRoot);

  const indexPath = writeJson(
    tempRoot,
    "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json",
    makeIndex(REQUIRED_REVIEW_SURFACES)
  );

  const result = verifyFreezeEvidencePackIndexCompleteness({
    root: tempRoot,
    inputPath: path.relative(tempRoot, indexPath).replace(/\\/g, "/")
  });

  const serialised = JSON.parse(JSON.stringify(result));

  assert.deepEqual(Object.keys(serialised).sort(), [
    "checked_at_utc",
    "input_path",
    "ok",
    "required_review_surfaces",
    "review_surface_count",
    "verifier_id"
  ]);

  assert.equal(serialised.ok, true);
});
