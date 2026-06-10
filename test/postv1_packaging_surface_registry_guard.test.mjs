import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, ...relPath.split('/'));
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'postv1-packaging-registry-guard-'));

  writeFile(
    root,
    'ci/guards/postv1_packaging_surface_registry_guard.mjs',
    fs.readFileSync(path.resolve('ci/guards/postv1_packaging_surface_registry_guard.mjs'), 'utf8'),
  );

  writeFile(root, 'docs/releases/V1_RELEASE_NOTES.md', '# notes\n');
  writeFile(root, 'docs/releases/V1_RELEASE_CHECKLIST.md', '# checklist\n');
  writeFile(root, 'docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json', JSON.stringify({
    name: 'v1_packaging_surface_registry',
    surfaces: [
      'ci/scripts/build_postv1_packaging_evidence.mjs',
      'ci/scripts/run_postv1_final_acceptance_gate.mjs',
      'docs/releases/V1_RELEASE_CHECKLIST.md',
      'docs/releases/V1_RELEASE_NOTES.md',
    ],
  }, null, 2));

  writeFile(root, 'ci/scripts/build_postv1_packaging_evidence.mjs', 'export {};\n');
  writeFile(root, 'ci/scripts/run_postv1_final_acceptance_gate.mjs', 'export {};\n');

  return root;
}

function runGuard(cwd) {
  return spawnSync(
    process.execPath,
    [path.resolve('ci/guards/postv1_packaging_surface_registry_guard.mjs')],
    { cwd, encoding: 'utf8' },
  );
}

test('P38: packaging registry guard passes when registry matches tracked surfaces', () => {
  const root = setupFixture();
  const result = runGuard(root);

  assert.equal(result.status, 0, `guard should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK: packaging_surface_registry_guard/);
});

test('P38: packaging registry guard fails when tracked surface is missing from registry', () => {
  const root = setupFixture();
  writeFile(root, 'docs/releases/V1_OPERATOR_RUNBOOK.md', '# runbook\n');

  const result = runGuard(root);

  assert.notEqual(result.status, 0, 'guard should fail when tracked file is missing from registry');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /missing tracked packaging surface\(s\): docs\/releases\/V1_OPERATOR_RUNBOOK\.md/,
  );
});

test('P38: packaging registry guard fails when registry contains extra non-tracked surface', () => {
  const root = setupFixture();

  const registryPath = path.join(root, 'docs', 'releases', 'V1_PACKAGING_SURFACE_REGISTRY.json');
  const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  parsed.surfaces.push('ci/scripts/run_postv1_merge_readiness_verifier.mjs');
  fs.writeFileSync(registryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  const result = runGuard(root);

  assert.notEqual(result.status, 0, 'guard should fail when registry contains extra file');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /registry contains non-tracked packaging surface\(s\): ci\/scripts\/run_postv1_merge_readiness_verifier\.mjs/,
  );
});