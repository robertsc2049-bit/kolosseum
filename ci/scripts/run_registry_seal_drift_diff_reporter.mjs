import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_SEAL_DRIFT_REPORTER_STRUCTURE_INVALID",
  DRIFT: "CI_REGISTRY_SEAL_DRIFT_DETECTED"
};

const SNAPSHOT_PATH = path.resolve("ci/evidence/registry_seal_snapshot.v1.json");
const LIVE_SURFACE_PATH = path.resolve("ci/evidence/registry_seal_live_surface.v1.json");

function fail(token, details, extras = {}) {
  process.stderr.write(`${JSON.stringify({ ok: false, token, details, ...extras }, null, 2)}\n`);
  process.exit(1);
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

function sha256File(relPath) {
  const resolved = path.resolve(relPath);
  const bytes = fs.readFileSync(resolved);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateLiveSurface(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(TOKEN.STRUCTURE, "Live surface artefact must be a JSON object.");
  }

  const required = [
    "schema_version",
    "surface_id",
    "surface_version",
    "seal_scope",
    "entries"
  ];
  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in doc)) {
      fail(TOKEN.STRUCTURE, `Live surface missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(doc)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `Live surface contains unknown field '${key}'.`, { path: key });
    }
  }

  if (doc.schema_version !== "kolosseum.registry_seal_live_surface.v1") {
    fail(TOKEN.STRUCTURE, "Live surface schema_version mismatch.", { path: "schema_version" });
  }

  if (doc.seal_scope !== "registry_bundle") {
    fail(TOKEN.STRUCTURE, "Live surface seal_scope mismatch.", { path: "seal_scope" });
  }

  if (!Array.isArray(doc.entries)) {
    fail(TOKEN.STRUCTURE, "Live surface entries must be an array.", { path: "entries" });
  }

  const seen = new Set();
  const paths = [];

  for (let i = 0; i < doc.entries.length; i += 1) {
    const entry = doc.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, "Live surface entry must be a JSON object.", { path: basePath });
    }

    const keys = Object.keys(entry);
    if (keys.length !== 1 || keys[0] !== "path") {
      fail(TOKEN.STRUCTURE, "Live surface entry must contain only 'path'.", { path: basePath });
    }

    if (typeof entry.path !== "string" || entry.path.length === 0) {
      fail(TOKEN.STRUCTURE, "Live surface entry path must be a non-empty string.", { path: `${basePath}.path` });
    }

    if (seen.has(entry.path)) {
      fail(TOKEN.STRUCTURE, `Duplicate live surface path '${entry.path}'.`, { path: `${basePath}.path` });
    }

    seen.add(entry.path);
    paths.push(entry.path);
  }

  return paths;
}

function validateSnapshot(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(TOKEN.STRUCTURE, "Snapshot artefact must be a JSON object.");
  }

  const required = [
    "schema_version",
    "snapshot_id",
    "snapshot_version",
    "seal_scope",
    "entries"
  ];
  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in doc)) {
      fail(TOKEN.STRUCTURE, `Snapshot missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(doc)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `Snapshot contains unknown field '${key}'.`, { path: key });
    }
  }

  if (doc.schema_version !== "kolosseum.registry_seal_snapshot.v1") {
    fail(TOKEN.STRUCTURE, "Snapshot schema_version mismatch.", { path: "schema_version" });
  }

  if (doc.seal_scope !== "registry_bundle") {
    fail(TOKEN.STRUCTURE, "Snapshot seal_scope mismatch.", { path: "seal_scope" });
  }

  if (!Array.isArray(doc.entries)) {
    fail(TOKEN.STRUCTURE, "Snapshot entries must be an array.", { path: "entries" });
  }

  const map = new Map();

  for (let i = 0; i < doc.entries.length; i += 1) {
    const entry = doc.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, "Snapshot entry must be a JSON object.", { path: basePath });
    }

    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes("path") || !keys.includes("sha256")) {
      fail(TOKEN.STRUCTURE, "Snapshot entry must contain only 'path' and 'sha256'.", { path: basePath });
    }

    if (typeof entry.path !== "string" || entry.path.length === 0) {
      fail(TOKEN.STRUCTURE, "Snapshot entry path must be a non-empty string.", { path: `${basePath}.path` });
    }

    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail(TOKEN.STRUCTURE, "Snapshot entry sha256 must be a 64-char lowercase hex string.", { path: `${basePath}.sha256` });
    }

    if (map.has(entry.path)) {
      fail(TOKEN.STRUCTURE, `Duplicate snapshot path '${entry.path}'.`, { path: `${basePath}.path` });
    }

    map.set(entry.path, entry.sha256);
  }

  return map;
}

function main() {
  const livePaths = validateLiveSurface(readJson(LIVE_SURFACE_PATH, "registry seal live surface"));
  const snapshotMap = validateSnapshot(readJson(SNAPSHOT_PATH, "registry seal snapshot"));
  const liveSet = new Set(livePaths);

  const modified = [];
  const added = [];
  const removed = [];

  for (const livePath of livePaths) {
    const resolved = path.resolve(livePath);
    const exists = fs.existsSync(resolved);

    if (!snapshotMap.has(livePath)) {
      added.push({
        path: livePath,
        actual_sha256: exists ? sha256File(livePath) : null
      });
      continue;
    }

    if (!exists) {
      removed.push({
        path: livePath,
        expected_sha256: snapshotMap.get(livePath),
        reason: "missing_on_disk"
      });
      continue;
    }

    const actualSha = sha256File(livePath);
    const expectedSha = snapshotMap.get(livePath);

    if (actualSha !== expectedSha) {
      modified.push({
        path: livePath,
        expected_sha256: expectedSha,
        actual_sha256: actualSha
      });
    }
  }

  for (const [snapshotPath, expectedSha] of snapshotMap.entries()) {
    if (!liveSet.has(snapshotPath)) {
      removed.push({
        path: snapshotPath,
        expected_sha256: expectedSha,
        reason: "removed_from_live_surface"
      });
    }
  }

  const offendingFiles = Array.from(
    new Set([
      ...modified.map((item) => item.path),
      ...added.map((item) => item.path),
      ...removed.map((item) => item.path)
    ])
  ).sort();

  if (offendingFiles.length > 0) {
    fail(
      TOKEN.DRIFT,
      "Registry seal drift detected.",
      {
        modified,
        added,
        removed,
        offending_files: offendingFiles
      }
    );
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    checked_file_count: livePaths.length,
    offending_files: []
  }, null, 2)}\n`);
}

main();