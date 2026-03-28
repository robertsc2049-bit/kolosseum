import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SIGNOFF_PATH = path.resolve('docs/releases/V1_ACCEPTANCE_SIGNOFF.md');

function readSignoff() {
  return fs.readFileSync(SIGNOFF_PATH, 'utf8');
}

test('P46: signoff scope doc exists', () => {
  assert.equal(fs.existsSync(SIGNOFF_PATH), true, 'expected acceptance signoff doc to exist');
  assert.equal(fs.statSync(SIGNOFF_PATH).isFile(), true, 'expected acceptance signoff path to be a file');
});

test('P46: signoff scope states process completion only and excludes unstated technical guarantees', () => {
  const content = readSignoff();

  assert.match(
    content,
    /## Scope of signoff/i,
    'expected "Scope of signoff" section'
  );

  assert.match(
    content,
    /acceptance signoff certifies that the declared acceptance process was completed/i,
    'expected explicit process-completion certification'
  );

  assert.match(
    content,
    /does not certify any unstated technical guarantee/i,
    'expected explicit exclusion of unstated technical guarantees'
  );

  assert.match(
    content,
    /does not certify performance, security, correctness, or production fitness beyond explicitly declared release artefacts and gates/i,
    'expected explicit non-certification boundary list'
  );
});