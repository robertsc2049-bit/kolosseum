// @law: Runtime Boundary
// @severity: high
// @scope: engine
// ci/guards/engine_contract_guard.mjs

// DEV NOTE: Engine contract pin guard. This script protects ENGINE_CONTRACT.md
// from accidental replacement or unreviewed drift by checking both required
// content phrases and a hard SHA-256 pin. Intentional contract changes must update
// the document and this guard together in the same reviewed change.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Contract failures should be readable in CI and PowerShell output rather than
 * surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

const repoRoot = process.cwd();
const p = path.join(repoRoot, "ENGINE_CONTRACT.md");

// DEV NOTE: The engine contract is mandatory release-boundary material.
// A missing file means the engine boundary cannot be reviewed or proven.
if (!fs.existsSync(p)) die(`\u274C Missing ENGINE_CONTRACT.md at ${p}`);

const buf = fs.readFileSync(p);
const txt = buf.toString("utf8");
const trimmed = txt.trim();

// DEV NOTE: Minimum size catches empty files, placeholders, and accidental
// truncation before the more specific phrase and hash checks run.
if (trimmed.length < 500) {
  die(`\u274C ENGINE_CONTRACT.md looks too small (${trimmed.length} chars). Refusing.`);
}

// DEV NOTE: Required phrase checks provide human-readable failure causes if the
// contract is replaced with unrelated content. They are a sanity layer, not a
// substitute for the SHA-256 pin below.
const mustContain = [
  "Kolosseum Engine Contract",
  "Phase 6",
  "stub contract",
  "Runner Flags",
  "CLI runner contract",
  "Determinism rules"
];

for (const s of mustContain) {
  if (!txt.includes(s)) die(`\u274C ENGINE_CONTRACT.md missing required phrase: ${JSON.stringify(s)}`);
}

// DEV NOTE: Hard lock for the exact approved ENGINE_CONTRACT.md bytes.
// Any intentional contract edit must update this value deliberately and commit
// the document plus guard change together.
const EXPECTED_SHA256 = "672F7464F94D7F2B0B3BE3ACFC418BE51DA1BBBEF2AB371F0056AEE6D1214F7C";

const actual = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();

// DEV NOTE: A hash mismatch is treated as contract drift even if phrase checks pass.
// Do not weaken this check to make CI green; review the contract change and update
// the pin only when the new bytes are intentionally accepted.
if (actual !== EXPECTED_SHA256) {
  die(
    [
      "\u274C ENGINE_CONTRACT.md SHA256 mismatch.",
      `   expected: ${EXPECTED_SHA256}`,
      `   actual:   ${actual}`,
      "",
      "If you intentionally changed ENGINE_CONTRACT.md, update EXPECTED_SHA256 in:",
      "  ci/guards/engine_contract_guard.mjs",
      "Then commit both changes together."
    ].join("\n")
  );
}

// DEV NOTE: Success means the current ENGINE_CONTRACT.md matches both the content
// sanity checks and the exact pinned SHA-256. It does not approve changes outside
// this contract file.
console.log("\u2705 Engine contract guard passed (content + sha256 pinned).");
