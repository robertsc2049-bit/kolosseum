import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('P1: release notes artefact exists with required v1 sections', () => {
  const path = 'docs/releases/V1_RELEASE_NOTES.md';
  assert.equal(fs.existsSync(path), true);

  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 release notes/m);
  assert.match(text, /^## Release identity$/m);
  assert.match(text, /^## Scope statement$/m);
  assert.match(text, /^## Included scope$/m);
  assert.match(text, /^## Explicit non-claims$/m);
  assert.match(text, /^## Evidence basis$/m);
});

test('P1: release notes explicitly constrain themselves to merged scope only', () => {
  const text = fs.readFileSync('docs/releases/V1_RELEASE_NOTES.md', 'utf8');

  assert.match(text, /merged scope on main only/i);
  assert.match(text, /must not claim unmerged work/i);
  assert.match(text, /must not claim .* planned work/i);
});

test('P1: release notes avoid obvious overclaim language', () => {
  const text = fs.readFileSync('docs/releases/V1_RELEASE_NOTES.md', 'utf8');

  assert.doesNotMatch(text, /\bguarantee(d)?\b/i);
  assert.doesNotMatch(text, /\boptimal\b/i);
  assert.doesNotMatch(text, /\bsafer?\b/i);
  assert.doesNotMatch(text, /\brecommended?\b/i);
  assert.doesNotMatch(text, /\bprevents?\b/i);
});