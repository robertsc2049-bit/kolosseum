// @law: Encoding Hygiene
// @severity: high
// @scope: repo
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import process from "node:process";

const ROOT = "engine/src/render";

// Common UTF-8 → CP1252 / CP437 mojibake sequences
// This list is intentionally conservative.
const MOJIBAKE_PATTERNS = [
  "Ã¢â‚¬â€", // em dash
  "Ã¢â‚¬â€œ", // en dash
  "Ã¢â‚¬Ëœ",
  "Ã¢â‚¬â„¢",
  "Ã¢â‚¬Å“",
  "Ã¢â‚¬Â",
  "Â ",       // stray nbsp / encoding leak
  "Â·",
  "Â—",
  "Â–",
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      walk(p, files);
    } else if (stat.isFile() && extname(p) === ".ts") {
      files.push(p);
    }
  }
  return files;
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const files = walk(ROOT);

  let violations = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    for (const pattern of MOJIBAKE_PATTERNS) {
      if (text.includes(pattern)) {
        violations.push({ file, pattern });
      }
    }
  }

  if (violations.length > 0) {
    console.error("❌ Mojibake detected in render layer:\n");

    for (const v of violations) {
      console.error(`- ${v.file}`);
      console.error(`  contains: "${v.pattern}"`);
    }

    console.error(
      "\nFix encoding at source. Do not rely on runtime console encoding."
    );
    process.exit(1);
  }

  console.log("OK: no_mojibake_guard");
}

main();
