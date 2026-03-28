import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SCRIPT_PATH = 'ci/scripts/run_postv1_merge_readiness_verifier.mjs';

test('P33: merge-readiness verifier exists', () => {
  assert.equal(fs.existsSync(SCRIPT_PATH), true);
});

test('P33: merge-readiness verifier checks only repo-known readiness conditions', () => {
  const source = fs.readFileSync(SCRIPT_PATH, 'utf8');

  const requiredChecks = [
    "git', ['branch', '--show-current']",
    "git', ['status', '--short']",
    "gh', [",
    "'pr'",
    "'view'",
    "'checks'",
    'number,title,state,isDraft,baseRefName,headRefName',
    'pr.state',
    'pr.isDraft',
    'pr.baseRefName',
    'pr.headRefName',
    'All checks were successful',
    'POSTV1_MERGE_READINESS_OK',
  ];

  for (const token of requiredChecks) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const forbiddenTerms = [
    'merge --',
    'gh pr merge',
    '--admin',
    '--delete-branch',
    'git push',
    'git reset --hard origin/main',
    'gh pr checks --watch',
    'deployment',
    'rollout',
    'publish',
    'hosted availability',
  ];

  for (const token of forbiddenTerms) {
    assert.doesNotMatch(source.toLowerCase(), new RegExp(token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});