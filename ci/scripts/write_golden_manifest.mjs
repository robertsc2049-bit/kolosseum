import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function repoRoot() {
  return process.cwd();
}

function posixRel(from, to) {
  const rel = path.relative(from, to);
  return rel.split(path.sep).join("/");
}

function sha256File(p) {
  const buf = fs.readFileSync(p);
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

const root = repoRoot();
const goldenRoot = path.join(root, "test", "fixtures", "golden");
const manifestPath = path.join(goldenRoot, "golden_manifest.v1.json");

const expectedDir = path.join(goldenRoot, "expected");
const inputsDir = path.join(goldenRoot, "inputs");

if (!fs.existsSync(goldenRoot)) throw new Error(`Missing golden root: ${goldenRoot}`);
if (!fs.existsSync(expectedDir)) throw new Error(`Missing expected dir: ${expectedDir}`);
if (!fs.existsSync(inputsDir)) throw new Error(`Missing inputs dir: ${inputsDir}`);

const files = [
  ...listJsonUnder(expectedDir),
  ...listJsonUnder(inputsDir),
].map((abs) => {
  const rel = posixRel(goldenRoot, abs);
  return { path: rel, sha256: sha256File(abs) };
});

const manifest = {
  manifest_version: "1.0.0",
  generated_utc: new Date().toISOString(),
  root: "test/fixtures/golden",
  files
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`✅ Wrote ${posixRel(root, manifestPath)} (${files.length} file(s))`);