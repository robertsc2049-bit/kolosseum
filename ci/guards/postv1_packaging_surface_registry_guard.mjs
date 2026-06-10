// @law: Release Packaging Integrity
// @severity: high
// @scope: repo
import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_RELATIVE_PATH = 'docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json';
const REGISTRY_PATH = path.resolve(REGISTRY_RELATIVE_PATH);

function fail(message) {
  console.error(`packaging_surface_registry_guard: FAIL - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: packaging_surface_registry_guard (${message})`);
}

function listTrackedPackagingSurfaces() {
  const docsDir = path.resolve('docs/releases');
  const scriptsDir = path.resolve('ci/scripts');

  const docEntries = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `docs/releases/${entry.name}`)
    .filter((filePath) => {
      const base = path.posix.basename(filePath);
      return (
        /^V1_/.test(base) &&
        filePath !== REGISTRY_RELATIVE_PATH
      );
    });

  const scriptEntries = fs.readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `ci/scripts/${entry.name}`)
    .filter((filePath) => {
      const base = path.posix.basename(filePath);
      return (
        base === 'build_postv1_packaging_evidence.mjs' ||
        /^run_postv1_.*\.mjs$/.test(base) ||
        base === 'run_release_claim_validator.mjs'
      );
    });

  return [...docEntries, ...scriptEntries].sort();
}

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fail(`missing registry file: ${path.relative(process.cwd(), REGISTRY_PATH)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail(`registry is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (parsed?.name !== 'v1_packaging_surface_registry') {
    fail('registry name must be "v1_packaging_surface_registry"');
  }

  if (!Array.isArray(parsed?.surfaces)) {
    fail('registry surfaces must be an array');
  }

  const normalized = parsed.surfaces.map((value) => {
    if (typeof value !== 'string') {
      fail(`registry surface entry must be string: ${String(value)}`);
    }
    return value;
  });

  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    fail('registry surfaces must be unique');
  }

  if (unique.includes(REGISTRY_RELATIVE_PATH)) {
    fail(`registry must not include itself as a tracked surface: ${REGISTRY_RELATIVE_PATH}`);
  }

  return unique;
}

function main() {
  const registryEntries = readRegistry();
  const trackedEntries = listTrackedPackagingSurfaces();

  const registrySet = new Set(registryEntries);
  const trackedSet = new Set(trackedEntries);

  const missingFromRegistry = trackedEntries.filter((filePath) => !registrySet.has(filePath));
  const extraInRegistry = registryEntries.filter((filePath) => !trackedSet.has(filePath));

  if (missingFromRegistry.length > 0) {
    fail(`missing tracked packaging surface(s): ${missingFromRegistry.join(', ')}`);
  }

  if (extraInRegistry.length > 0) {
    fail(`registry contains non-tracked packaging surface(s): ${extraInRegistry.join(', ')}`);
  }

  ok(`registry matches tracked packaging surfaces (${trackedEntries.length} entries)`);
}

main();