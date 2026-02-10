import fs from "node:fs";
import { writeRepoTextSync } from "../scripts/repo_io.mjs";

const path = "ENGINE_CONTRACT.md";
let s = fs.readFileSync(path, "utf8");

// Fix common UTF-8-as-Windows1252 mojibake sequences.
// Use explicit Unicode escapes so your shell/editor encoding cannot break the script.
const fixes = new Map([
  // → (right arrow)
  ["\u00E2\u2020\u2019", "→"],

  // — (em dash)
  ["\u00E2\u20AC\u201D", "—"],

  // “ (left double quote)
  ["\u00E2\u20AC\u0153", "“"],

  // ” (right double quote) — cover both common variants
  ["\u00E2\u20AC\u009D", "”"],
  ["\u00E2\u20AC\u009C", "“"],

  // ‘ ’ (single quotes)
  ["\u00E2\u20AC\u02DC", "‘"],
  ["\u00E2\u20AC\u2122", "’"],
]);

for (const [bad, good] of fixes) s = s.split(bad).join(good);

// Write UTF-8 without BOM (Node does not add BOM)
writeRepoTextSync(path, s);

console.log("ENGINE_CONTRACT.md fixed (mojibake -> unicode), written as UTF-8 (no BOM).");