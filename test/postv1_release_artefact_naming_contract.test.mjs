import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DOC_PATH = 'docs/releases/V1_RELEASE_ARTEFACT_NAMING_CONTRACT.md';

test('P36: release artefact naming contract exists', () => {
  assert.equal(fs.existsSync(DOC_PATH), true);
});

test('P36: release artefact naming contract stays deterministic and current-surface only', () => {
  const text = fs.readFileSync(DOC_PATH, 'utf8');
  const normalized = text.toLowerCase();

  const requiredPhrases = [
    'standardises naming for current release documents, pack files, and evidence outputs',
    'uses the `v1_` prefix',
    'uppercase words with underscore separators',
    'lowercase descriptive names with underscore separators',
    'deterministic and current-surface only',
    'does not define future artefact families, external packaging names, publishing names, or deployment names',
  ];

  for (const phrase of requiredPhrases) {
    assert.match(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const requiredSurfaces = [
    'V1_RELEASE_NOTES.md',
    'V1_RELEASE_CHECKLIST.md',
    'V1_VERSION_AND_TAG.md',
    'V1_ROLLBACK.md',
    'V1_OPERATOR_RUNBOOK.md',
    'V1_ACCEPTANCE_SIGNOFF.md',
    'V1_ACCEPTANCE_PACK_INDEX.md',
    'V1_PROMOTION_FLOW.md',
    'V1_MAINLINE_GREEN_RUN_EVIDENCE.md',
    'V1_PACKAGING_EVIDENCE_MANIFEST.json',
    'artifacts/postv1_packaging_evidence',
  ];

  for (const token of requiredSurfaces) {
    assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const bannedPhrases = [
    'v2_',
    'future release family',
    'deploy package name',
    'published artefact name',
    'customer download name',
    'app store package',
    'play store package',
    'production bundle name',
  ];

  for (const phrase of bannedPhrases) {
    assert.doesNotMatch(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});