import fs from 'node:fs';

const path = 'docs/releases/V1_RELEASE_NOTES.md';
const text = fs.readFileSync(path, 'utf8');

const requiredSections = [
  '## Release identity',
  '## Scope statement',
  '## Included scope',
  '## Explicit non-claims',
  '## Evidence basis'
];

for (const required of requiredSections) {
  if (!text.includes(required)) {
    console.error('Missing release-claim section: ' + required);
    process.exit(1);
  }
}

if (!/merged scope on main only/i.test(text)) {
  console.error('Missing merged-scope boundary in release notes.');
  process.exit(1);
}

console.log('RELEASE_CLAIM_VALIDATOR_OK');