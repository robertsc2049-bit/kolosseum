import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('P8: release claim validator passes against current release notes shape', () => {
  const r = spawnSync(
    process.execPath,
    ['ci/scripts/run_release_claim_validator.mjs'],
    { encoding: 'utf8' }
  );

  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /RELEASE_CLAIM_VALIDATOR_OK/);
});