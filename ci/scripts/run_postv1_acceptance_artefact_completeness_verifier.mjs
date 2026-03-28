import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SET_PATH = 'docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json';

function fail(message) {
  console.error(`acceptance_artefact_completeness: FAIL - ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: acceptance_artefact_completeness (${message})`);
}

function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${path.relative(process.cwd(), absPath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function main() {
  const setArg = process.argv[2] ?? DEFAULT_SET_PATH;
  const setPath = path.resolve(setArg);

  if (!fs.existsSync(setPath)) {
    fail(`missing acceptance artefact set: ${path.relative(process.cwd(), setPath)}`);
  }

  const parsed = readJson(setPath);

  if (parsed?.name !== 'v1_acceptance_artefact_set') {
    fail('artefact set name must be "v1_acceptance_artefact_set"');
  }

  if (!Array.isArray(parsed?.artefacts) || parsed.artefacts.length === 0) {
    fail('artefacts must be a non-empty array');
  }

  const normalized = parsed.artefacts.map((value) => {
    if (typeof value !== 'string' || value.length === 0) {
      fail(`artefact entry must be a non-empty string: ${String(value)}`);
    }
    return value;
  });

  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    fail('artefact entries must be unique');
  }

  for (const relPath of unique) {
    if (relPath.includes('\u005c')) {
      fail(`artefact path must use forward slashes: ${relPath}`);
    }
    if (relPath.endsWith('/')) {
      fail(`artefact path must be a file, not a directory: ${relPath}`);
    }

    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) {
      fail(`missing required acceptance artefact: ${relPath}`);
    }
    if (!fs.statSync(absPath).isFile()) {
      fail(`required acceptance artefact is not a file: ${relPath}`);
    }
  }

  ok(`all required acceptance artefacts present (${unique.length} artefacts)`);
}

main();