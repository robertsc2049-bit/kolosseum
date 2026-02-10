// @law: Contracts
// @severity: high
// @scope: repo
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(`❌ Repo contract failed: ${msg}`);
  process.exit(1);
}

const ROOT = process.cwd();

function readUtf8(p) {
  const abs = path.resolve(ROOT, p);
  if (!fs.existsSync(abs)) die(`missing required file: ${p}`);
  return fs.readFileSync(abs);
}

function hasBOM(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function checkNoBOM(p) {
  const buf = readUtf8(p);
  if (hasBOM(buf)) die(`${p} has UTF-8 BOM (must be UTF-8 without BOM)`);
  return buf.toString("utf8");
}

function checkNoMergeMarkers(p, text) {
  // Match real git conflict marker *lines*, not substrings in comments/banners.
  // <<<<<<< something
  // =======
  // >>>>>>> something
  const re = /^(<{7}.*|={7}\s*|>{7}.*)$/m;
  const m = text.match(re);
  if (m) die(`${p} contains merge conflict marker line: ${m[0].trim()}`);
}

function checkJsonParsable(p, text) {
  try {
    JSON.parse(text);
  } catch (e) {
    die(`${p} is not valid JSON: ${e?.message ?? String(e)}`);
  }
}

function checkRequiredScripts(pkg) {
  const scripts = pkg.scripts ?? {};
  const required = [
    "build",
    "test",
    "ci",
    "lint",
    "db:schema",
    "start",
    "smoke:fresh",
    "smoke:idem",
    "dev:check"
  ];
  const missing = required.filter((k) => !scripts[k]);
  if (missing.length) die(`package.json missing required scripts: ${missing.join(", ")}`);
}

function checkPathsExist() {
  const requiredPaths = [
    "schema.sql",
    "scripts/apply-schema.mjs",
    "scripts/schema-check.ps1",
    "scripts/smoke-api.ps1",
    "src",
    "engine",
    "ci"
  ];
  for (const p of requiredPaths) {
    const abs = path.resolve(ROOT, p);
    if (!fs.existsSync(abs)) die(`required path missing: ${p}`);
  }
}

// --- package.json contract ---
const pkgText = checkNoBOM("package.json");
checkNoMergeMarkers("package.json", pkgText);
checkJsonParsable("package.json", pkgText);

const pkg = JSON.parse(pkgText);
if (pkg.type !== "module") die(`package.json "type" must be "module"`);
checkRequiredScripts(pkg);

// --- known pain points: BOM + merge markers in key files ---
const toCheck = [
  "package.json",
  "tsconfig.json",
  "schema.sql",
  ".gitattributes",
  ".github/workflows/ci.yml"
];

for (const p of toCheck) {
  if (!fs.existsSync(path.resolve(ROOT, p))) continue;
  const text = checkNoBOM(p);
  checkNoMergeMarkers(p, text);
}

// --- filesystem contract ---
checkPathsExist();

console.log("✅ Repo contract guard passed.");
