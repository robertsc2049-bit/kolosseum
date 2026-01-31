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

if (!fs.existsSync(goldenRoot)) die(`❌ Missing golden root at ${goldenRoot}`);
if (!fs.existsSync(manifestPath)) {
  die(`❌ Missing golden manifest at ${manifestPath}\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (e) {
  die(`❌ Failed to parse golden manifest JSON: ${manifestPath}\n${String(e)}`);
}

if (!manifest || typeof manifest !== "object") die("❌ golden_manifest.v1.json invalid root type");
if (manifest.manifest_version !== "1.0.0") die(`❌ golden manifest_version mismatch: ${JSON.stringify(manifest.manifest_version)} (expected "1.0.0")`);

const files = Array.isArray(manifest.files) ? manifest.files : null;
if (!files || files.length < 10) die(`❌ golden manifest files[] missing/too small (${files ? files.length : "null"})`);

const expectedDir = path.join(goldenRoot, "expected");
const inputsDir = path.join(goldenRoot, "inputs");
if (!fs.existsSync(expectedDir)) die(`❌ Missing expected dir: ${expectedDir}`);
if (!fs.existsSync(inputsDir)) die(`❌ Missing inputs dir: ${inputsDir}`);

const diskAbs = [
  ...listJsonUnder(expectedDir),
  ...listJsonUnder(inputsDir),
];

const diskRelSet = new Set(diskAbs.map((p) => toPosixRel(goldenRoot, p)));
const manifestRelSet = new Set(files.map((f) => String(f?.path ?? "")));

const missingInManifest = [...diskRelSet].filter((p) => !manifestRelSet.has(p));
const extraInManifest = [...manifestRelSet].filter((p) => !diskRelSet.has(p) && p !== "golden_manifest.v1.json");

if (missingInManifest.length) {
  die(
    `❌ Golden manifest missing file(s):\n` +
    missingInManifest.map((p) => `  - ${p}`).join("\n") +
    `\nFix: node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json`
  );
}

if (extraInManifest.length) {
  die(
    `❌ Golden manifest references non-existent file(s):\n` +
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
    `❌ Golden fixture drift detected (${mismatches.length} mismatch(es)).\n` +
    head.map((m) => `  - ${m.rel}\n    expected=${m.expected}\n    actual  =${m.actual}`).join("\n") +
    `\nFix (intentional): node ci/scripts/write_golden_manifest.mjs && git add test/fixtures/golden/golden_manifest.v1.json test/fixtures/golden/**/* && git commit -m "test(golden): update fixtures + manifest"`
  );
}

console.log("✅ Golden manifest guard passed.");