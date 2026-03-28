import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve('ci/scripts/run_postv1_evidence_surface_verifier.mjs');
const REGISTRY_PATH = path.resolve('docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json');
const SURFACE_ROOT = path.resolve('docs/releases');

function runVerifier(registryPath, surfaceRoot) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, registryPath, surfaceRoot],
    { encoding: 'utf8' }
  );
}

test('P45: evidence surface verifier passes on repo registry', () => {
  const result = runVerifier(REGISTRY_PATH, SURFACE_ROOT);
  assert.equal(result.status, 0, `expected verifier to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK: evidence_surface/);
});

test('P45: evidence surface verifier fails when a stray evidence file exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postv1-evidence-surface-'));
  const releasesDir = path.join(tmpDir, 'docs', 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });

  const registry = {
    name: 'v1_evidence_surface_registry',
    surfaces: [
      'docs/releases/V1_ARTEFACT_MANIFEST.json',
      'docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md',
      'docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json'
    ]
  };

  fs.writeFileSync(
    path.join(releasesDir, 'V1_EVIDENCE_SURFACE_REGISTRY.json'),
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8'
  );

  fs.writeFileSync(path.join(releasesDir, 'V1_ARTEFACT_MANIFEST.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(releasesDir, 'V1_MAINLINE_GREEN_RUN_EVIDENCE.md'), '# mainline green run\n', 'utf8');
  fs.writeFileSync(path.join(releasesDir, 'V1_PACKAGING_EVIDENCE_MANIFEST.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(releasesDir, 'V1_INFORMAL_EVIDENCE_NOTE.md'), '# stray evidence\n', 'utf8');

  const result = runVerifier(
    path.join(releasesDir, 'V1_EVIDENCE_SURFACE_REGISTRY.json'),
    releasesDir
  );

  assert.notEqual(result.status, 0, 'expected verifier to fail');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /undeclared evidence surface\(s\): docs\/releases\/V1_INFORMAL_EVIDENCE_NOTE\.md/
  );
});