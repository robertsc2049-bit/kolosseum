import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_REGISTRY_PATH = 'docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json';
const DEFAULT_SURFACE_ROOT = 'docs/releases';
const CANONICAL_SURFACE_ROOT = 'docs/releases';
const REGISTRY_BASENAME = 'V1_EVIDENCE_SURFACE_REGISTRY.json';
const REGISTRY_CANONICAL_PATH = `${CANONICAL_SURFACE_ROOT}/${REGISTRY_BASENAME}`;

function fail(message) {
  console.error(`evidence_surface: FAIL - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: evidence_surface (${message})`);
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${path.relative(process.cwd(), absPath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function toPosixRelative(relPath) {
  return relPath.split(path.sep).join(path.posix.sep);
}

function isEvidenceSurface(relPath) {
  const base = path.posix.basename(relPath);
  return (
    /^V1_.*EVIDENCE.*\.(md|json)$/.test(base) ||
    base === 'V1_ARTEFACT_MANIFEST.json'
  );
}

function toCanonicalSurfacePath(fileName) {
  return `${CANONICAL_SURFACE_ROOT}/${fileName}`;
}

function listEvidenceSurfaces(surfaceRootAbs) {
  if (!fs.existsSync(surfaceRootAbs)) {
    fail(`missing evidence surface root: ${path.relative(process.cwd(), surfaceRootAbs)}`);
  }

  return fs.readdirSync(surfaceRootAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => toCanonicalSurfacePath(entry.name))
    .filter((relPath) => relPath !== REGISTRY_CANONICAL_PATH)
    .filter((relPath) => isEvidenceSurface(relPath))
    .sort();
}

function readRegistry(registryAbsPath, registryRelPath) {
  if (!fs.existsSync(registryAbsPath)) {
    fail(`missing evidence surface registry: ${registryRelPath}`);
  }

  const parsed = readJson(registryAbsPath);

  if (parsed?.name !== 'v1_evidence_surface_registry') {
    fail('registry name must be "v1_evidence_surface_registry"');
  }

  if (!Array.isArray(parsed?.surfaces) || parsed.surfaces.length === 0) {
    fail('surfaces must be a non-empty array');
  }

  const normalized = parsed.surfaces.map((value) => {
    if (typeof value !== 'string' || value.length === 0) {
      fail(`surface entry must be a non-empty string: ${String(value)}`);
    }
    return value;
  });

  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    fail('surface entries must be unique');
  }

  if (unique.includes(registryRelPath) || unique.includes(REGISTRY_CANONICAL_PATH)) {
    fail(`registry must not include itself as an evidence surface: ${REGISTRY_CANONICAL_PATH}`);
  }

  for (const relPath of unique) {
    if (relPath.includes('\u005c')) {
      fail(`surface path must use forward slashes: ${relPath}`);
    }
    if (!relPath.startsWith('docs/releases/')) {
      fail(`evidence surface must live under docs/releases: ${relPath}`);
    }
    if (!isEvidenceSurface(relPath)) {
      fail(`registry contains non-evidence surface: ${relPath}`);
    }

    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) {
      fail(`missing declared evidence surface: ${relPath}`);
    }
    if (!fs.statSync(absPath).isFile()) {
      fail(`declared evidence surface is not a file: ${relPath}`);
    }
  }

  return unique;
}

function main() {
  const registryArg = process.argv[2] ?? DEFAULT_REGISTRY_PATH;
  const surfaceRootArg = process.argv[3] ?? DEFAULT_SURFACE_ROOT;

  const registryAbsPath = path.resolve(registryArg);
  const registryRelPath = toPosixRelative(path.relative(process.cwd(), registryAbsPath));
  const surfaceRootAbs = path.resolve(surfaceRootArg);

  const registryEntries = readRegistry(registryAbsPath, registryRelPath);
  const discoveredEntries = listEvidenceSurfaces(surfaceRootAbs);

  const registrySet = new Set(registryEntries);
  const discoveredSet = new Set(discoveredEntries);

  const undeclared = discoveredEntries.filter((relPath) => !registrySet.has(relPath));
  const missingDeclared = registryEntries.filter((relPath) => !discoveredSet.has(relPath));

  if (undeclared.length > 0) {
    fail(`undeclared evidence surface(s): ${undeclared.join(', ')}`);
  }

  if (missingDeclared.length > 0) {
    fail(`declared evidence surface(s) not discovered in root: ${missingDeclared.join(', ')}`);
  }

  ok(`registry matches legal evidence surfaces (${registryEntries.length} entries)`);
}

main();