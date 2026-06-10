import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BOUNDARY_PATH = 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json';

function fail(message) {
  console.error(`release_operations_boundary: FAIL - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: release_operations_boundary (${message})`);
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${path.relative(process.cwd(), absPath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      fail(`${label} entries must be non-empty strings`);
    }
  }
}

function main() {
  const boundaryArg = process.argv[2] ?? DEFAULT_BOUNDARY_PATH;
  const boundaryPath = path.resolve(boundaryArg);

  if (!fs.existsSync(boundaryPath)) {
    fail(`missing boundary file: ${path.relative(process.cwd(), boundaryPath)}`);
  }

  const boundary = readJson(boundaryPath);

  if (boundary?.name !== 'v1_release_operations_boundary') {
    fail('boundary name must be "v1_release_operations_boundary"');
  }

  ensureStringArray(boundary.claims, 'claims');
  ensureStringArray(boundary.surfaces, 'surfaces');

  const claimSet = new Set(boundary.claims);
  if (claimSet.size !== boundary.claims.length) {
    fail('claims must be unique');
  }

  const surfaceSet = new Set(boundary.surfaces);
  if (surfaceSet.size !== boundary.surfaces.length) {
    fail('surfaces must be unique');
  }

  const requiredClaims = [
    'post_v1_packaging_surface',
    'post_v1_evidence_surface',
    'post_v1_acceptance_surface',
    'post_v1_promotion_surface'
  ];

  for (const claim of requiredClaims) {
    if (!claimSet.has(claim)) {
      fail(`missing required claim: ${claim}`);
    }
  }

  for (const relPath of boundary.surfaces) {
    if (relPath.includes('\u005c')) {
      fail(`surface must use forward slashes: ${relPath}`);
    }
    if (relPath.endsWith('/')) {
      fail(`surface must be a file, not directory: ${relPath}`);
    }
    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) {
      fail(`missing claimed surface: ${relPath}`);
    }
    if (!fs.statSync(absPath).isFile()) {
      fail(`claimed surface is not a file: ${relPath}`);
    }
  }

  ok(`boundary verified (${boundary.claims.length} claims, ${boundary.surfaces.length} surfaces)`);
}

main();