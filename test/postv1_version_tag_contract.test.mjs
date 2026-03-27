import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'docs/releases/V1_VERSION_AND_TAG.md';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('P3: version/tag contract artefact exists with required sections', () => {
  assert.equal(fs.existsSync(path), true);
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 version and tag contract$/m);
  assert.match(text, /^## Purpose$/m);
  assert.match(text, /^## Authority boundaries$/m);
  assert.match(text, /^### 1\. Version authority$/m);
  assert.match(text, /^### 2\. Tag authority$/m);
  assert.match(text, /^## Operator procedure$/m);
  assert.match(text, /^## Explicit non-claims$/m);
});

test('P3: version/tag contract includes truthful operator procedure', () => {
  const text = fs.readFileSync(path, 'utf8');

  for (const phrase of [
    'the repository package version is the version string authority',
    'the git tag is a release marker attached by an operator',
    'release notes document is descriptive and does not override package or git history',
    'create an annotated git tag on the merged main release commit',
    'verify the tag resolves to the intended main commit'
  ]) {
    assert.match(text, new RegExp(escapeRegex(phrase)));
  }
});

test('P3: version/tag contract avoids false release automation claims', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /no claim of automatic version bumping/i);
  assert.match(text, /no claim of automatic tag creation/i);
  assert.match(text, /no claim of automatic deployment/i);
  assert.match(text, /no claim of app-store publication/i);
});