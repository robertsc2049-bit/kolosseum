import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DOC_PATH = 'docs/releases/V1_PACKAGING_PROMOTION_PR_BODY_TEMPLATE.md';

test('P32: packaging promotion PR body template exists', () => {
  assert.equal(fs.existsSync(DOC_PATH), true);
});

test('P32: packaging promotion PR body template is declarative and evidence-linked only', () => {
  const text = fs.readFileSync(DOC_PATH, 'utf8');
  const normalized = text.toLowerCase();

  const requiredPhrases = [
    'post-v1 packaging promotion pull requests only',
    'repo-known acceptance and promotion surfaces only',
    'declarative and evidence-linked',
    'acceptance signoff',
    'release checklist',
    'operator runbook',
    'rollback note',
    'packaging evidence manifest',
    'acceptance pack index',
    'final acceptance gate',
    'promotion flow note',
    'does not claim deployment, rollout, publishing, release completion, or hosted availability',
  ];

  for (const phrase of requiredPhrases) {
    assert.match(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const requiredEvidencePaths = [
    'docs/releases/V1_ACCEPTANCE_SIGNOFF.md',
    'docs/releases/V1_RELEASE_CHECKLIST.md',
    'docs/releases/V1_OPERATOR_RUNBOOK.md',
    'docs/releases/V1_ROLLBACK.md',
    'docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json',
    'docs/releases/V1_ACCEPTANCE_PACK_INDEX.md',
    'ci/scripts/run_postv1_final_acceptance_gate.mjs',
    'docs/releases/V1_PROMOTION_FLOW.md',
  ];

  for (const file of requiredEvidencePaths) {
    assert.equal(fs.existsSync(file), true, `missing evidence-linked surface: ${file}`);
    assert.match(text, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const bannedPhrases = [
    'deploy to production',
    'production deployment',
    'publish release',
    'release is live',
    'go live',
    'customer rollout',
    'available to customers',
    'release completed',
    'app store',
    'play store',
  ];

  for (const phrase of bannedPhrases) {
    assert.doesNotMatch(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});