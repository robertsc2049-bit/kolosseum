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

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

function readTextUtf8Normalized(p) {
  const raw = fs.readFileSync(p, "utf8");
  return normalizeLf(stripBom(raw));
}

const repoRoot = process.cwd();
const goldenRoot = path.join(repoRoot, "test", "fixtures", "golden");
const outputsPath = path.join(goldenRoot, "golden_outputs.v1.json");
const outputsShaPath = path.join(goldenRoot, "golden_outputs.v1.sha256");

if (!fs.existsSync(goldenRoot)) die(`❌ Missing golden root at ${goldenRoot}`);
if (!fs.existsSync(outputsPath)) {
  die(
    `❌ Missing golden outputs at ${outputsPath}\n` +
      `Fix: node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}
if (!fs.existsSync(outputsShaPath)) {
  die(
    `❌ Missing golden outputs sha pin at ${outputsShaPath}\n` +
      `Fix: node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}

const pinned = readTextUtf8Normalized(outputsShaPath).trim().toLowerCase();
if (!/^[a-f0-9]{64}$/.test(pinned)) {
  die(`❌ Invalid pinned sha256 in ${outputsShaPath}: ${JSON.stringify(pinned)}`);
}

const bytes = fs.readFileSync(outputsPath);
const actual = sha256(bytes);

if (actual !== pinned) {
  die(
    `❌ Golden outputs SHA256 changed.\n` +
      `expected=${pinned}\n` +
      `actual  =${actual}\n` +
      `Fix (intentional): node ci/scripts/write_golden_outputs.mjs && git add test/fixtures/golden/golden_outputs.v1.*`
  );
}

let doc;
try {
  doc = JSON.parse(bytes.toString("utf8"));
} catch (e) {
  die(`❌ Failed to parse golden outputs JSON: ${outputsPath}\n${String(e)}`);
}

if (!doc || typeof doc !== "object") die("❌ golden_outputs.v1.json invalid root type");
if (doc.outputs_version !== "1.0.0") die(`❌ outputs_version mismatch: ${JSON.stringify(doc.outputs_version)} (expected "1.0.0")`);

const map = doc.output_sha256_by_fixture;
if (!map || typeof map !== "object") die("❌ output_sha256_by_fixture missing/invalid");

const keys = Object.keys(map).sort();
if (keys.length < 1) die("❌ output_sha256_by_fixture empty");

for (const k of keys) {
  const v = String(map[k] ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(v)) die(`❌ Invalid sha256 for fixture ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
}

console.log("✅ Golden outputs guard passed (content + sha256 pinned).");