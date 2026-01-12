import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const docsDir = path.resolve("docs");
const checksumFile = path.join(docsDir, "checksums.sha256");

if (!fs.existsSync(checksumFile)) {
  console.error("CI_CHECKSUM_PLACEHOLDER: docs/checksums.sha256 missing");
  process.exit(1);
}

const lines = fs.readFileSync(checksumFile, "utf8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

let failed = false;
for (const line of lines) {
  const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
  if (!m) {
    console.error(`CI_MANIFEST_MISMATCH: invalid checksum line: ${line}`);
    failed = true;
    continue;
  }
  const [, expected, file] = m;
  const p = path.join(docsDir, file);
  if (!fs.existsSync(p)) {
    console.error(`CI_SPINE_MISSING_DOC: checksum references missing file docs/${file}`);
    failed = true;
    continue;
  }
  const bytes = fs.readFileSync(p);
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    console.error(`CI_MANIFEST_MISMATCH: sha256 mismatch for ${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("sha256_guard: OK");
