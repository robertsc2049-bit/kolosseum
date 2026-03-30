import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const manifestPath = path.resolve("ci/evidence/registry_seal_manifest.v1.json");
const snapshotPath = path.resolve("ci/evidence/registry_seal_snapshot.v1.json");

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    process.stderr.write(JSON.stringify({
      ok: false,
      token: "CI_REGISTRY_STRUCTURE_INVALID",
      details: `Unable to read ${label} at '${filePath}': ${error.message}`
    }, null, 2) + "\n");
    process.exit(1);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(JSON.stringify({
      ok: false,
      token: "CI_REGISTRY_STRUCTURE_INVALID",
      details: `Invalid JSON in ${label} at '${filePath}': ${error.message}`
    }, null, 2) + "\n");
    process.exit(1);
  }
}

const manifest = readJson(manifestPath, "manifest");

const snapshot = {
  schema_version: "kolosseum.registry_seal_snapshot.v1",
  manifest_id: manifest.manifest_id,
  manifest_version: manifest.manifest_version,
  seal_scope: manifest.seal_scope,
  entries: manifest.entries.map((entry) => {
    const filePath = path.resolve(entry.path);
    const bytes = fs.readFileSync(filePath);
    return {
      path: entry.path,
      sha256: sha256Hex(bytes)
    };
  })
};

fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify({
  ok: true,
  snapshot_path: "ci/evidence/registry_seal_snapshot.v1.json",
  entry_count: snapshot.entries.length
}, null, 2) + "\n");