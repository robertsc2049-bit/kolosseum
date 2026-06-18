// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_V1_RUNBOOK";
const ROOT = process.cwd();

const REQUIRED_FILES = [
  "docs/ops/V1_RUNBOOK.md",
  "src/v1ControlledLaunchRunbook.mjs",
  "test/s_v1_o_04_runbook.test.mjs",
  "ci/guards/s_v1_o_04_runbook_guard.mjs"
];

const REQUIRED_DOC_NEEDLES = [
  "Slice: S-V1-O-04",
  "Status: Controlled-launch operations runbook",
  "This runbook is operational process only.",
  "It does not alter engine output.",
  "docs/v1/V1_STATUS_PAGE.md",
  "docs/v1/V1_ERROR_REPORTING_INITIALISATION.md",
  "docs/ops/V1_BACKUP_RESTORE_TEST.md",
  "operator_scope",
  "daily_start",
  "status_surface_check",
  "error_reporting_check",
  "backup_restore_reference",
  "incident_recording",
  "pause_conditions",
  "handover_record",
  "daily_close",
  "engine_mutation is true",
  "production_secret_value_accessed is true",
  "live_data_exported is true"
];

const REQUIRED_SOURCE_NEEDLES = [
  "createControlledLaunchRunbookRecord",
  "getControlledLaunchRunbookContract",
  "runbookEngineTruthProbe",
  "operator_scope",
  "status_surface_checked",
  "error_reporting_checked",
  "backup_restore_reference_checked",
  "engine_mutation",
  "production_secret_value_accessed",
  "live_data_exported"
];

const REQUIRED_TEST_NEEDLES = [
  "S-V1-O-04 exposes the controlled-launch runbook contract",
  "S-V1-O-04 accepts a complete factual runbook record",
  "S-V1-O-04 rejects forbidden operational effects",
  "S-V1-O-04 cannot mutate deterministic surfaces",
  "docs/ops/V1_RUNBOOK.md"
];

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

function readRequired(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    fail("CI_V1_RUNBOOK_FILE_MISSING", "Required S-V1-O-04 file is missing.", {
      path: relativePath
    });
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function assertIncludes(text, needle, relativePath) {
  if (!text.includes(needle)) {
    fail("CI_V1_RUNBOOK_REQUIRED_TEXT_MISSING", "Required S-V1-O-04 text is missing.", {
      path: relativePath,
      required: needle
    });
  }
}

function assertPackageScript() {
  const packageJson = JSON.parse(readRequired("package.json"));
  const scripts = packageJson.scripts || {};

  const proofScript = scripts["proof:s-v1-o-04"];
  const expectedProofScript = "node --test test/s_v1_o_04_runbook.test.mjs && node ci/guards/s_v1_o_04_runbook_guard.mjs";

  if (proofScript !== expectedProofScript) {
    fail("CI_V1_RUNBOOK_PACKAGE_PROOF_SCRIPT_MISSING", "S-V1-O-04 proof script is missing or incorrect.", {
      expected: expectedProofScript,
      actual: proofScript ?? null
    });
  }

  const lintFastInline = scripts["lint:fast:inline"];
  if (typeof lintFastInline !== "string" || !lintFastInline.includes(expectedProofScript)) {
    fail("CI_V1_RUNBOOK_LINT_FAST_INLINE_MISSING", "lint:fast:inline does not include the S-V1-O-04 proof commands.", {
      expected: expectedProofScript
    });
  }

  const lintFast = scripts["lint:fast"];
  if (typeof lintFast !== "string" || !lintFast.includes("ci/guards/s_v1_o_04_runbook_guard.mjs")) {
    fail("CI_V1_RUNBOOK_GUARD_ANCHOR_MISSING", "lint:fast does not anchor the S-V1-O-04 guard path.", {
      required: "ci/guards/s_v1_o_04_runbook_guard.mjs"
    });
  }
}

for (const relativePath of REQUIRED_FILES) {
  readRequired(relativePath);
}

const doc = readRequired("docs/ops/V1_RUNBOOK.md");
for (const needle of REQUIRED_DOC_NEEDLES) {
  assertIncludes(doc, needle, "docs/ops/V1_RUNBOOK.md");
}

const source = readRequired("src/v1ControlledLaunchRunbook.mjs");
for (const needle of REQUIRED_SOURCE_NEEDLES) {
  assertIncludes(source, needle, "src/v1ControlledLaunchRunbook.mjs");
}

const testFile = readRequired("test/s_v1_o_04_runbook.test.mjs");
for (const needle of REQUIRED_TEST_NEEDLES) {
  assertIncludes(testFile, needle, "test/s_v1_o_04_runbook.test.mjs");
}

assertPackageScript();

console.log(JSON.stringify({
  ok: true,
  guard: "s_v1_o_04_runbook_guard",
  token: TOKEN,
  files_checked: REQUIRED_FILES.length
}, null, 2));
