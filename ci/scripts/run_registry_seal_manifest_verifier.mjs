import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_STRUCTURE_INVALID",
  DUPLICATE: "CI_REGISTRY_SEAL_MANIFEST_DUPLICATE",
  MISSING: "CI_REGISTRY_SEAL_MANIFEST_MISSING_ENTRY",
  EXTRA: "CI_REGISTRY_SEAL_MANIFEST_EXTRA_FILE",
  HASH_MISMATCH: "CI_REGISTRY_SEAL_MANIFEST_HASH_MISMATCH"
};

function fail(token, details, extras = {}) {
  process.stderr.write(`${JSON.stringify({ ok: false, token, details, ...extras }, null, 2)}\n`);
  process.exit(1);
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(TOKEN.STRUCTURE, `Unable to read ${label} at '${filePath}': ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(TOKEN.STRUCTURE, `Invalid JSON in ${label} at '${filePath}': ${error.message}`);
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail(TOKEN.STRUCTURE, "Manifest must be a JSON object.");
  }

  const required = ["schema_version", "manifest_id", "manifest_version", "seal_scope", "entries"];
  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in manifest)) {
      fail(TOKEN.STRUCTURE, `Manifest missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `Manifest contains unknown field '${key}'.`, { path: key });
    }
  }

  if (manifest.schema_version !== "kolosseum.registry_seal_manifest.v1") {
    fail(TOKEN.STRUCTURE, "Manifest schema_version mismatch.", { path: "schema_version" });
  }

  if (manifest.seal_scope !== "registry_bundle") {
    fail(TOKEN.STRUCTURE, "Manifest seal_scope mismatch.", { path: "seal_scope" });
  }

  if (typeof manifest.manifest_id !== "string" || manifest.manifest_id.length === 0) {
    fail(TOKEN.STRUCTURE, "manifest_id must be a non-empty string.", { path: "manifest_id" });
  }

  if (typeof manifest.manifest_version !== "string" || manifest.manifest_version.length === 0) {
    fail(TOKEN.STRUCTURE, "manifest_version must be a non-empty string.", { path: "manifest_version" });
  }

  if (!Array.isArray(manifest.entries)) {
    fail(TOKEN.STRUCTURE, "Manifest entries must be an array.", { path: "entries" });
  }

  const seen = new Set();

  for (let i = 0; i < manifest.entries.length; i += 1) {
    const entry = manifest.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, "Manifest entry must be a JSON object.", { path: basePath });
    }

    const entryKeys = Object.keys(entry);
    if (entryKeys.length !== 1 || entryKeys[0] !== "path") {
      fail(TOKEN.STRUCTURE, "Manifest entry must contain only 'path'.", { path: basePath });
    }

    if (typeof entry.path !== "string" || entry.path.length === 0) {
      fail(TOKEN.STRUCTURE, "Manifest entry path must be a non-empty string.", { path: `${basePath}.path` });
    }

    if (seen.has(entry.path)) {
      fail(TOKEN.DUPLICATE, `Duplicate manifest path '${entry.path}'.`, { path: `${basePath}.path` });
    }

    seen.add(entry.path);

    const resolved = path.resolve(entry.path);
    if (!fs.existsSync(resolved)) {
      fail(TOKEN.MISSING, `Manifest declares missing file '${entry.path}'.`, { path: `${basePath}.path` });
    }
  }
}

function validateSnapshot(snapshot, manifest) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    fail(TOKEN.STRUCTURE, "Snapshot must be a JSON object.");
  }

  const required = ["schema_version", "manifest_id", "manifest_version", "seal_scope", "entries"];
  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in snapshot)) {
      fail(TOKEN.STRUCTURE, `Snapshot missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(snapshot)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `Snapshot contains unknown field '${key}'.`, { path: key });
    }
  }

  if (snapshot.schema_version !== "kolosseum.registry_seal_snapshot.v1") {
    fail(TOKEN.STRUCTURE, "Snapshot schema_version mismatch.", { path: "schema_version" });
  }

  if (snapshot.manifest_id !== manifest.manifest_id) {
    fail(TOKEN.STRUCTURE, "Snapshot manifest_id mismatch.", { path: "manifest_id" });
  }

  if (snapshot.manifest_version !== manifest.manifest_version) {
    fail(TOKEN.STRUCTURE, "Snapshot manifest_version mismatch.", { path: "manifest_version" });
  }

  if (snapshot.seal_scope !== manifest.seal_scope) {
    fail(TOKEN.STRUCTURE, "Snapshot seal_scope mismatch.", { path: "seal_scope" });
  }

  if (!Array.isArray(snapshot.entries)) {
    fail(TOKEN.STRUCTURE, "Snapshot entries must be an array.", { path: "entries" });
  }
}

function computeExpectedSnapshotEntries(manifest) {
  return manifest.entries.map((entry) => {
    const bytes = fs.readFileSync(path.resolve(entry.path));
    return {
      path: entry.path,
      sha256: sha256Hex(bytes)
    };
  });
}

function main() {
  const manifestPath = path.resolve("ci/evidence/registry_seal_manifest.v1.json");
  const snapshotPath = path.resolve("ci/evidence/registry_seal_snapshot.v1.json");

  const manifest = readJson(manifestPath, "manifest");
  validateManifest(manifest);

  const snapshot = readJson(snapshotPath, "snapshot");
  validateSnapshot(snapshot, manifest);

  const expectedEntries = computeExpectedSnapshotEntries(manifest);

  if (snapshot.entries.length !== expectedEntries.length) {
    if (snapshot.entries.length > expectedEntries.length) {
      fail(TOKEN.EXTRA, "Snapshot contains extra sealed file(s) outside manifest.");
    }
    fail(TOKEN.MISSING, "Snapshot is missing declared manifest file(s).");
  }

  for (let i = 0; i < expectedEntries.length; i += 1) {
    const expected = expectedEntries[i];
    const actual = snapshot.entries[i];
    const basePath = `entries[${i}]`;

    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      fail(TOKEN.STRUCTURE, "Snapshot entry must be a JSON object.", { path: basePath });
    }

    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = ["path", "sha256"];

    if (actualKeys.length !== expectedKeys.length || actualKeys.join("|") !== expectedKeys.join("|")) {
      fail(TOKEN.STRUCTURE, "Snapshot entry must contain only 'path' and 'sha256'.", { path: basePath });
    }

    if (actual.path !== expected.path) {
      if (manifest.entries.some((entry) => entry.path === actual.path)) {
        fail(TOKEN.HASH_MISMATCH, `Snapshot order/path mismatch at index ${i}.`, {
          path: `${basePath}.path`,
          expected_path: expected.path,
          actual_path: actual.path
        });
      }

      fail(TOKEN.EXTRA, `Snapshot contains undeclared sealed file '${actual.path}'.`, {
        path: `${basePath}.path`,
        expected_path: expected.path,
        actual_path: actual.path
      });
    }

    if (typeof actual.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(actual.sha256)) {
      fail(TOKEN.STRUCTURE, "Snapshot sha256 must be lowercase sha256 hex.", { path: `${basePath}.sha256` });
    }

    if (actual.sha256 !== expected.sha256) {
      fail(TOKEN.HASH_MISMATCH, `Snapshot hash mismatch for '${actual.path}'.`, {
        path: `${basePath}.sha256`,
        expected_sha256: expected.sha256,
        actual_sha256: actual.sha256
      });
    }
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    manifest_id: manifest.manifest_id,
    manifest_version: manifest.manifest_version,
    entry_count: expectedEntries.length
  }, null, 2)}\n`);
}

main();