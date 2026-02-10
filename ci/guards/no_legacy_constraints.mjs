// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Only allow legacy keys in these explicit negative test fixtures.
// Keep this list tiny and intentional.
const ALLOWLIST = new Set([
  "test/fixtures/golden/inputs/neg_phase1_constraints_legacy_ids_refused.json",
]);

// Legacy keys we never want in real inputs/contracts.
// Add more here if you have additional deprecated keys.
const LEGACY_KEYS = [
  "banned_equipment_ids",
  "available_equipment_ids",
  "required_equipment_ids",
  "banned_exercise_ids",
  "allowed_exercise_ids",
];

const FILE_EXTS = new Set([
  ".json",
  ".js",
  ".mjs",
  ".ts",
  ".tsx",
]);

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isSkippableDir(absPath) {
  const base = path.basename(absPath);
  return SKIP_DIRS.has(base);
}

function walk(absDir, out) {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      if (isSkippableDir(abs)) continue;
      walk(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!FILE_EXTS.has(ext)) continue;
    out.push(abs);
  }
}

function scanFile(absFile) {
  const rel = toPosix(path.relative(ROOT, absFile));
  if (ALLOWLIST.has(rel)) return [];

  let text;
  try {
    text = fs.readFileSync(absFile, "utf8");
  } catch {
    return [];
  }

  const hits = [];
  for (const k of LEGACY_KEYS) {
    // Match JSON-ish key usage: "key":
    const re = new RegExp(`"${k}"\\s*:`, "g");
    if (re.test(text)) hits.push(k);
  }

  return hits.map((k) => ({ key: k, rel }));
}

function main() {
  const files = [];
  walk(ROOT, files);

  const offenders = [];
  for (const f of files) {
    offenders.push(...scanFile(f));
  }

  if (offenders.length) {
    console.error("\n❌ Legacy constraint keys detected:\n");
    for (const o of offenders) {
      console.error(`- ${o.key} → ${o.rel}`);
    }
    console.error("\nCanonical constraint contract violated. Build blocked.\n");
    process.exit(1);
  }

  process.exit(0);
}

main();