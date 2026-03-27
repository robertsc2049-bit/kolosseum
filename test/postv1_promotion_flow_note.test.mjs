import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DOC_PATH = 'docs/releases/V1_PROMOTION_FLOW.md';

test('P31: promotion-flow doc exists', () => {
  assert.equal(fs.existsSync(DOC_PATH), true);
});

test('P31: promotion-flow doc describes repo-known promotion steps only', () => {
  const text = fs.readFileSync(DOC_PATH, 'utf8');
  const normalized = text.toLowerCase();

  const requiredPhrases = [
    'internal repo-known promotion path',
    'completed packaging boundary',
    'ticket branch',
    'pull request into main',
    'required pull request checks',
    'merge the pull request into main',
    'sync local main to origin/main',
    'working tree is clean',
    'repository, branch, pull request, and merge steps only',
    'does not describe deployment, rollout, publishing, or customer-facing release activity',
  ];

  for (const phrase of requiredPhrases) {
    assert.match(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const forbiddenPhrases = [
    'deploy to production',
    'production deployment',
    'publish release',
    'customer rollout',
    'go live',
    'hosted availability',
    'app store',
    'live environment',
  ];

  for (const phrase of forbiddenPhrases) {
    assert.doesNotMatch(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});