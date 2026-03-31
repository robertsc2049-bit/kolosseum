import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = process.cwd();
const CLASSIFICATION_RELATIVE_PATH = path.join("registries", "registry_surface_classification.json");
const LIVE_SURFACE_RELATIVE_PATH = path.join("ci", "evidence", "registry_seal_live_surface.v1.json");
const MANIFEST_RELATIVE_PATH = path.join("ci", "evidence", "registry_seal_manifest.v1.json");

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_DORMANT_EXCLUSION_STRUCTURE_INVALID",
  DORMANT_PRESENT: "CI_REGISTRY_DORMANT_EXCLUSION_DORMANT_PRESENT",
  ACTIVE_MISSING: "CI_REGISTRY_DORMANT_EXCLUSION_ACTIVE_MISSING",
  LIVE_MANIFEST_DRIFT: "CI_REGISTRY_DORMANT_EXCLUSION_LIVE_MANIFEST_DRIFT",
  UNKNOWN_PRESENT: "CI_REGISTRY_DORMANT_EXCLUSION_UNKNOWN_PRESENT"
};

const ALLOWED_CLASSES = new Set(["launch_critical", "dormant", "excluded"]);

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing at ${normalizeSlashes(filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(failures, token, details, extra = {}) {
  failures.push({ token, details, ...extra });
}

function deriveDocumentIdFromFile(rootDir, relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const json = readJson(fullPath, `registry file '${relativePath}'`);
  return String(
    json?.registry_header?.document_id ??
    json?.document_id ??
    path.basename(relativePath, ".json")
  );
}

function loadClassification(rootDir, failures) {
  const classificationPath = path.join(rootDir, CLASSIFICATION_RELATIVE_PATH);
  const payload = readJson(classificationPath, "registry surface classification");
  const top = payload?.registry_surface_classification;

  if (!top || typeof top !== "object" || Array.isArray(top)) {
    fail(failures, TOKEN.STRUCTURE, "registry_surface_classification root object is missing or invalid.", {
      path: "registry_surface_classification"
    });
    return new Map();
  }

  if (top.version !== "1.0.0") {
    fail(failures, TOKEN.STRUCTURE, `registry_surface_classification.version must be '1.0.0', got '${String(top.version)}'.`, {
      path: "registry_surface_classification.version"
    });
  }

  if (top.engine_compatibility !== "EB2-1.0.0") {
    fail(
      failures,
      TOKEN.STRUCTURE,
      `registry_surface_classification.engine_compatibility must be 'EB2-1.0.0', got '${String(top.engine_compatibility)}'.`,
      { path: "registry_surface_classification.engine_compatibility" }
    );
  }

  if (!Array.isArray(top.classification)) {
    fail(failures, TOKEN.STRUCTURE, "registry_surface_classification.classification must be an array.", {
      path: "registry_surface_classification.classification"
    });
    return new Map();
  }

  const map = new Map();

  for (let index = 0; index < top.classification.length; index += 1) {
    const entry = top.classification[index];
    const entryPath = `registry_surface_classification.classification[${index}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(failures, TOKEN.STRUCTURE, "Classification entry must be an object.", { path: entryPath });
      continue;
    }

    const keys = Object.keys(entry).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["class", "document_id"])) {
      fail(
        failures,
        TOKEN.STRUCTURE,
        `Classification entry must contain exactly document_id and class. Got keys: ${keys.join(", ")}.`,
        { path: entryPath }
      );
    }

    const documentId = entry.document_id;
    const klass = entry.class;

    if (typeof documentId !== "string" || documentId.length === 0) {
      fail(failures, TOKEN.STRUCTURE, "document_id must be a non-empty string.", {
        path: `${entryPath}.document_id`
      });
      continue;
    }

    if (!ALLOWED_CLASSES.has(klass)) {
      fail(
        failures,
        TOKEN.STRUCTURE,
        `class must be one of launch_critical, dormant, excluded. Got '${String(klass)}'.`,
        { path: `${entryPath}.class`, document_id: documentId }
      );
      continue;
    }

    if (map.has(documentId)) {
      fail(failures, TOKEN.STRUCTURE, `Duplicate classification for '${documentId}'.`, {
        path: `${entryPath}.document_id`,
        document_id: documentId
      });
      continue;
    }

    map.set(documentId, klass);
  }

  return map;
}

function loadPathSet(rootDir, relativePath, expectedSchemaVersion, idField, label, failures) {
  const docPath = path.join(rootDir, relativePath);
  const doc = readJson(docPath, label);

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(failures, TOKEN.STRUCTURE, `${label} must be a JSON object.`);
    return new Set();
  }

  const required = ["schema_version", idField, `${idField.replace(/_id$/, "_version")}`, "seal_scope", "entries"];
  for (const key of required) {
    if (!(key in doc)) {
      fail(failures, TOKEN.STRUCTURE, `${label} missing required field '${key}'.`, { path: key });
    }
  }

  if (doc.schema_version !== expectedSchemaVersion) {
    fail(failures, TOKEN.STRUCTURE, `${label} schema_version mismatch.`, { path: "schema_version" });
  }

  if (doc.seal_scope !== "registry_bundle") {
    fail(failures, TOKEN.STRUCTURE, `${label} seal_scope mismatch.`, { path: "seal_scope" });
  }

  if (!Array.isArray(doc.entries)) {
    fail(failures, TOKEN.STRUCTURE, `${label} entries must be an array.`, { path: "entries" });
    return new Set();
  }

  const set = new Set();

  for (let i = 0; i < doc.entries.length; i += 1) {
    const entry = doc.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(failures, TOKEN.STRUCTURE, `${label} entry must be a JSON object.`, { path: basePath });
      continue;
    }

    const keys = Object.keys(entry).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["path"])) {
      fail(failures, TOKEN.STRUCTURE, `${label} entry must contain only 'path'.`, { path: basePath });
    }

    if (typeof entry.path !== "string" || entry.path.length === 0) {
      fail(failures, TOKEN.STRUCTURE, `${label} entry path must be a non-empty string.`, { path: `${basePath}.path` });
      continue;
    }

    const normalized = normalizeSlashes(entry.path);
    if (set.has(normalized)) {
      fail(failures, TOKEN.STRUCTURE, `Duplicate ${label} path '${normalized}'.`, { path: `${basePath}.path` });
      continue;
    }

    set.add(normalized);
  }

  return set;
}

export function verifyDormantRegistryExclusionGuard(rootDir = DEFAULT_ROOT) {
  const failures = [];

  const classificationById = loadClassification(rootDir, failures);
  const livePaths = loadPathSet(
    rootDir,
    LIVE_SURFACE_RELATIVE_PATH,
    "kolosseum.registry_seal_live_surface.v1",
    "surface_id",
    "live surface",
    failures
  );
  const manifestPaths = loadPathSet(
    rootDir,
    MANIFEST_RELATIVE_PATH,
    "kolosseum.registry_seal_manifest.v1",
    "manifest_id",
    "manifest",
    failures
  );

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  if (livePaths.size !== manifestPaths.size) {
    fail(
      failures,
      TOKEN.LIVE_MANIFEST_DRIFT,
      "Live surface and manifest have different entry counts.",
      { live_count: livePaths.size, manifest_count: manifestPaths.size }
    );
  }

  for (const livePath of livePaths) {
    if (!manifestPaths.has(livePath)) {
      fail(
        failures,
        TOKEN.LIVE_MANIFEST_DRIFT,
        `Live surface path '${livePath}' is not present in manifest.`,
        { live_path: livePath }
      );
    }
  }

  for (const manifestPath of manifestPaths) {
    if (!livePaths.has(manifestPath)) {
      fail(
        failures,
        TOKEN.LIVE_MANIFEST_DRIFT,
        `Manifest path '${manifestPath}' is not present in live surface.`,
        { manifest_path: manifestPath }
      );
    }
  }

  const scopeByDocumentId = new Map();
  for (const scopePath of livePaths) {
    const documentId = deriveDocumentIdFromFile(rootDir, scopePath);
    scopeByDocumentId.set(documentId, scopePath);
  }

  for (const [documentId, klass] of classificationById.entries()) {
    const presentPath = scopeByDocumentId.get(documentId);
    const present = typeof presentPath === "string";

    if (klass === "launch_critical" && !present) {
      fail(
        failures,
        TOKEN.ACTIVE_MISSING,
        `Launch-critical registry surface '${documentId}' is missing from exact seal scope.`,
        { document_id: documentId }
      );
    }

    if ((klass === "dormant" || klass === "excluded") && present) {
      fail(
        failures,
        TOKEN.DORMANT_PRESENT,
        `${klass === "dormant" ? "Dormant" : "Excluded"} registry surface '${documentId}' is present in exact seal scope.`,
        { document_id: documentId, path: presentPath }
      );
    }
  }

  for (const [documentId, presentPath] of scopeByDocumentId.entries()) {
    if (!classificationById.has(documentId)) {
      fail(
        failures,
        TOKEN.UNKNOWN_PRESENT,
        `Exact seal scope contains unclassified registry surface '${documentId}'.`,
        { document_id: documentId, path: presentPath }
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const report = verifyDormantRegistryExclusionGuard(DEFAULT_ROOT);
  if (!report.ok) {
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main();
}