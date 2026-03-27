import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'docs/releases/V1_RELEASE_CHECKLIST.md';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('P2: release checklist artefact exists with required sections', () => {
  assert.equal(fs.existsSync(path), true);
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 release checklist$/m);
  assert.match(text, /^## Purpose$/m);
  assert.match(text, /^## Operator checklist$/m);
  assert.match(text, /^### 1\. Main branch release base$/m);
  assert.match(text, /^### 2\. CI authority$/m);
  assert.match(text, /^### 3\. Replay gate$/m);
  assert.match(text, /^### 4\. Evidence \/ export gate$/m);
  assert.match(text, /^### 5\. Non-claim checks$/m);
});

test('P2: checklist contains only validated release-boundary checks', () => {
  const text = fs.readFileSync(path, 'utf8');

  for (const phrase of [
    'local main is hard-synced to origin/main',
    'CI has passed fully for the release commit',
    'replay result is ACCEPTED before any evidence or export claim is made',
    'evidence is not treated as sealed unless CI passed fully and replay is ACCEPTED',
    'checklist does not claim unmerged scope'
  ]) {
    assert.match(text, new RegExp(escapeRegex(phrase)));
  }
});

test('P2: checklist excludes unsupported generic operator wishes', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.doesNotMatch(text, /environment template reviewed/i);
  assert.doesNotMatch(text, /rollback note present/i);
  assert.doesNotMatch(text, /tag plan confirmed/i);
});