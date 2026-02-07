// ci/guards/engine_contract_guard.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const repoRoot = process.cwd();
const p = path.join(repoRoot, "ENGINE_CONTRACT.md");

if (!fs.existsSync(p)) die(`❌ Missing ENGINE_CONTRACT.md at ${p}`);

const buf = fs.readFileSync(p);
const txt = buf.toString("utf8");
const trimmed = txt.trim();

if (trimmed.length < 500) {
  die(`❌ ENGINE_CONTRACT.md looks too small (${trimmed.length} chars). Refusing.`);
}

// Content sanity: keeps accidental replacements from passing even if hash disabled later
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

// Hard lock: sha256 pin
const EXPECTED_SHA256 = "672A781F8BD5116B5DF56E824DDB4C5715CE713CE862D0010155343B8ED795A4";

const actual = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();

if (actual !== EXPECTED_SHA256) {
  die(
    [
      "❌ ENGINE_CONTRACT.md SHA256 mismatch.",
      `   expected: ${EXPECTED_SHA256}`,
      `   actual:   ${actual}`,
      "",
      "If you intentionally changed ENGINE_CONTRACT.md, update EXPECTED_SHA256 in:",
      "  ci/guards/engine_contract_guard.mjs",
      "Then commit both changes together."
    ].join("\n")
  );
}

console.log("✅ Engine contract guard passed (content + sha256 pinned).");
