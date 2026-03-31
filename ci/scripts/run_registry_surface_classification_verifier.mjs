import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = process.cwd();
const CLASSIFICATION_RELATIVE_PATH = path.join("registries", "registry_surface_classification.json");
const BUNDLE_RELATIVE_PATH = path.join("registries", "registry_bundle.json");
const SEAL_RELATIVE_PATH = path.join("ci", "evidence", "evidence_seal.v1.json");

const ALLOWED_CLASSES = new Set(["launch_critical", "dormant", "excluded"]);
const EXCLUDED_REGISTRY_FILENAMES = new Set([
  "registry_bundle.json",
  "registry_surface_classification.json"
]);

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function failure(token, details, extra = {}) {
  return { token, details, ...extra };
}

function listRegistryFiles(rootDir) {
  const registriesDir = path.join(rootDir, "registries");
  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!entry.name.endsWith(".json")) {
        continue;
      }

      if (EXCLUDED_REGISTRY_FILENAMES.has(entry.name)) {
        continue;
      }

      results.push(fullPath);
    }
  }

  if (fs.existsSync(registriesDir)) {
    walk(registriesDir);
  }

  return results.sort((a, b) =>
    normalizeSlashes(path.relative(rootDir, a)).localeCompare(normalizeSlashes(path.relative(rootDir, b)))
  );
}

function deriveDocumentId(json, filePath) {
  return (
    json?.registry_header?.document_id ??
    json?.document_id ??
    path.basename(filePath, ".json")
  );
}

function deriveBundleRegistryKey(documentId, relativePath) {
  if (documentId === "registry_index") {
    return "registry_index";
  }

  const normalized = normalizeSlashes(relativePath);
  const parts = normalized.split("/");

  if (parts.length >= 3 && parts[0] === "registries") {
    return parts[1];
  }

  return documentId;
}

function collectRepoRegistrySurfaces(rootDir) {
  const files = listRegistryFiles(rootDir);
  const surfaces = [];

  for (const filePath of files) {
    const json = readJson(filePath);
    const documentId = deriveDocumentId(json, filePath);
    const relativePath = normalizeSlashes(path.relative(rootDir, filePath));
    const bundleRegistryKey = deriveBundleRegistryKey(documentId, relativePath);

    surfaces.push({
      document_id: String(documentId),
      relative_path: relativePath,
      file_name: path.basename(filePath),
      bundle_registry_key: bundleRegistryKey
    });
  }

  return surfaces.sort((a, b) => a.document_id.localeCompare(b.document_id));
}

function validateClassification(payload, repoSurfaces) {
  const failures = [];
  const top = payload?.registry_surface_classification;

  if (!top || typeof top !== "object" || Array.isArray(top)) {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        "registry_surface_classification root object is missing or invalid.",
        { path: "registry_surface_classification" }
      )
    );
    return { failures, classificationById: new Map() };
  }

  if (top.version !== "1.0.0") {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        `registry_surface_classification.version must be '1.0.0', got '${String(top.version)}'.`,
        { path: "registry_surface_classification.version" }
      )
    );
  }

  if (top.engine_compatibility !== "EB2-1.0.0") {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        `registry_surface_classification.engine_compatibility must be 'EB2-1.0.0', got '${String(top.engine_compatibility)}'.`,
        { path: "registry_surface_classification.engine_compatibility" }
      )
    );
  }

  if (!Array.isArray(top.classification)) {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        "registry_surface_classification.classification must be an array.",
        { path: "registry_surface_classification.classification" }
      )
    );
    return { failures, classificationById: new Map() };
  }

  const repoById = new Map(repoSurfaces.map((surface) => [surface.document_id, surface]));
  const classificationById = new Map();

  for (let index = 0; index < top.classification.length; index += 1) {
    const entry = top.classification[index];
    const entryPath = `registry_surface_classification.classification[${index}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      failures.push(
        failure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          "Classification entry must be an object.",
          { path: entryPath }
        )
      );
      continue;
    }

    const keys = Object.keys(entry).sort();
    const expectedKeys = ["class", "document_id"];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      failures.push(
        failure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          `Classification entry must contain exactly document_id and class. Got keys: ${keys.join(", ")}.`,
          { path: entryPath }
        )
      );
    }

    const documentId = entry.document_id;
    const klass = entry.class;

    if (typeof documentId !== "string" || documentId.length === 0) {
      failures.push(
        failure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          "document_id must be a non-empty string.",
          { path: `${entryPath}.document_id` }
        )
      );
      continue;
    }

    if (!ALLOWED_CLASSES.has(klass)) {
      failures.push(
        failure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          `class must be one of launch_critical, dormant, excluded. Got '${String(klass)}'.`,
          { path: `${entryPath}.class`, document_id: documentId }
        )
      );
      continue;
    }

    if (classificationById.has(documentId)) {
      failures.push(
        failure(
          "CI_MANIFEST_MISMATCH",
          `Duplicate classification for '${documentId}'.`,
          { path: `${entryPath}.document_id`, document_id: documentId }
        )
      );
      continue;
    }

    classificationById.set(documentId, klass);
  }

  for (const surface of repoSurfaces) {
    if (!classificationById.has(surface.document_id)) {
      failures.push(
        failure(
          "CI_MANIFEST_MISMATCH",
          `Live registry surface '${surface.document_id}' is not classified.`,
          { document_id: surface.document_id, path: surface.relative_path }
        )
      );
    }
  }

  for (const [documentId] of classificationById.entries()) {
    if (!repoById.has(documentId)) {
      failures.push(
        failure(
          "CI_MANIFEST_MISMATCH",
          `Classification references unknown registry '${documentId}'.`,
          { document_id: documentId }
        )
      );
    }
  }

  return { failures, classificationById };
}

function validateBundle(rootDir, repoSurfaces, classificationById) {
  const failures = [];
  const bundlePath = path.join(rootDir, BUNDLE_RELATIVE_PATH);

  if (!fs.existsSync(bundlePath)) {
    failures.push(
      failure(
        "CI_MANIFEST_MISMATCH",
        `Missing registry bundle: ${normalizeSlashes(BUNDLE_RELATIVE_PATH)}`
      )
    );
    return failures;
  }

  const bundle = readJson(bundlePath);
  const registries = bundle?.registries;

  if (!registries || typeof registries !== "object" || Array.isArray(registries)) {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        "registry_bundle.json must contain a top-level object property 'registries'.",
        { path: "registries" }
      )
    );
    return failures;
  }

  const bundleKeys = new Set(Object.keys(registries));

  for (const surface of repoSurfaces) {
    const klass = classificationById.get(surface.document_id);
    if (!klass) {
      continue;
    }

    const inBundle = bundleKeys.has(surface.bundle_registry_key);

    if (klass === "launch_critical" && !inBundle) {
      failures.push(
        failure(
          "CI_MANIFEST_MISMATCH",
          `Launch-critical registry '${surface.document_id}' is not present in registry bundle key '${surface.bundle_registry_key}'.`,
          {
            document_id: surface.document_id,
            path: surface.relative_path,
            bundle_registry_key: surface.bundle_registry_key
          }
        )
      );
    }

    if ((klass === "dormant" || klass === "excluded") && inBundle) {
      failures.push(
        failure(
          "CI_MANIFEST_MISMATCH",
          `${klass === "dormant" ? "Dormant" : "Excluded"} registry '${surface.document_id}' is present in active registry bundle key '${surface.bundle_registry_key}'.`,
          {
            document_id: surface.document_id,
            path: surface.relative_path,
            bundle_registry_key: surface.bundle_registry_key
          }
        )
      );
    }
  }

  return failures;
}

function validateSealPresence(rootDir) {
  const failures = [];
  const sealPath = path.join(rootDir, SEAL_RELATIVE_PATH);

  if (!fs.existsSync(sealPath)) {
    failures.push(
      failure(
        "CI_MANIFEST_MISMATCH",
        `Missing evidence seal artefact: ${normalizeSlashes(SEAL_RELATIVE_PATH)}`
      )
    );
    return failures;
  }

  const seal = readJson(sealPath);

  if (seal?.contract !== "kolosseum:evidence_seal@1") {
    failures.push(
      failure(
        "CI_REGISTRY_STRUCTURE_INVALID",
        `evidence seal contract must be 'kolosseum:evidence_seal@1', got '${String(seal?.contract)}'.`,
        { path: "contract" }
      )
    );
  }

  for (const propertyName of ["envelope_sha256", "seal_sha256"]) {
    const value = seal?.[propertyName];
    if (typeof value !== "string" || !/^[A-Fa-f0-9]{64}$/.test(value)) {
      failures.push(
        failure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          `evidence seal property '${propertyName}' must be a 64-char sha256 hex string.`,
          { path: propertyName }
        )
      );
    }
  }

  return failures;
}

export function verifyRegistrySurfaceClassification(rootDir = DEFAULT_ROOT) {
  const failures = [];
  const classificationPath = path.join(rootDir, CLASSIFICATION_RELATIVE_PATH);

  if (!fs.existsSync(classificationPath)) {
    failures.push(
      failure(
        "CI_MANIFEST_MISMATCH",
        `Missing classification file: ${normalizeSlashes(CLASSIFICATION_RELATIVE_PATH)}`
      )
    );
    return { ok: false, failures };
  }

  const repoSurfaces = collectRepoRegistrySurfaces(rootDir);
  const classificationPayload = readJson(classificationPath);

  const { failures: classificationFailures, classificationById } =
    validateClassification(classificationPayload, repoSurfaces);

  failures.push(...classificationFailures);

  if (classificationFailures.length === 0) {
    failures.push(...validateBundle(rootDir, repoSurfaces, classificationById));
  }

  failures.push(...validateSealPresence(rootDir));

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const report = verifyRegistrySurfaceClassification(DEFAULT_ROOT);
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