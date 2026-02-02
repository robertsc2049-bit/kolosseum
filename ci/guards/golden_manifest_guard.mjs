import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function stripBom(s) {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256TextUtf8(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// IMPORTANT: This MUST be a 64-hex string. If this is empty, you previously broke the guard.
const PINNED_MANIFEST_SHA256 = "8027aea9d3bedb73d90080b18698f442510ddec44d9f22cdc87ecdd3944a3158";

function isHex64(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "test", "fixtures", "golden", "golden_manifest.v1.json");

if (!fs.existsSync(manifestPath)) {
  fail(`[ERR] Golden manifest missing: ${path.relative(repoRoot, manifestPath)}`);
}

if (!isHex64(PINNED_MANIFEST_SHA256)) {
  fail(
    `[ERR] PINNED_MANIFEST_SHA256 is invalid (must be 64-hex).\n` +
    `Current value: '${PINNED_MANIFEST_SHA256}'\n` +
    `Fix: regenerate manifest then pin the computed sha.`
  );
}

let text = fs.readFileSync(manifestPath, "utf8");
text = normalizeLf(stripBom(text));

const actual = sha256TextUtf8(text);
const expected = PINNED_MANIFEST_SHA256;

if (actual !== expected) {
  fail(
    `[ERR] Golden manifest SHA256 changed.\n` +
    `expected=${expected}\n` +
    `actual  =${actual}\n` +
    `If intentional: regenerate fixtures, then update PINNED_MANIFEST_SHA256 and commit.`
  );
}

console.log("[OK] Golden manifest guard passed (content + sha256 pinned).");