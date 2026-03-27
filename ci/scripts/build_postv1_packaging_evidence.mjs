import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('artifacts', 'postv1_packaging_evidence');

const declaredArtefacts = [
  'docs/releases/V1_RELEASE_NOTES.md',
  'docs/releases/V1_RELEASE_CHECKLIST.md',
  'docs/releases/V1_VERSION_AND_TAG.md',
  'docs/releases/V1_ROLLBACK.md',
  'docs/releases/V1_OPERATOR_RUNBOOK.md',
];

fs.rmSync(outDir, { recursive: true, force: true });

for (const sourcePath of declaredArtefacts) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing declared evidence artefact: ${sourcePath}`);
  }

  const destinationPath = path.join(outDir, sourcePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

console.log('POSTV1_PACKAGING_EVIDENCE_COLLECTED');