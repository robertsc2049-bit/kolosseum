// @law: Determinism
// @severity: high
// @scope: repo

// DEV NOTE: Golden manifest pin guard. This script protects the deterministic
// golden fixture manifest from unreviewed drift by hashing the normalised manifest
// bytes and comparing them to a pinned SHA-256 value. Intentional fixture changes
// must update the manifest and this pin together.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Golden-manifest failures should be readable in CI and PowerShell output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Strip a UTF-8 BOM if present before hashing.
 * The manifest content contract is about semantic text after BOM removal, while
 * separate encoding guards handle preventing BOM drift in changed files.
 */
function stripBom(s) {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

/**
 * DEV NOTE: Normalise all line endings to LF before hashing so the manifest pin is
 * stable across Windows and CI checkouts.
 */
function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * DEV NOTE: Hash normalised UTF-8 text using SHA-256.
 * This produces the deterministic comparison value used by the pinned manifest
 * contract below.
 */
function sha256TextUtf8(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// DEV NOTE: This must stay a valid 64-character lowercase hex SHA-256 string.
// An empty or malformed value means the guard has been broken rather than updated.
const PINNED_MANIFEST_SHA256 = "1b5dd13c6119ee5aec7114fc3712a5e0d735fbbdcb1fdaf9f3fa34f24dee9558";

/**
 * DEV NOTE: Validate SHA-256 pin shape before comparing content.
 * Failing early here catches accidental blanking, truncation, or non-hash edits to
 * the guard itself.
 */
function isHex64(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "test", "fixtures", "golden", "golden_manifest.v1.json");

// DEV NOTE: The golden manifest is mandatory for deterministic fixture proof.
// Missing manifest means the pinned golden surface cannot be verified.
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

// DEV NOTE: Any mismatch means the golden manifest content changed after
// normalisation. Do not weaken this guard; regenerate fixtures, review the change,
// then update the pinned SHA only when the new manifest is intentionally accepted.
if (actual !== expected) {
  fail(
    `[ERR] Golden manifest SHA256 changed.\n` +
    `expected=${expected}\n` +
    `actual  =${actual}\n` +
    `If intentional: regenerate fixtures, then update PINNED_MANIFEST_SHA256 and commit.`
  );
}

// DEV NOTE: Success means the current normalised golden manifest matches the
// pinned SHA-256. It does not approve behaviour outside the manifest contents.
console.log("[OK] Golden manifest guard passed (content + sha256 pinned).");
