import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyFreezeSafePackagingComposition } from "../ci/scripts/run_freeze_safe_packaging_composition_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function runCase(t, expectedDoc, actualDoc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p109-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const expectedPath = writeJson(dir, "expected.json", expectedDoc);
  const actualPath = writeJson(dir, "actual.json", actualDoc);

  return verifyFreezeSafePackagingComposition({
    expectedPath,
    actualPath,
  });
}

test("passes when packaging output matches required freeze artefacts exactly", (t) => {
  const expected = {
    schema_version: "kolosseum.freeze_packaging_artefact_set.v1",
    freeze_packaging_required_surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
      "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"
    ]
  };

  const actual = {
    schema_version: "kolosseum.packaging_evidence_manifest.v1",
    surfaces: [
      "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json"
    ]
  };

  const result = runCase(t, expected, actual);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.freeze_packaging_surfaces,
    [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
      "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"
    ]
  );
});

test("fails when required freeze artefact is missing from packaging output", (t) => {
  const expected = {
    freeze_packaging_required_surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
      "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"
    ]
  };

  const actual = {
    surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json"
    ]
  };

  const result = runCase(t, expected, actual);
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_PACKAGING_COMPOSITION_INVALID");
  assert.match(result.failures[0].details, /missing required freeze artefact/i);
  assert.deepEqual(result.failures[0].missing_freeze_artefacts, ["docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"]);
});

test("fails when packaging output contains illegal extra freeze artefact", (t) => {
  const expected = {
    freeze_packaging_required_surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json"
    ]
  };

  const actual = {
    surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
      "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"
    ]
  };

  const result = runCase(t, expected, actual);
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_PACKAGING_COMPOSITION_INVALID");
  assert.match(result.failures[0].details, /illegal extra freeze artefact/i);
  assert.deepEqual(result.failures[0].extra_freeze_artefacts, ["docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json"]);
});

test("fails when expected artefact set is empty", (t) => {
  const expected = {
    freeze_packaging_required_surfaces: []
  };

  const actual = {
    surfaces: [
      "docs/releases/V1_FREEZE_ARTEFACT_SET.json"
    ]
  };

  const result = runCase(t, expected, actual);
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_PACKAGING_COMPOSITION_INVALID");
  assert.match(result.failures[0].details, /must declare at least one required freeze artefact/i);
});

test("passes against repo artefact set and matching synthetic packaging manifest", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p109-repo-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const expectedPath = path.resolve("docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json");
  const expectedDoc = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

  const actualPath = writeJson(dir, "actual.json", {
    schema_version: "kolosseum.packaging_evidence_manifest.v1",
    surfaces: expectedDoc.freeze_packaging_required_surfaces
  });

  const result = verifyFreezeSafePackagingComposition({
    expectedPath,
    actualPath,
  });

  assert.equal(result.ok, true);
});