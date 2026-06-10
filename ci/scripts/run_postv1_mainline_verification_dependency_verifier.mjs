import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BOUNDARY_PATH = 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json';
const DEFAULT_MAINLINE_SCRIPT_PATH = 'ci/scripts/run_postv1_mainline_post_merge_verification.mjs';

function fail(message) {
  console.error(`mainline_verification_dependency: FAIL - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: mainline_verification_dependency (${message})`);
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${path.relative(process.cwd(), absPath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseNodeStringLiterals(source) {
  const literals = new Set();
  const regex = /'([^'\r\n]+)'|"([^"\r\n]+)"/g;

  for (const match of source.matchAll(regex)) {
    const value = match[1] ?? match[2] ?? '';
    if (value.length > 0) {
      literals.add(value);
    }
  }

  return [...literals];
}

function normalizeBoundaryEntries(parsed) {
  const allowed = new Set();

  const arrays = [
    parsed?.artefacts,
    parsed?.allowed_surfaces,
    parsed?.surfaces,
    parsed?.files,
    parsed?.scripts,
    parsed?.docs
  ].filter(Array.isArray);

  for (const entries of arrays) {
    for (const value of entries) {
      if (typeof value !== 'string' || value.length === 0) {
        fail(`boundary entry must be a non-empty string: ${String(value)}`);
      }
      allowed.add(value);
    }
  }

  if (allowed.size === 0) {
    fail('release operations boundary must declare at least one allowed surface');
  }

  return [...allowed].sort();
}

function discoverRepoPathDependencies(source) {
  return parseNodeStringLiterals(source)
    .filter((value) => /^(docs\/releases|ci\/scripts)\//.test(value))
    .sort();
}

function main() {
  const boundaryArg = process.argv[2] ?? DEFAULT_BOUNDARY_PATH;
  const scriptArg = process.argv[3] ?? DEFAULT_MAINLINE_SCRIPT_PATH;

  const boundaryPath = path.resolve(boundaryArg);
  const scriptPath = path.resolve(scriptArg);

  if (!fs.existsSync(boundaryPath)) {
    fail(`missing release operations boundary: ${path.relative(process.cwd(), boundaryPath)}`);
  }

  if (!fs.existsSync(scriptPath)) {
    fail(`missing mainline verification script: ${path.relative(process.cwd(), scriptPath)}`);
  }

  const boundaryParsed = readJson(boundaryPath);
  const allowedSurfaces = normalizeBoundaryEntries(boundaryParsed);
  const allowedSet = new Set(allowedSurfaces);

  const scriptSource = fs.readFileSync(scriptPath, 'utf8');
  const discoveredDependencies = discoverRepoPathDependencies(scriptSource);
  const undeclared = discoveredDependencies.filter((value) => !allowedSet.has(value));

  if (undeclared.length > 0) {
    fail(`undeclared dependency surface(s): ${undeclared.join(', ')}`);
  }

  ok(`all mainline verification dependency surfaces declared (${discoveredDependencies.length} dependencies checked)`);
}

main();