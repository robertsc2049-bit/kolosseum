import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

test('P4: release artefact manifest parses and includes only real core artefacts', () => {
  const manifestPath = 'docs/releases/V1_ARTEFACT_MANIFEST.json';
  assert.equal(fs.existsSync(manifestPath), true);

  const j = readJson(manifestPath);
  assert.equal(j.release, 'v1');
  assert.equal(typeof j.artefacts, 'object');
  assert.ok(j.artefacts);

  for (const key of ['release_notes', 'release_checklist', 'version_contract']) {
    assert.equal(typeof j.artefacts[key], 'string');
    assert.equal(fs.existsSync(j.artefacts[key]), true);
  }
});

test('P4: release artefact manifest does not list uncreated artefacts', () => {
  const j = readJson('docs/releases/V1_ARTEFACT_MANIFEST.json');
  const values = Object.values(j.artefacts);

  assert.equal(values.includes('docs/releases/V1_ROLLBACK.md'), false);
  assert.equal(values.includes('docs/releases/V1_OPERATOR_RUNBOOK.md'), false);
});

test('P4: release artefact manifest keys are exact and stable for current scope', () => {
  const j = readJson('docs/releases/V1_ARTEFACT_MANIFEST.json');

  assert.deepEqual(
    Object.keys(j.artefacts).sort(),
    ['release_checklist', 'release_notes', 'version_contract'].sort()
  );
});