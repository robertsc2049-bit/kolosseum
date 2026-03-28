import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve('ci/scripts/run_postv1_mainline_verification_dependency_verifier.mjs');
const BOUNDARY_PATH = path.resolve('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json');
const MAINLINE_SCRIPT_PATH = path.resolve('ci/scripts/run_postv1_mainline_post_merge_verification.mjs');

function runVerifier(boundaryPath, scriptPath) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, boundaryPath, scriptPath],
    { encoding: 'utf8' }
  );
}

test('P48: mainline verification dependency verifier passes on repo surfaces', () => {
  const result = runVerifier(BOUNDARY_PATH, MAINLINE_SCRIPT_PATH);
  assert.equal(result.status, 0, `expected verifier to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK: mainline_verification_dependency/);
});

test('P48: mainline verification dependency verifier fails on undeclared dependency surface', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postv1-mainline-dependency-'));
  const boundaryCopyPath = path.join(tmpDir, 'V1_RELEASE_OPERATIONS_BOUNDARY.json');
  const mainlineCopyPath = path.join(tmpDir, 'run_postv1_mainline_post_merge_verification.mjs');

  const boundary = JSON.parse(fs.readFileSync(BOUNDARY_PATH, 'utf8'));

  if (Array.isArray(boundary.artefacts) && !boundary.artefacts.includes('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json')) {
    boundary.artefacts = [...boundary.artefacts, 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json'];
  }
  if (Array.isArray(boundary.allowed_surfaces) && !boundary.allowed_surfaces.includes('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json')) {
    boundary.allowed_surfaces = [...boundary.allowed_surfaces, 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json'];
  }
  if (Array.isArray(boundary.surfaces) && !boundary.surfaces.includes('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json')) {
    boundary.surfaces = [...boundary.surfaces, 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json'];
  }
  if (Array.isArray(boundary.files) && !boundary.files.includes('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json')) {
    boundary.files = [...boundary.files, 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json'];
  }
  if (Array.isArray(boundary.docs) && !boundary.docs.includes('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json')) {
    boundary.docs = [...boundary.docs, 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json'];
  }

  fs.writeFileSync(boundaryCopyPath, `${JSON.stringify(boundary, null, 2)}\n`, 'utf8');

  const source = [
    "import fs from 'node:fs';",
    "const declared = 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json';",
    "const stray = 'docs/releases/V1_UNDECLARED_DEPENDENCY.md';",
    "void fs.existsSync(declared);",
    "void fs.existsSync(stray);"
  ].join('\n');

  fs.writeFileSync(mainlineCopyPath, `${source}\n`, 'utf8');

  const result = runVerifier(boundaryCopyPath, mainlineCopyPath);
  assert.notEqual(result.status, 0, 'expected verifier to fail');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /undeclared dependency surface\(s\): docs\/releases\/V1_UNDECLARED_DEPENDENCY\.md/
  );
});