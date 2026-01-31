import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const repoRoot = process.cwd();
const p = path.join(repoRoot, "ENGINE_CONTRACT.md");

if (!fs.existsSync(p)) die(`❌ Missing ENGINE_CONTRACT.md at ${p}`);

const txt = fs.readFileSync(p, "utf8");
const trimmed = txt.trim();

if (trimmed.length < 500) {
  die(`❌ ENGINE_CONTRACT.md looks too small (${trimmed.length} chars). Refusing.`);
}

const mustContain = [
  "Kolosseum Engine Contract",
  "Phase 6",
  "stub contract",
  "Runner Flags",
  "CLI runner contract",
  "Determinism rules"
];

for (const s of mustContain) {
  if (!txt.includes(s)) die(`❌ ENGINE_CONTRACT.md missing required phrase: ${JSON.stringify(s)}`);
}

console.log("✅ Engine contract guard passed.");