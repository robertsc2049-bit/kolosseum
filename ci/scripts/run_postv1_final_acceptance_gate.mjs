import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ACCEPTANCE_SURFACES = [
  'docs/releases/V1_ACCEPTANCE_SIGNOFF.md',
  'docs/releases/V1_RELEASE_CHECKLIST.md',
  'docs/releases/V1_OPERATOR_RUNBOOK.md',
  'docs/releases/V1_ROLLBACK.md',
  'docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json',
  'docs/releases/V1_ACCEPTANCE_PACK_INDEX.md',
];

const PROVEN_INTERNAL_SURFACES = [
  'ci/scripts/build_postv1_packaging_evidence.mjs',
  'ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs',
];

function requireExistingFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing required internal acceptance surface: ${filePath}`);
    process.exit(1);
  }
}

function runNodeSurface(scriptPath, expectedMarker) {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Failed internal surface: ${scriptPath}`);
    process.exit(result.status ?? 1);
  }

  if (!result.stdout.includes(expectedMarker)) {
    console.error(`Internal surface did not emit expected marker ${expectedMarker}: ${scriptPath}`);
    process.exit(1);
  }

  process.stdout.write(result.stdout);
}

for (const filePath of ACCEPTANCE_SURFACES) {
  requireExistingFile(filePath);
}

for (const scriptPath of PROVEN_INTERNAL_SURFACES) {
  requireExistingFile(scriptPath);
}

runNodeSurface(
  'ci/scripts/build_postv1_packaging_evidence.mjs',
  'POSTV1_PACKAGING_EVIDENCE_COLLECTED',
);

runNodeSurface(
  'ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs',
  'POSTV1_PACKAGING_EVIDENCE_MANIFEST_VERIFIER_OK',
);

console.log('POSTV1_FINAL_ACCEPTANCE_GATE_GREEN');