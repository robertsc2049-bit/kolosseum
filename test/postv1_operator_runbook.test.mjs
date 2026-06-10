import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'docs/releases/V1_OPERATOR_RUNBOOK.md';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('P7: operator runbook exists with required sections', () => {
  assert.equal(fs.existsSync(path), true);
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 operator runbook$/m);
  assert.match(text, /^## Purpose$/m);
  assert.match(text, /^## 1\. Preflight$/m);
  assert.match(text, /^## 2\. Release execution$/m);
  assert.match(text, /^## 3\. Post-release confirmation$/m);
  assert.match(text, /^## Explicit non-claims$/m);
});

test('P7: operator runbook reflects current repo release-pack reality', () => {
  const text = fs.readFileSync(path, 'utf8');

  for (const phrase of [
    'docs/releases/V1_RELEASE_NOTES.md exists',
    'docs/releases/V1_RELEASE_CHECKLIST.md exists',
    'docs/releases/V1_VERSION_AND_TAG.md exists',
    'docs/releases/V1_ARTEFACT_MANIFEST.json exists',
    'docs/releases/V1_ROLLBACK.md exists',
    'docs/releases/V1_ENV_TEMPLATE.example exists'
  ]) {
    assert.match(text, new RegExp(escapeRegex(phrase)));
  }
});

test('P7: operator runbook stays manual and truthful', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /manual operator procedure/i);
  assert.match(text, /does not imply automated deployment/i);
  assert.match(text, /perform version\/tag steps only if the operator is intentionally tagging the release/i);
  assert.match(text, /no automatic rollback is claimed here/i);
});