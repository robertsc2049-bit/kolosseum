import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function stripBom(s) {
  return s && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

const repoRoot = process.cwd();
const goldenRoot = path.join(repoRoot, "test", "fixtures", "golden");
const manifestPath = path.join(goldenRoot, "golden_manifest.v1.json");

// [PINNED] update only when intentionally regenerating manifest + fixtures
const PINNED_MANIFEST_SHA256 = "24c60198cc3ea90c2f3e81da00ec09cdd560bad3542a57c20d5480c14f6c0090";

if (!fs.existsSync(goldenRoot)) die(`[ERR] Missing golden root at ${goldenRoot}`);
if (!fs.existsSync(manifestPath)) {
  die(
    `[ERR] Missing golden manifest at ${manifestPath}\n` +
      `Fix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

// Pin the manifest FILE BYTES (not just JSON content)
const manifestBytes = fs.readFileSync(manifestPath);
const manifestSha = sha256(manifestBytes);
if (manifestSha !== PINNED_MANIFEST_SHA256) {
  die(
    `[ERR] Golden manifest SHA256 changed.\n` +
      `expected=${PINNED_MANIFEST_SHA256}\n` +
      `actual  =${manifestSha}\n` +
      `If intentional: regenerate fixtures, then update PINNED_MANIFEST_SHA256 and commit.`
  );
}

let manifest;
try {
  manifest = JSON.parse(stripBom(manifestBytes.toString("utf8")));
} catch (e) {
  die(`[ERR] Failed to parse golden manifest JSON: ${manifestPath}\n${String(e)}`);
}

if (!manifest || typeof manifest !== "object") die("[ERR] golden_manifest.v1.json invalid root type");
if (manifest.manifest_version !== "1.0.0") {
  die(
    `[ERR] golden manifest_version mismatch: ${JSON.stringify(manifest.manifest_version)} (expected "1.0.0")`
  );
}

const files = Array.isArray(manifest.files) ? manifest.files : null;
if (!files || files.length < 10) {
  die(`[ERR] golden manifest files[] missing/too small (${files ? files.length : "null"})`);
}

const expectedDir = path.join(goldenRoot, "expected");
const inputsDir = path.join(goldenRoot, "inputs");

if (!fs.existsSync(expectedDir)) die(`[ERR] Missing expected dir: ${expectedDir}`);
if (!fs.existsSync(inputsDir)) die(`[ERR] Missing inputs dir: ${inputsDir}`);

function walkFiles(dirAbs, baseAbs) {
  const out = [];
  const stack = [dirAbs];
  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of ents) {
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.isFile()) out.push(path.relative(baseAbs, abs).replace(/\\/g, "/"));
    }
  }
  return out;
}

// IMPORTANT:
// - golden_manifest.v1.json pins expected/* + inputs/* only (per write_golden_manifest.mjs).
// - golden_outputs.v1.json is validated by golden_outputs_guard.mjs.
// So: disk set here MUST be expected/* + inputs/* only.
const diskRel = [
  ...walkFiles(expectedDir, goldenRoot),
  ...walkFiles(inputsDir, goldenRoot)
].filter(Boolean);

const diskRelSet = new Set(diskRel);
const manifestRelSet = new Set(files.map((f) => String((f && f.path) || "")));

const missingInManifest = [...diskRelSet].filter((p) => !manifestRelSet.has(p));
const extraInManifest = [...manifestRelSet].filter((p) => !diskRelSet.has(p));

if (missingInManifest.length) {
  die(
    `[ERR] Golden manifest missing file(s):\n` +
      missingInManifest.map((p) => `  - ${p}`).join("\n") +
      `\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

if (extraInManifest.length) {
  die(
    `[ERR] Golden manifest references non-existent file(s):\n` +
      extraInManifest.map((p) => `  - ${p}`).join("\n") +
      `\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

// Verify per-file SHA256s listed in manifest
const mismatches = [];
for (const f of files) {
  const rel = String((f && f.path) || "");
  const expected = String((f && f.sha256) || "");
  if (!rel || !expected) {
    mismatches.push({
      rel: rel || "(missing path)",
      expected: expected || "(missing sha256)",
      actual: "(n/a)"
    });
    continue;
  }

  const abs = path.join(goldenRoot, rel);
  if (!fs.existsSync(abs)) {
    mismatches.push({ rel, expected, actual: "(missing on disk)" });
    continue;
  }

  const actual = sha256(fs.readFileSync(abs));
  if (actual !== expected) mismatches.push({ rel, expected, actual });
}

if (mismatches.length) {
  die(
    `[ERR] Golden fixture drift detected (${mismatches.length} mismatch(es)).\n` +
      mismatches
        .slice(0, 30)
        .map((m) => `  - ${m.rel}\n    expected=${m.expected}\n    actual  =${m.actual}`)
        .join("\n") +
      `\nFix (intentional): node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/**/* test/fixtures/golden/golden_manifest.v1.json && git commit -m "test(golden): update fixtures + manifest"`
  );
}

console.log("[OK] Golden manifest guard passed (content + sha256 pinned).");