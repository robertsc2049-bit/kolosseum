import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve('ci/scripts/run_postv1_release_operations_boundary.mjs');
const BOUNDARY_PATH = path.resolve('docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json');

function runVerifier(boundaryPath) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, boundaryPath],
    { encoding: 'utf8' }
  );
}

test('P40: release operations boundary file exists', () => {
  assert.equal(fs.existsSync(BOUNDARY_PATH), true);
});

test('P40: release operations boundary verifier passes on repo boundary', () => {
  const result = runVerifier(BOUNDARY_PATH);
  assert.equal(result.status, 0, `expected verifier to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK: release_operations_boundary/);
});

test('P40: release operations boundary verifier fails on missing claimed surface', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postv1-release-operations-boundary-'));
  const badBoundaryPath = path.join(tmpDir, 'boundary.json');

  const parsed = JSON.parse(fs.readFileSync(BOUNDARY_PATH, 'utf8'));
  parsed.surfaces = [...parsed.surfaces, 'docs/releases/V1_DOES_NOT_EXIST.md'];

  fs.writeFileSync(badBoundaryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  const result = runVerifier(badBoundaryPath);
  assert.notEqual(result.status, 0, 'expected verifier to fail');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /missing claimed surface: docs\/releases\/V1_DOES_NOT_EXIST\.md/
  );
});