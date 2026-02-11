import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
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

function readTextUtf8Normalized(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  return normalizeLf(stripBom(raw));
}

function listFilesRecursiveSorted(absDir) {
  if (!fs.existsSync(absDir)) return [];
  const out = [];

  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else out.push(p);
    }
  };

  walk(absDir);
  return out;
}

function relPosix(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

function writeUtf8NoBomLf(absPath, text) {
  const normalized = normalizeLf(text);
  fs.writeFileSync(absPath, normalized, { encoding: "utf8" });
}

function main() {
  const repoRoot = process.cwd();
  const goldenRoot = path.join(repoRoot, "test", "fixtures", "golden");

  const inputsDir = path.join(goldenRoot, "inputs");
  const expectedDir = path.join(goldenRoot, "expected");
  const manifestPath = path.join(goldenRoot, "golden_manifest.v1.json");

  fs.mkdirSync(inputsDir, { recursive: true });
  fs.mkdirSync(expectedDir, { recursive: true });

  const filesAbs = [
    ...listFilesRecursiveSorted(inputsDir),
    ...listFilesRecursiveSorted(expectedDir),
  ];

  // Only track .json files, deterministic order
  const jsonAbs = filesAbs
    .filter((p) => path.extname(p).toLowerCase() === ".json")
    .slice()
    .sort((a, b) => relPosix(repoRoot, a).localeCompare(relPosix(repoRoot, b)));

  const files = [];
  for (const abs of jsonAbs) {
    const rel = relPosix(repoRoot, abs);
    const text = readTextUtf8Normalized(abs);
    const sha256 = sha256TextUtf8(text);
    files.push({ path: rel, sha256 });
  }

  const manifest = {
    version: "1.0.0",
    files
  };

  const text = JSON.stringify(manifest, null, 2) + "\n";
  writeUtf8NoBomLf(manifestPath, text);

  console.log(`OK: Wrote ${relPosix(repoRoot, manifestPath)} (${files.length} file(s))`);
}

main();
