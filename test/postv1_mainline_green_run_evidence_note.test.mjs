import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DOC_PATH = 'docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md';

test('P35: mainline green-run evidence note exists', () => {
  assert.equal(fs.existsSync(DOC_PATH), true);
});

test('P35: mainline green-run evidence note does not imply external deployment success', () => {
  const text = fs.readFileSync(DOC_PATH, 'utf8');
  const normalized = text.toLowerCase();

  const requiredPhrases = [
    'main green state is captured after a merge',
    'post-merge verification script',
    'postv1_mainline_post_merge_verification_ok',
    'clean local state',
    'current `main` commit',
    'internal repository verification only',
    'does not imply deployment success, rollout success, publish completion, hosted availability, or customer-facing release success',
  ];

  for (const phrase of requiredPhrases) {
    assert.match(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const requiredEvidenceSurfaces = [
    'ci/scripts/run_postv1_mainline_post_merge_verification.mjs',
    'npm run lint:fast',
    'npm run build:fast',
    'git status --short',
  ];

  for (const token of requiredEvidenceSurfaces) {
    assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const bannedPhrases = [
    'deployment succeeded',
    'rollout succeeded',
    'published successfully',
    'release is live',
    'go live',
    'available to customers',
    'production success',
    'app store',
    'play store',
  ];

  for (const phrase of bannedPhrases) {
    assert.doesNotMatch(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});