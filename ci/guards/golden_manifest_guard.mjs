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

function listJsonUnder(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function toPosixRel(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

const repoRoot = process.cwd();
const goldenRoot = path.join(repoRoot, "test", "fixtures", "golden");
const manifestPath = path.join(goldenRoot, "golden_manifest.v1.json");

// ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ PINNED: update only when intentionally regenerating manifest + fixtures
const PINNED_MANIFEST_SHA256="d1c7c9343ec14fd8e21bfc64886ee28a22ddc907acb557398025bc423b30c58b";

if (!fs.existsSync(goldenRoot)) die(`ÃƒÂ¢Ã‚ÂÃ…â€™ Missing golden root at ${goldenRoot}`);
if (!fs.existsSync(manifestPath)) {
  die(
    `ÃƒÂ¢Ã‚ÂÃ…â€™ Missing golden manifest at ${manifestPath}\n` +
      `Fix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

// Pin the manifest file bytes (not just JSON content)
const manifestBytes = fs.readFileSync(manifestPath);
const manifestSha = sha256(manifestBytes);
if (manifestSha !== PINNED_MANIFEST_SHA256) {
  die(
    `ÃƒÂ¢Ã‚ÂÃ…â€™ Golden manifest SHA256 changed.\n` +
      `expected=${PINNED_MANIFEST_SHA256}\n` +
      `actual  =${manifestSha}\n` +
      `If intentional: regenerate fixtures, then update PINNED_MANIFEST_SHA256 and commit.`
  );
}

let manifest;
try {
  manifest = JSON.parse(manifestBytes.toString("utf8"));
} catch (e) {
  die(`ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to parse golden manifest JSON: ${manifestPath}\n${String(e)}`);
}

if (!manifest || typeof manifest !== "object") die("ÃƒÂ¢Ã‚ÂÃ…â€™ golden_manifest.v1.json invalid root type");
if (manifest.manifest_version !== "1.0.0")
  die(`ÃƒÂ¢Ã‚ÂÃ…â€™ golden manifest_version mismatch: ${JSON.stringify(manifest.manifest_version)} (expected "1.0.0")`);

const files = Array.isArray(manifest.files) ? manifest.files : null;
if (!files || files.length < 10) die(`ÃƒÂ¢Ã‚ÂÃ…â€™ golden manifest files[] missing/too small (${files ? files.length : "null"})`);

const expectedDir = path.join(goldenRoot, "expected");
const inputsDir = path.join(goldenRoot, "inputs");
if (!fs.existsSync(expectedDir)) die(`ÃƒÂ¢Ã‚ÂÃ…â€™ Missing expected dir: ${expectedDir}`);
if (!fs.existsSync(inputsDir)) die(`ÃƒÂ¢Ã‚ÂÃ…â€™ Missing inputs dir: ${inputsDir}`);

const diskAbs = [...listJsonUnder(expectedDir), ...listJsonUnder(inputsDir)];
const diskRelSet = new Set(diskAbs.map((p) => toPosixRel(goldenRoot, p)));
const manifestRelSet = new Set(files.map((f) => String(f?.path ?? "")));

const missingInManifest = [...diskRelSet].filter((p) => !manifestRelSet.has(p));
const extraInManifest = [...manifestRelSet].filter((p) => !diskRelSet.has(p) && p !== "golden_manifest.v1.json");

if (missingInManifest.length) {
  die(
    `ÃƒÂ¢Ã‚ÂÃ…â€™ Golden manifest missing file(s):\n` +
      missingInManifest.map((p) => `  - ${p}`).join("\n") +
      `\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

if (extraInManifest.length) {
  die(
    `ÃƒÂ¢Ã‚ÂÃ…â€™ Golden manifest references non-existent file(s):\n` +
      extraInManifest.map((p) => `  - ${p}`).join("\n") +
      `\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

const mismatches = [];
for (const f of files) {
  const rel = String(f?.path ?? "");
  const expected = String(f?.sha256 ?? "");
  if (!rel || !expected) {
    mismatches.push({ rel: rel || "(missing path)", expected: expected || "(missing sha256)", actual: "(n/a)" });
    continue;
  }

  const abs = path.join(goldenRoot, ...rel.split("/"));
  if (!fs.existsSync(abs)) {
    mismatches.push({ rel, expected, actual: "(missing on disk)" });
    continue;
  }

  const actual = sha256(fs.readFileSync(abs));
  if (actual !== expected) mismatches.push({ rel, expected, actual });
}

if (mismatches.length) {
  const head = mismatches.slice(0, 10);
  die(
    `ÃƒÂ¢Ã‚ÂÃ…â€™ Golden fixture drift detected (${mismatches.length} mismatch(es)).\n` +
      head.map((m) => `  - ${m.rel}\n    expected=${m.expected}\n    actual  =${m.actual}`).join("\n") +
      `\nFix (intentional): node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/**/* test/fixtures/golden/golden_manifest.v1.json && git commit -m "test(golden): update fixtures + manifest"`
  );
}

console.log("ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Golden manifest guard passed (content + sha256 pinned).");










