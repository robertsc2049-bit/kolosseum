import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve('ci/scripts/run_postv1_promotion_artefact_completeness_verifier.mjs');
const SET_PATH = path.resolve('docs/releases/V1_PROMOTION_ARTEFACT_SET.json');

function runVerifier(setPath) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, setPath],
    { encoding: 'utf8' }
  );
}

test('P44: promotion artefact verifier passes on repo set', () => {
  const result = runVerifier(SET_PATH);
  assert.equal(result.status, 0, `expected verifier to pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /OK: promotion_artefact_completeness/);
});

test('P44: promotion artefact verifier fails when a required artefact is missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postv1-promotion-artefact-set-'));
  const badSetPath = path.join(tmpDir, 'bad_promotion_set.json');

  const parsed = JSON.parse(fs.readFileSync(SET_PATH, 'utf8'));
  parsed.artefacts = [...parsed.artefacts, 'docs/releases/V1_PROMOTION_DOES_NOT_EXIST.md'];

  fs.writeFileSync(badSetPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  const result = runVerifier(badSetPath);
  assert.notEqual(result.status, 0, 'expected verifier to fail');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /missing required promotion artefact: docs\/releases\/V1_PROMOTION_DOES_NOT_EXIST\.md/
  );
});