import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SCRIPT_PATH = 'ci/scripts/run_postv1_mainline_post_merge_verification.mjs';

test('P34f2: mainline post-merge verification script exists', () => {
  assert.equal(fs.existsSync(SCRIPT_PATH), true);
});

test('P34f2: mainline post-merge verification script uses only existing repo-known verification commands', () => {
  const source = fs.readFileSync(SCRIPT_PATH, 'utf8');

  const requiredTokens = [
    "git', ['branch', '--show-current']",
    "git', ['status', '--short']",
    "execFileSync('cmd.exe', ['/d', '/s', '/c', command]",
    "execFileSync('npm', command.split(' ')",
    "runCommand('npm run lint:fast')",
    "runCommand('npm run build:fast')",
    'POSTV1_MAINLINE_POST_MERGE_VERIFICATION_OK',
  ];

  for (const token of requiredTokens) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const forbiddenTokens = [
    "execFileSync('npm.cmd'",
    "npm', ['run', 'green:ci']",
    "npm', ['run', 'test:ci']",
    "npm', ['run', 'e2e:golden']",
    'gh ',
    'gh pr',
    'gh run',
    'merge --',
    'gh pr merge',
    '--admin',
    '--delete-branch',
    'deployment',
    'rollout',
    'publish',
    'hosted availability',
  ];

  for (const token of forbiddenTokens) {
    assert.doesNotMatch(source.toLowerCase(), new RegExp(token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});