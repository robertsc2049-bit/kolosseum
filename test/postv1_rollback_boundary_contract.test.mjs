import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROLLBACK_PATH = path.resolve('docs/releases/V1_ROLLBACK.md');

function readRollback() {
  return fs.readFileSync(ROLLBACK_PATH, 'utf8');
}

test('P47: rollback boundary doc exists', () => {
  assert.equal(fs.existsSync(ROLLBACK_PATH), true, 'expected rollback doc to exist');
  assert.equal(fs.statSync(ROLLBACK_PATH).isFile(), true, 'expected rollback path to be a file');
});

test('P47: rollback boundary limits rollback claims to repo-known artefacts and steps', () => {
  const content = readRollback();

  assert.match(
    content,
    /## Rollback boundary/i,
    'expected "Rollback boundary" section'
  );

  assert.match(
    content,
    /rollback is limited to repo-known rollback artefacts and declared operator steps/i,
    'expected explicit rollback boundary statement'
  );

  assert.match(
    content,
    /does not claim any rollback capability outside the declared release boundary/i,
    'expected explicit exclusion of out-of-bound rollback claims'
  );

  assert.match(
    content,
    /rollback claims are limited to files, checks, and steps that exist in this repository and are explicitly declared in the release artefacts/i,
    'expected explicit repo-known rollback surface statement'
  );
});