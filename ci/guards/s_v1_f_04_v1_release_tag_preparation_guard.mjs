// @law: Repo Governance
// @severity: medium
// @scope: repo
/*
 * DEV NOTE: S-V1-F-04 v1 release tag preparation guard.
 * Purpose: proves the tag-preparation record remains factual and that tag
 * creation is blocked until v1 acceptance and full fast gates pass.
 * Boundary: release documentation and package entrypoint coverage only. This
 * guard must not create tags, change package version, implement features, or
 * alter acceptance-gate law.
 * Failure behaviour: fails closed when required release docs, package scripts,
 * proof commands, or non-scope exclusions drift.
 */
import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_V1_RELEASE_TAG_PREPARATION_GUARD";
const GUARD = "s_v1_f_04_v1_release_tag_preparation_guard";
const ROOT = process.cwd();

const DOC_PATH = "docs/releases/V1_RELEASE_TAG_PREPARATION.md";
const JSON_PATH = "docs/releases/V1_RELEASE_TAG_PREPARATION.json";
const PACKAGE_PATH = "package.json";

const REQUIRED_EXISTING_FILES = [
  "docs/releases/V1_RELEASE_NOTES.md",
  "docs/releases/V1_VERSION_AND_TAG.md",
  "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json",
  "ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs",
  "scripts/release-prepare.ps1",
  "scripts/tag-release.ps1"
];

const REQUIRED_PROOF_COMMANDS = [
  "npm.cmd run acceptance:v1:check",
  "node --test test/s_v1_f_04_v1_release_tag_preparation.test.mjs",
  "node ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs",
  "node ci/guards/s_v1_09_failure_token_closure_guard.mjs",
  "node ci/guards/guards_entrypoint_coverage_guard.mjs",
  "npm.cmd run lint:fast"
];

const REQUIRED_TAG_BLOCKS = [
  "acceptance_check_not_passed",
  "full_fast_gate_not_passed",
  "dirty_working_tree",
  "current_commit_not_intended_main_commit",
  "candidate_tag_already_exists",
  "release_notes_or_version_tag_docs_missing",
  "operator_has_not_confirmed_candidate_tag"
];

const REQUIRED_NON_SCOPE_DENIALS = [
  "safety",
  "suitability",
  "effectiveness",
  "external approval",
  "certification",
  "athlete clearance",
  "coach clearance",
  "training approval",
  "outcome guarantee",
  "broad rollout permission",
  "enterprise launch permission"
];

function resolveRepoPath(filePath) {
  return path.join(ROOT, filePath);
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function readText(filePath) {
  const absolutePath = resolveRepoPath(filePath);
  if (!fs.existsSync(absolutePath)) {
    fail("required_file_missing", { filePath });
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    fail("json_parse_failed", { filePath, error: String(error?.message ?? error) });
  }
}

function assertIncludes(container, value, label) {
  if (!container.includes(value)) {
    fail("required_value_missing", { label, value });
  }
}

function assertEveryStringPresent(values, requiredValues, label) {
  if (!Array.isArray(values)) {
    fail("required_array_missing", { label });
  }

  for (const value of requiredValues) {
    if (!values.includes(value)) {
      fail("required_array_value_missing", { label, value });
    }
  }
}

for (const filePath of [DOC_PATH, JSON_PATH, PACKAGE_PATH, ...REQUIRED_EXISTING_FILES]) {
  if (!fs.existsSync(resolveRepoPath(filePath))) {
    fail("required_file_missing", { filePath });
  }
}

const docText = readText(DOC_PATH);
const record = readJson(JSON_PATH);
const pkg = readJson(PACKAGE_PATH);

if (record.slice_id !== "S-V1-F-04") {
  fail("slice_id_mismatch", { actual: record.slice_id });
}

if (record.record_state !== "preparation_only_not_tagged") {
  fail("record_state_mismatch", { actual: record.record_state });
}

if (record.candidate_tag !== "v1-controlled-launch") {
  fail("candidate_tag_mismatch", { actual: record.candidate_tag });
}

const boundary = record.authority_boundary ?? {};
const falseBoundaryKeys = [
  "creates_git_tag",
  "pushes_git_tag",
  "changes_package_version",
  "implements_feature",
  "changes_engine_behaviour",
  "changes_registry_content",
  "changes_acceptance_manifest",
  "activates_post_v1_scope",
  "creates_external_approval"
];

for (const key of falseBoundaryKeys) {
  if (boundary[key] !== false) {
    fail("authority_boundary_must_be_false", { key, actual: boundary[key] });
  }
}

for (const command of REQUIRED_PROOF_COMMANDS) {
  assertIncludes(record.required_proof_commands ?? [], command, "record.required_proof_commands");
}

assertEveryStringPresent(record.tag_block_conditions, REQUIRED_TAG_BLOCKS, "record.tag_block_conditions");
assertEveryStringPresent(record.unsupported_claims_must_not_state_or_imply, REQUIRED_NON_SCOPE_DENIALS, "record.unsupported_claims_must_not_state_or_imply");

if (record.completion_rule?.git_tag_created_by_this_slice !== false) {
  fail("completion_rule_must_not_create_tag", {
    actual: record.completion_rule?.git_tag_created_by_this_slice
  });
}

for (const phrase of [
  "This record prepares the v1 controlled-launch tag step",
  "This slice must not create a git tag",
  "The tag command remains blocked",
  "S-V1-F-04 is complete when"
]) {
  assertIncludes(docText, phrase, DOC_PATH);
}

const scripts = pkg.scripts ?? {};
for (const scriptName of ["release:prepare", "release:tag", "acceptance:v1:check", "lint:fast", "lint:fast:inline"]) {
  if (typeof scripts[scriptName] !== "string") {
    fail("required_package_script_missing", { scriptName });
  }
}

const f04TestCommand = "node --test test/s_v1_f_04_v1_release_tag_preparation.test.mjs";
const f04GuardCommand = "node ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs";
const f04ProofCommand = `${f04TestCommand} && ${f04GuardCommand}`;

if (scripts["proof:s-v1-f-04"] !== `npm run acceptance:v1:check && ${f04ProofCommand}`) {
  fail("proof_script_mismatch", {
    actual: scripts["proof:s-v1-f-04"]
  });
}

if (!scripts["lint:fast"].includes(f04ProofCommand)) {
  fail("lint_fast_missing_f04_entrypoint");
}

if (!scripts["lint:fast:inline"].includes(f04ProofCommand)) {
  fail("lint_fast_inline_missing_f04_entrypoint");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  checked: [
    DOC_PATH,
    JSON_PATH,
    PACKAGE_PATH,
    ...REQUIRED_EXISTING_FILES
  ],
  candidate_tag: record.candidate_tag,
  creates_git_tag: false
}, null, 2));
