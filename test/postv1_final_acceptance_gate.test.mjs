import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = 'ci/scripts/run_postv1_final_acceptance_gate.mjs';

test('P30: final acceptance gate exists', () => {
  assert.equal(fs.existsSync(SCRIPT_PATH), true);
});

test('P30: final acceptance gate calls only proven internal surfaces', () => {
  const source = fs.readFileSync(SCRIPT_PATH, 'utf8');

  const expectedCalledSurfaces = [
    'ci/scripts/build_postv1_packaging_evidence.mjs',
    'ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs',
  ].sort();

  const calledSurfaces = [...source.matchAll(/runNodeSurface\(\s*'([^']+)'/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(calledSurfaces, expectedCalledSurfaces);

  const expectedAcceptanceSurfaces = [
    'docs/releases/V1_ACCEPTANCE_SIGNOFF.md',
    'docs/releases/V1_RELEASE_CHECKLIST.md',
    'docs/releases/V1_OPERATOR_RUNBOOK.md',
    'docs/releases/V1_ROLLBACK.md',
    'docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json',
    'docs/releases/V1_ACCEPTANCE_PACK_INDEX.md',
  ].sort();

  const acceptanceSurfaceBlockMatch = source.match(/const ACCEPTANCE_SURFACES = \[(.*?)\];/s);
  assert.ok(acceptanceSurfaceBlockMatch, 'missing ACCEPTANCE_SURFACES block');

  const acceptanceSurfaces = [...acceptanceSurfaceBlockMatch[1].matchAll(/'([^']+)'/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(acceptanceSurfaces, expectedAcceptanceSurfaces);

  for (const file of expectedAcceptanceSurfaces) {
    assert.equal(fs.existsSync(file), true, `missing internal acceptance surface: ${file}`);
  }

  for (const file of expectedCalledSurfaces) {
    assert.equal(fs.existsSync(file), true, `missing proven internal surface: ${file}`);
  }
});

test('P30: final acceptance gate runs green and emits success marker', () => {
  const outDir = path.join('artifacts', 'postv1_packaging_evidence');
  fs.rmSync(outDir, { recursive: true, force: true });

  try {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /POSTV1_PACKAGING_EVIDENCE_COLLECTED/);
    assert.match(result.stdout, /POSTV1_PACKAGING_EVIDENCE_MANIFEST_VERIFIER_OK/);
    assert.match(result.stdout, /POSTV1_FINAL_ACCEPTANCE_GATE_GREEN/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});