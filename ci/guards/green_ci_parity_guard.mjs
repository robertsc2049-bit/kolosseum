import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function listYamlFiles(dirAbs) {
  if (!exists(dirAbs)) return [];
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => n.toLowerCase().endsWith(".yml") || n.toLowerCase().endsWith(".yaml"))
    .map((n) => path.join(dirAbs, n));
}

const repo = process.cwd();
const pkgPath = path.join(repo, "package.json");
if (!exists(pkgPath)) die("green_ci_parity_guard: package.json missing (run from repo root)");

let pkg;
try {
  pkg = JSON.parse(readUtf8(pkgPath));
} catch (e) {
  die("green_ci_parity_guard: failed to parse package.json: " + String(e));
}

const scripts = (pkg && pkg.scripts) || {};
const hasGreen = Object.prototype.hasOwnProperty.call(scripts, "green");

if (!hasGreen) {
  console.log("OK: green_ci_parity_guard (no scripts.green; skipping)");
  process.exit(0);
}

const wfDir = path.join(repo, ".github", "workflows");
const ymls = listYamlFiles(wfDir);

if (ymls.length === 0) {
  die("green_ci_parity_guard: scripts.green exists but no workflow YAML files found in .github/workflows");
}

const needle = /npm\s+run\s+green:ci\b/;
let hitFile = "";

for (const f of ymls) {
  const txt = readUtf8(f);
  if (needle.test(txt)) {
    hitFile = path.relative(repo, f);
    break;
  }
}

if (!hitFile) {
  die("green_ci_parity_guard: scripts.green exists but CI does not invoke 'npm run green:ci' in any workflow YAML");
}

console.log("OK: green_ci_parity_guard (workflow invokes green:ci: " + hitFile + ")");
