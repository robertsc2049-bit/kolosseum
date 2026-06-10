import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RUNBOOK_PATH = path.resolve('docs/releases/V1_OPERATOR_RUNBOOK.md');

function readRunbook() {
  return fs.readFileSync(RUNBOOK_PATH, 'utf8');
}

test('P49: operator runbook exists', () => {
  assert.equal(fs.existsSync(RUNBOOK_PATH), true, 'expected operator runbook to exist');
  assert.equal(fs.statSync(RUNBOOK_PATH).isFile(), true, 'expected operator runbook path to be a file');
});

test('P49: operator runbook scope is locked to declared operations boundary content only', () => {
  const content = readRunbook();

  assert.match(
    content,
    /## Runbook scope/i,
    'expected "Runbook scope" section'
  );

  assert.match(
    content,
    /this runbook is limited to declared release operations boundary content only/i,
    'expected explicit boundary-only scope statement'
  );

  assert.match(
    content,
    /does not introduce any extra operational surface outside the declared boundary/i,
    'expected explicit exclusion of extra operational surface'
  );

  assert.match(
    content,
    /all operator actions in this runbook must map to repo-declared release artefacts, checks, or operator steps/i,
    'expected explicit repo-declared mapping statement'
  );
});