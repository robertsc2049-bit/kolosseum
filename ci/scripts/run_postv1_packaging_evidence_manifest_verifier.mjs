import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join('artifacts', 'postv1_packaging_evidence');
const MANIFEST_PATH = 'docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json';

function listFilesRecursively(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        results.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Missing evidence manifest: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

if (manifest.name !== 'postv1_packaging_evidence') {
  console.error(`Unexpected manifest name: ${manifest.name}`);
  process.exit(1);
}

if (!Array.isArray(manifest.files)) {
  console.error('Manifest files field must be an array');
  process.exit(1);
}

const manifestFiles = [...manifest.files].sort();
const uniqueFiles = [...new Set(manifestFiles)].sort();

if (manifestFiles.length !== uniqueFiles.length) {
  console.error('Manifest files must be unique');
  process.exit(1);
}

for (const file of manifestFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Manifest references non-existent source evidence surface: ${file}`);
    process.exit(1);
  }
}

if (!fs.existsSync(OUT_DIR)) {
  console.error(`Missing evidence output folder: ${OUT_DIR}`);
  process.exit(1);
}

const actualFiles = listFilesRecursively(OUT_DIR);

if (JSON.stringify(manifestFiles) !== JSON.stringify(actualFiles)) {
  console.error('Evidence manifest does not match collected evidence output');
  process.exit(1);
}

console.log('POSTV1_PACKAGING_EVIDENCE_MANIFEST_VERIFIER_OK');