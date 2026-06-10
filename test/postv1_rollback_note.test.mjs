import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'docs/releases/V1_ROLLBACK.md';

test('P5: rollback note exists with required sections', () => {
  assert.equal(fs.existsSync(path), true);
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 rollback note$/m);
  assert.match(text, /^## Purpose$/m);
  assert.match(text, /^## Trigger conditions$/m);
  assert.match(text, /^## Rollback expectations$/m);
  assert.match(text, /^## Explicit non-claims$/m);
});

test('P5: rollback note stays conservative and operator-driven', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /operator guidance artefact only/i);
  assert.match(text, /identify the last known good merged main commit or validated release marker/i);
  assert.match(text, /re-run the required CI \/ proof checks/i);
});

test('P5: rollback note never overstates automation', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /no automatic production rollback is claimed here/i);
  assert.match(text, /no infrastructure rollback mechanism is claimed here/i);
  assert.match(text, /no database rollback mechanism is claimed here/i);
  assert.match(text, /no guarantee is made that a git tag alone is sufficient for recovery/i);
});