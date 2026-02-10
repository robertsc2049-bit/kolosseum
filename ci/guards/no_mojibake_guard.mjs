// @law: Encoding Hygiene
// @severity: high
// @scope: repo
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import process from "node:process";

const ROOT = "engine/src/render";

// Common UTF-8 \u2192 CP1252 / CP437 mojibake sequences
// This list is intentionally conservative.
const MOJIBAKE_PATTERNS = [
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u20AC", // em dash
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u20AC\u0153", // en dash
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00CB\u0153",
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u201E\u00A2",
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00C5\u201C",
  "\u00C3\u00A2\u00E2\u201A\u00AC\u00C2",
  "\u00C2 ",       // stray nbsp / encoding leak
  "\u00C2\u00B7",
  "\u00C2\u2014",
  "\u00C2\u2013",
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
    console.error("\u274C Mojibake detected in render layer:\n");

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
