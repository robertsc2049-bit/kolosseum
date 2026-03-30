import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function sha256HexFromBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256HexFromString(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function makeSchema() {
  return {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "kolosseum.registry_seal.v1",
    title: "Kolosseum Registry Seal v1",
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "seal_id",
      "seal_version",
      "registry_bundle_hash",
      "created_at",
      "engine_compatibility",
      "enum_bundle_version",
      "seal_scope",
      "signature"
    ],
    properties: {
      schema_version: { const: "kolosseum.registry_seal.v1" },
      seal_id: { type: "string", minLength: 1 },
      seal_version: { type: "string", minLength: 1 },
      registry_bundle_hash: { type: "string", pattern: "^[a-f0-9]{64}$" },
      created_at: { type: "string", format: "date-time" },
      engine_compatibility: { const: "EB2-1.0.0" },
      enum_bundle_version: { const: "EB2-1.0.0" },
      seal_scope: { const: "registry_bundle" },
      signature: { type: "string", pattern: "^[a-f0-9]{64}$" }
    }
  };
}

function buildSeal(bundleBytes, overrides = {}) {
  const base = {
    schema_version: "kolosseum.registry_seal.v1",
    seal_id: "launch_registry_seal",
    seal_version: "1.0.0",
    registry_bundle_hash: sha256HexFromBuffer(bundleBytes),
    created_at: "2026-03-30T12:00:00.000Z",
    engine_compatibility: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    seal_scope: "registry_bundle"
  };

  const unsigned = {
    ...base,
    ...overrides
  };

  const signature = sha256HexFromString(canonicalize(unsigned));
  return {
    ...unsigned,
    signature
  };
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
}

function setupFixture() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "registry-seal-verifier-"));
  const schemaPath = path.join(tempRoot, "ci", "schemas", "registry_seal.v1.schema.json");
  const bundlePath = path.join(tempRoot, "registries", "registry_bundle.json");
  const sealPath = path.join(tempRoot, "ci", "evidence", "registry_seal.v1.json");
  const scriptPath = path.resolve("ci", "scripts", "run_registry_seal_verifier.mjs");

  const bundleObject = {
    registry_bundle_version: "1.0.0",
    registries: [
      { registry_id: "activity_registry_1", version: "1.0.0" },
      { registry_id: "exercise_registry_3a", version: "1.0.0" }
    ]
  };

  const bundleBytes = Buffer.from(JSON.stringify(bundleObject, null, 2), "utf8");
  const seal = buildSeal(bundleBytes);

  writeUtf8(schemaPath, JSON.stringify(makeSchema(), null, 2));
  fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
  fs.writeFileSync(bundlePath, bundleBytes);
  writeUtf8(sealPath, JSON.stringify(seal, null, 2));

  return {
    tempRoot,
    scriptPath,
    schemaPath,
    bundlePath,
    sealPath,
    bundleBytes,
    seal
  };
}

function runVerifier(args, cwd) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
}

test("P81: verifier passes for matching bundle hash, seal_id, seal_version, and signature", () => {
  const fx = setupFixture();

  const result = runVerifier(
    [
      fx.scriptPath,
      "--schema", fx.schemaPath,
      "--bundle", fx.bundlePath,
      "--seal", fx.sealPath,
      "--expected-seal-id", "launch_registry_seal",
      "--expected-seal-version", "1.0.0"
    ],
    fx.tempRoot
  );

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.seal_id, "launch_registry_seal");
  assert.equal(payload.seal_version, "1.0.0");
});

test("P81: version mismatch fails when explicit expected seal version differs", () => {
  const fx = setupFixture();

  const result = runVerifier(
    [
      fx.scriptPath,
      "--schema", fx.schemaPath,
      "--bundle", fx.bundlePath,
      "--seal", fx.sealPath,
      "--expected-seal-version", "2.0.0"
    ],
    fx.tempRoot
  );

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_VERSION_MISMATCH");
});

test("P81: bundle hash mismatch fails", () => {
  const fx = setupFixture();

  const tamperedBundleObject = {
    registry_bundle_version: "1.0.1",
    registries: [
      { registry_id: "activity_registry_1", version: "1.0.0" },
      { registry_id: "exercise_registry_3a", version: "1.0.1" }
    ]
  };

  fs.writeFileSync(
    fx.bundlePath,
    Buffer.from(JSON.stringify(tamperedBundleObject, null, 2), "utf8")
  );

  const result = runVerifier(
    [
      fx.scriptPath,
      "--schema", fx.schemaPath,
      "--bundle", fx.bundlePath,
      "--seal", fx.sealPath
    ],
    fx.tempRoot
  );

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_HASH_MISMATCH");
});

test("P81: signature tamper fails", () => {
  const fx = setupFixture();
  const seal = JSON.parse(fs.readFileSync(fx.sealPath, "utf8"));
  seal.signature = "0".repeat(64);
  writeUtf8(fx.sealPath, JSON.stringify(seal, null, 2));

  const result = runVerifier(
    [
      fx.scriptPath,
      "--schema", fx.schemaPath,
      "--bundle", fx.bundlePath,
      "--seal", fx.sealPath
    ],
    fx.tempRoot
  );

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_SIGNATURE_INVALID");
});

test("P81: same seal_id and same seal_version cannot bind to a different bundle hash", () => {
  const fx = setupFixture();
  const compareSealPath = path.join(fx.tempRoot, "ci", "evidence", "registry_seal.compare.v1.json");

  const differentBundleBytes = Buffer.from(
    JSON.stringify(
      {
        registry_bundle_version: "1.0.0",
        registries: [
          { registry_id: "activity_registry_1", version: "1.0.0" },
          { registry_id: "exercise_registry_3a", version: "9.9.9" }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const collidingSeal = buildSeal(differentBundleBytes, {
    seal_id: "launch_registry_seal",
    seal_version: "1.0.0"
  });

  writeUtf8(compareSealPath, JSON.stringify(collidingSeal, null, 2));

  const result = runVerifier(
    [
      fx.scriptPath,
      "--schema", fx.schemaPath,
      "--bundle", fx.bundlePath,
      "--seal", fx.sealPath,
      "--compare-seal", compareSealPath
    ],
    fx.tempRoot
  );

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stderr);
  assert.equal(payload.token, "CI_REGISTRY_SEAL_ID_COLLISION");
});