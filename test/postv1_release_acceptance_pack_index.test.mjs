import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DOC_PATH = 'docs/releases/V1_ACCEPTANCE_PACK_INDEX.md';

function extractEntries(text, heading) {
  const lines = text.split(/\r?\n/);
  const results = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('## ')) {
      inSection = line === heading;
      continue;
    }

    if (inSection && line.startsWith('- ')) {
      results.push(line.slice(2).trim());
    }
  }

  return results;
}

test('P29: acceptance pack index exists', () => {
  assert.equal(fs.existsSync(DOC_PATH), true);
});

test('P29: acceptance pack index references only real acceptance artefacts', () => {
  const text = fs.readFileSync(DOC_PATH, 'utf8');

  const acceptanceEntries = extractEntries(text, '## Acceptance artefacts');
  const verificationEntries = extractEntries(text, '## Verification surfaces');

  const expectedAcceptanceEntries = [
    'V1_ACCEPTANCE_SIGNOFF.md',
    'V1_RELEASE_CHECKLIST.md',
    'V1_OPERATOR_RUNBOOK.md',
    'V1_ROLLBACK.md',
    'V1_PACKAGING_EVIDENCE_MANIFEST.json',
  ].sort();

  const expectedVerificationEntries = [
    'ci/scripts/build_postv1_packaging_evidence.mjs',
    'ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs',
  ].sort();

  assert.deepEqual([...acceptanceEntries].sort(), expectedAcceptanceEntries);
  assert.deepEqual([...verificationEntries].sort(), expectedVerificationEntries);

  for (const file of acceptanceEntries) {
    assert.equal(fs.existsSync(path.join('docs/releases', file)), true, `missing acceptance artefact: ${file}`);
  }

  for (const file of verificationEntries) {
    assert.equal(fs.existsSync(file), true, `missing verification surface: ${file}`);
  }
});

test('P29: acceptance pack verification surfaces run clean', () => {
  const outDir = path.join('artifacts', 'postv1_packaging_evidence');
  fs.rmSync(outDir, { recursive: true, force: true });

  try {
    const buildResult = spawnSync(process.execPath, ['ci/scripts/build_postv1_packaging_evidence.mjs'], {
      encoding: 'utf8',
    });
    assert.equal(buildResult.status, 0, buildResult.stderr || buildResult.stdout);
    assert.match(buildResult.stdout, /POSTV1_PACKAGING_EVIDENCE_COLLECTED/);

    const verifyResult = spawnSync(process.execPath, ['ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs'], {
      encoding: 'utf8',
    });
    assert.equal(verifyResult.status, 0, verifyResult.stderr || verifyResult.stdout);
    assert.match(verifyResult.stdout, /POSTV1_PACKAGING_EVIDENCE_MANIFEST_VERIFIER_OK/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});