import fs from "node:fs";
import path from "node:path";

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_STRUCTURE_INVALID",
  DUPLICATE: "CI_REGISTRY_SEAL_SCOPE_DUPLICATE",
  UNLISTED_LIVE: "CI_REGISTRY_SEAL_SCOPE_UNLISTED_LIVE_FILE",
  STALE_MANIFEST: "CI_REGISTRY_SEAL_SCOPE_STALE_MANIFEST_ENTRY"
};

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

function validatePathListDocument(doc, expectedSchemaVersion, label) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(TOKEN.STRUCTURE, `${label} must be a JSON object.`);
  }

  const required = label === "manifest"
    ? ["schema_version", "manifest_id", "manifest_version", "seal_scope", "entries"]
    : ["schema_version", "surface_id", "surface_version", "seal_scope", "entries"];

  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in doc)) {
      fail(TOKEN.STRUCTURE, `${label} missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(doc)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `${label} contains unknown field '${key}'.`, { path: key });
    }
  }

  if (doc.schema_version !== expectedSchemaVersion) {
    fail(TOKEN.STRUCTURE, `${label} schema_version mismatch.`, { path: "schema_version" });
  }

  if (doc.seal_scope !== "registry_bundle") {
    fail(TOKEN.STRUCTURE, `${label} seal_scope mismatch.`, { path: "seal_scope" });
  }

  if (!Array.isArray(doc.entries)) {
    fail(TOKEN.STRUCTURE, `${label} entries must be an array.`, { path: "entries" });
  }

  const seen = new Set();

  for (let i = 0; i < doc.entries.length; i += 1) {
    const entry = doc.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, `${label} entry must be a JSON object.`, { path: basePath });
    }

    const keys = Object.keys(entry);
    if (keys.length !== 1 || keys[0] !== "path") {
      fail(TOKEN.STRUCTURE, `${label} entry must contain only 'path'.`, { path: basePath });
    }

    if (typeof entry.path !== "string" || entry.path.length === 0) {
      fail(TOKEN.STRUCTURE, `${label} entry path must be a non-empty string.`, { path: `${basePath}.path` });
    }

    if (seen.has(entry.path)) {
      fail(TOKEN.DUPLICATE, `Duplicate ${label} path '${entry.path}'.`, { path: `${basePath}.path` });
    }

    seen.add(entry.path);
  }

  return seen;
}

function main() {
  const manifestPath = path.resolve("ci/evidence/registry_seal_manifest.v1.json");
  const liveSurfacePath = path.resolve("ci/evidence/registry_seal_live_surface.v1.json");

  const manifest = readJson(manifestPath, "manifest");
  const liveSurface = readJson(liveSurfacePath, "live surface");

  const manifestSet = validatePathListDocument(
    manifest,
    "kolosseum.registry_seal_manifest.v1",
    "manifest"
  );

  const liveSet = validatePathListDocument(
    liveSurface,
    "kolosseum.registry_seal_live_surface.v1",
    "live surface"
  );

  for (const livePath of liveSet) {
    if (!manifestSet.has(livePath)) {
      fail(
        TOKEN.UNLISTED_LIVE,
        `Live launch registry surface file '${livePath}' is not listed in seal manifest.`,
        { live_path: livePath }
      );
    }

    const resolved = path.resolve(livePath);
    if (!fs.existsSync(resolved)) {
      fail(
        TOKEN.UNLISTED_LIVE,
        `Live launch registry surface file '${livePath}' does not exist on disk.`,
        { live_path: livePath }
      );
    }
  }

  for (const manifestPathEntry of manifestSet) {
    if (!liveSet.has(manifestPathEntry)) {
      fail(
        TOKEN.STALE_MANIFEST,
        `Manifest path '${manifestPathEntry}' is stale and not part of live launch registry surface.`,
        { manifest_path: manifestPathEntry }
      );
    }
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    manifest_entry_count: manifest.entries.length,
    live_surface_entry_count: liveSurface.entries.length
  }, null, 2)}\n`);
}

main();