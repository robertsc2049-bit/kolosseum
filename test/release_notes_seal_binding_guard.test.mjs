import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { verifyReleaseNotesSealBinding } from "../ci/scripts/run_release_notes_seal_binding_guard.mjs";

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p95-seal-binding-"));
}

test("passes when release notes reference correct seal hash", async () => {
  const root = makeRoot();

  const sealContent = JSON.stringify({ ok: true }, null, 2);
  const hash = crypto.createHash("sha256").update(sealContent).digest("hex");

  write(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), sealContent);
  write(
    path.join(root, "docs", "releases", "V1_RELEASE_NOTES.md"),
    `Registry binding` + "\n" + `registry_seal_manifest.v1.json: ${hash}` + "\n"
  );

  const report = await verifyReleaseNotesSealBinding(root);
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("fails when reference is missing", async () => {
  const root = makeRoot();

  write(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), "{}");
  write(path.join(root, "docs", "releases", "V1_RELEASE_NOTES.md"), "no reference\n");

  const report = await verifyReleaseNotesSealBinding(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /CI_RELEASE_NOTES_SEAL_REFERENCE_MISSING/);
});

test("fails when reference is stale", async () => {
  const root = makeRoot();

  write(path.join(root, "ci", "evidence", "registry_seal_manifest.v1.json"), "{}");
  write(
    path.join(root, "docs", "releases", "V1_RELEASE_NOTES.md"),
    "registry_seal_manifest.v1.json: deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n"
  );

  const report = await verifyReleaseNotesSealBinding(root);
  assert.equal(report.ok, false);
  assert.match(JSON.stringify(report.failures), /CI_RELEASE_NOTES_SEAL_REFERENCE_STALE/);
});