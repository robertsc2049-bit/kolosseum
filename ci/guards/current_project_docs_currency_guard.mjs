// @law: Repo Governance
// @severity: medium
// @scope: docs

/**
 * DEV NOTE: ADMIN-03 current documentation currency guard.
 *
 * Purpose: keep docs/product/CURRENT_PROJECT_DOCS_STATUS.md usable as a current
 * working reference without turning it into product, engine, registry, release,
 * legal, commercial, or CI authority.
 *
 * This guard intentionally does not compare against the latest PR number. It
 * blocks the obsolete PR-baseline pattern itself, verifies the minimum current
 * authority/evidence pointers, and rejects known mojibake byte signatures in the
 * target document.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const targetRel = "docs/product/CURRENT_PROJECT_DOCS_STATUS.md";
const targetPath = path.join(repoRoot, targetRel);
const TOKEN = "CURRENT_PROJECT_DOCS_CURRENCY_GUARD";

function fail(message) {
  console.error(`${TOKEN}: FAIL ${message}`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  fail(`missing ${targetRel}`);
}

const bytes = fs.readFileSync(targetPath);
const text = bytes.toString("utf8");

// DEV NOTE: The old status document treated one finite PR sequence as the
// definition of current main. Block that structure rather than chasing whatever
// the newest PR happens to be.
if (/Current main includes work through:/u.test(text)) {
  fail("obsolete current-main PR-baseline heading is still present");
}

if (/PR #629/u.test(text)) {
  fail("obsolete PR #629 baseline marker is still present");
}

const requiredMarkers = [
  "Status: current working reference",
  "## 2. Document classes and authority",
  "### 2.1 Canonical authority",
  "### 2.2 Current working reference",
  "### 2.3 Historical documents and evidence",
  "### 2.4 Superseded documents",
  "### 2.5 Attached legacy documents",
  "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  "product/ui/function_manifest.json",
  "docs/product/FULL_UI_GAP_REPORT.md",
  "ci/evidence/reg_full_09_final_registry_acceptance.v1.json",
  "powerlifting",
  "general_strength",
  "rugby_union",
  "strongman",
  "org_owner_attendance_events",
  "notification_attendance_event",
  "npm run verify",
  "npm.cmd run verify",
  "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md",
];

for (const marker of requiredMarkers) {
  if (!text.includes(marker)) {
    fail(`missing required current-state marker: ${marker}`);
  }
}

// DEV NOTE: Keep this source ASCII-only. The byte signatures below represent
// common mojibake forms seen when UTF-8 punctuation is decoded and re-encoded
// incorrectly. The first two are malformed em/en dash forms; the remainder cover
// common quote and stray Latin-1 marker corruption.
const mojibakeNeedles = [
  ["malformed_em_dash", "c3a2e282ace2809d"],
  ["malformed_en_dash", "c3a2e282ace2809c"],
  ["malformed_right_quote", "c3a2e282ace284a2"],
  ["malformed_left_quote", "c3a2e282acc593"],
  ["stray_nbsp_marker", "c382c2a0"],
].map(([name, hex]) => ({ name, needle: Buffer.from(hex, "hex") }));

for (const { name, needle } of mojibakeNeedles) {
  if (bytes.indexOf(needle) >= 0) {
    fail(`known encoding corruption detected: ${name}`);
  }
}

console.log(`${TOKEN}: PASS current project documentation currency markers are valid`);
