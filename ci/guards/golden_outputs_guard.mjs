// @law: Determinism
// @severity: high
// @scope: repo

// DEV NOTE: Golden outputs pin guard. This script protects deterministic golden
// output proof by checking golden_outputs.v1.json against its pinned SHA-256 file
// and then validating the expected JSON contract shape. Intentional output changes
// must regenerate the golden outputs and SHA pin together.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Golden-output failures should be readable in CI and PowerShell output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Hash raw file bytes with SHA-256.
 * The golden outputs JSON is pinned by exact bytes, not by parsed/reformatted
 * object content, so accidental whitespace or ordering drift is caught.
 */
function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * DEV NOTE: Normalise line endings for reading the separate SHA pin file.
 * The pin is a text control file; line-ending differences should not change the
 * expected hash value read from it.
 */
function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * DEV NOTE: Strip a UTF-8 BOM from the SHA pin text before validation.
 * The outputs JSON itself is hashed as bytes; only the pin file is normalised.
 */
function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

/**
 * DEV NOTE: Read UTF-8 text and apply the pin-file normalisation rules.
 * Use this only for text control files, not for the golden output bytes being
 * protected by the content hash.
 */
function readTextUtf8Normalized(p) {
  const raw = fs.readFileSync(p, "utf8");
  return normalizeLf(stripBom(raw));
}

const repoRoot = process.cwd();
const goldenRoot = path.join(repoRoot, "test", "fixtures", "golden");
const outputsPath = path.join(goldenRoot, "golden_outputs.v1.json");
const outputsShaPath = path.join(goldenRoot, "golden_outputs.v1.sha256");

// DEV NOTE: The golden root and both golden output artefacts are mandatory for
// deterministic output proof. Missing artefacts must be regenerated through the
// approved writer script rather than bypassed.
if (!fs.existsSync(goldenRoot)) die(`\u274C Missing golden root at ${goldenRoot}`);
if (!fs.existsSync(outputsPath)) {
  die(
    `\u274C Missing golden outputs at ${outputsPath}\n` +
      `Fix: node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}
if (!fs.existsSync(outputsShaPath)) {
  die(
    `\u274C Missing golden outputs sha pin at ${outputsShaPath}\n` +
      `Fix: node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}

// DEV NOTE: The pinned hash file must contain exactly a valid SHA-256 value after
// text normalisation. A malformed pin means the proof surface itself has drifted.
const pinned = readTextUtf8Normalized(outputsShaPath).trim().toLowerCase();
if (!/^[a-f0-9]{64}$/.test(pinned)) {
  die(`\u274C Invalid pinned sha256 in ${outputsShaPath}: ${JSON.stringify(pinned)}`);
}

const bytes = fs.readFileSync(outputsPath);
const actual = sha256(bytes);

// DEV NOTE: A hash mismatch means golden_outputs.v1.json changed at byte level.
// Do not weaken this guard; regenerate outputs, review the diff, and commit the
// updated JSON plus .sha256 pin only when the change is intentional.
if (actual !== pinned) {
  die(
    `\u274C Golden outputs SHA256 changed.\n` +
      `expected=${pinned}\n` +
      `actual  =${actual}\n` +
      `Fix (intentional): node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}

let doc;
try {
  doc = JSON.parse(bytes.toString("utf8"));
} catch (e) {
  die(`\u274C Failed to parse golden outputs JSON: ${outputsPath}\n${String(e)}`);
}

// DEV NOTE: Shape checks run after the byte pin so a matching file also proves the
// expected machine-readable contract: version marker plus fixture-to-output hash map.
if (!doc || typeof doc !== "object") die("\u274C golden_outputs.v1.json invalid root type");
if (doc.outputs_version !== "1.0.0") die(`\u274C outputs_version mismatch: ${JSON.stringify(doc.outputs_version)} (expected "1.0.0")`);

const map = doc.output_sha256_by_fixture;
if (!map || typeof map !== "object") die("\u274C output_sha256_by_fixture missing/invalid");

const keys = Object.keys(map).sort();
if (keys.length < 1) die("\u274C output_sha256_by_fixture empty");

// DEV NOTE: Each fixture entry must map to a valid SHA-256 output hash.
// Sorting keys makes validation order deterministic for stable failure behaviour.
for (const k of keys) {
  const v = String(map[k] ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(v)) die(`\u274C Invalid sha256 for fixture ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
}

// DEV NOTE: Success means the golden outputs file matches its byte pin and carries
// the expected fixture-hash map shape. It does not approve unrelated fixture or
// engine behaviour changes outside this golden output surface.
console.log("\u2705 Golden outputs guard passed (content + sha256 pinned).");
