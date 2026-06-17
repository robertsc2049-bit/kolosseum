// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @law: Controlled Launch Operations
 * @severity: high
 * @scope: v1
 *
 * DEV NOTE:
 * Purpose: proves S-V1-O-03 has a fixture-only backup/restore dry-run contract, doc, test, and lint gate.
 * Boundary: operations evidence only; no engine imports, no env reads, no production connection use, and no live-data access.
 * Determinism: scans fixed repository files with stable string and regex checks.
 * Failure behaviour: emits a CI_V1_O_03_* token and non-zero process status when any required surface drifts.
 */

import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_V1_O_03_BACKUP_RESTORE";
const root = process.cwd();

const files = {
  doc: "docs/ops/V1_BACKUP_RESTORE_TEST.md",
  source: "src/v1BackupRestoreTest.mjs",
  test: "test/s_v1_o_03_backup_restore.test.mjs",
  packageJson: "package.json"
};

function readRequired(relPath) {
  const abs = path.join(root, relPath);

  if (!fs.existsSync(abs)) {
    fail("CI_V1_O_03_BACKUP_RESTORE_FILE_MISSING", `${relPath} is missing.`);
  }

  return fs.readFileSync(abs, "utf8");
}

function fail(failure_code, message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    token: TOKEN,
    failure_code,
    message,
    details
  }, null, 2));
  throw new Error(`${TOKEN}: ${message}`);
}

function assertIncludes(text, needle, token, relPath) {
  if (!text.includes(needle)) {
    fail(token, `${relPath} is missing required text.`, { needle });
  }
}

function assertNotMatches(text, pattern, token, relPath) {
  const match = text.match(pattern);

  if (match) {
    fail(token, `${relPath} contains forbidden text.`, { pattern: String(pattern), match: match[0] });
  }
}

const doc = readRequired(files.doc);
const source = readRequired(files.source);
const test = readRequired(files.test);
const packageJson = readRequired(files.packageJson);

const docRequiredText = [
  "Slice: S-V1-O-03",
  "fixture-only backup and restore dry-run evidence",
  "operational evidence only",
  "Data source is fixture_only.",
  "Target environment is ci_ephemeral.",
  "Production connection used is false.",
  "Live data used is false.",
  "Secret value accessed is false.",
  "Engine mutation is false.",
  "Restore integrity comparison is true.",
  "No additional step identifiers are accepted for this slice.",
  "It does not mean:"
];

for (const needle of docRequiredText) {
  assertIncludes(doc, needle, "CI_V1_O_03_BACKUP_RESTORE_DOC_INCOMPLETE", files.doc);
}

const claimTerms = [
  /\bmedical(?:ly)?\b/i,
  /\bsafe(?:r|ty)?\b/i,
  /\brisk\b/i,
  /\bsuitable\b/i,
  /\bsuitability\b/i,
  /\bready\b/i,
  /\breadiness\b/i,
  /\boptimal\b/i,
  /\boptimise\b/i,
  /\boptimize\b/i,
  /\brecommend(?:ed|ation|s)?\b/i,
  /\bguarantee(?:d)?\b/i,
  /\brecovery\b/i,
  /\brehab(?:ilitation)?\b/i
];

for (const pattern of claimTerms) {
  assertNotMatches(doc, pattern, "CI_V1_O_03_BACKUP_RESTORE_CLAIM_LANGUAGE", files.doc);
}

const forbiddenEngineTouchPatterns = [
  /from\s+["'][^"']*engine[^"']*["']/i,
  /import\s*\([^)]*engine[^)]*\)/i,
  /\bphase_?[1-8]\b/i,
  /\bruntime_event/i,
  /\bregistry_payload/i,
  /\bcanonical_input_hash\b/i
];

for (const [relPath, text] of Object.entries({ [files.doc]: doc, [files.source]: source, [files.test]: test })) {
  for (const pattern of forbiddenEngineTouchPatterns) {
    assertNotMatches(text, pattern, "CI_V1_O_03_BACKUP_RESTORE_FORBIDDEN_ENGINE_TOUCH", relPath);
  }
}

for (const [relPath, text] of Object.entries({ [files.source]: source, [files.test]: test })) {
  assertNotMatches(text, /\bprocess\.env\b/, "CI_V1_O_03_BACKUP_RESTORE_ENV_READ_FORBIDDEN", relPath);
  assertNotMatches(text, /\bDate\.now\b|\bnew Date\s*\(/, "CI_V1_O_03_BACKUP_RESTORE_TIME_DEPENDENCY", relPath);
}

const sourceRequiredText = [
  "assertBackupRestoreDryRunInput",
  "buildBackupRestoreDryRunEvidence",
  "getBackupRestoreDryRunContract",
  "fixture_only",
  "ci_ephemeral",
  "logical_dump_fixture",
  "throwaway_database",
  "backup_restore_secret_value_exposed",
  "backup_restore_engine_mutation_forbidden"
];

for (const needle of sourceRequiredText) {
  assertIncludes(source, needle, "CI_V1_O_03_BACKUP_RESTORE_CONTRACT_INCOMPLETE", files.source);
}

const testRequiredText = [
  "S-V1-O-03 accepts fixture-only backup restore dry-run evidence",
  "rejects production connections, live data, secret access, and engine mutation",
  "rejects secret-like values in string fields",
  "rejects undeclared fields and altered dry-run steps"
];

for (const needle of testRequiredText) {
  assertIncludes(test, needle, "CI_V1_O_03_BACKUP_RESTORE_TEST_INCOMPLETE", files.test);
}

const requiredPackageGate = "node --test test/s_v1_o_03_backup_restore.test.mjs && node ci/guards/s_v1_o_03_backup_restore_guard.mjs";
assertIncludes(packageJson, requiredPackageGate, "CI_V1_O_03_BACKUP_RESTORE_PACKAGE_GATE_MISSING", files.packageJson);

console.log(JSON.stringify({
  ok: true,
  slice_id: "S-V1-O-03",
  guard: "s_v1_o_03_backup_restore_guard"
}, null, 2));
