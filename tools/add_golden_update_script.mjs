import fs from "node:fs";

const p = "package.json";
let b = fs.readFileSync(p);

// strip UTF-8 BOM if present
if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) b = b.slice(3);

const j = JSON.parse(b.toString("utf8"));
j.scripts = j.scripts || {};

// This script runs golden with UPDATE_GOLDEN=1, then regenerates manifest.
// Uses cross-platform env var setting via node (not shell-specific).
j.scripts["golden:update"] =
  "node tools/run_golden_update.mjs";

fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
console.log("package.json: added scripts.golden:update");