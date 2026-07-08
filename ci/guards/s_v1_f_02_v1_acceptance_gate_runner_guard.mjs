// @law: Repo Governance
// @severity: medium
// @scope: repo
/*
 * @law v1_acceptance_gate_runner
 * @severity high
 * @scope v1-acceptance
 * DEV NOTE: S-V1-F-02 acceptance gate runner guard.
 * Purpose: proves the final v1 acceptance manifest and runner exist, name exact
 * commands, and block v1 completion unless every required gate passes.
 * Boundary: manifest, runner, docs, package wiring, and generated index proof
 * only. It does not create product law, engine law, registry law, workflow law,
 * production-data authority, or post-v1 scope.
 * Failure behaviour: fails closed on missing gates, missing exact commands,
 * non-scope activation, missing package scripts, or missing target proof files.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const TOKEN = "CI_V1_ACCEPTANCE_GATE_RUNNER";

const MANIFEST_PATH = "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json";
const RUNNER_DOC_PATH = "docs/v1/V1_ACCEPTANCE_GATE_RUNNER.md";
const RUNNER_PATH = "ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs";
const TEST_PATH = "test/s_v1_f_02_v1_acceptance_gate_runner.test.mjs";
const PACKAGE_PATH = "package.json";

const REQUIRED_GATE_IDS = [
  "v1_manifest_self_check",
  "v1_full_repository_gate",
  "v1_release_boundary_gate",
  "v1_core_product_gate",
  "v1_registry_template_gate",
  "v1_assignment_compile_gate",
  "v1_session_execution_gate",
  "v1_history_notes_live_status_gate",
  "v1_proof_export_gate",
  "v1_payment_legal_operational_gate",
  "v1_founder_manual_test_gate",
  "v1_generated_index_gate",
  "v1_post_scope_leak_blocker_gate"
];

const REQUIRED_EXACT_COMMANDS = [
  "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check",
  "node --test test/s_v1_f_02_v1_acceptance_gate_runner.test.mjs",
  "node ci/guards/s_v1_f_02_v1_acceptance_gate_runner_guard.mjs",
  "npm.cmd run lint:fast",
  "node ci/guards/s_v1_02b_non_scope_guard_hardening_guard.mjs",
  "node ci/guards/postv1_packaging_surface_registry_guard.mjs",
  "node --test test/s_v1_f_01_founder_test_pack.test.mjs",
  "node ci/guards/s_v1_f_01_founder_test_pack_guard.mjs",
  "node ci/scripts/run_failure_token_index_guard.mjs",
  "node ci/guards/guards_index_guard.mjs",
  "node ci/guards/guards_entrypoint_coverage_guard.mjs",
  "node ci/scripts/sha256_guard.mjs"
];

const REQUIRED_DOC_PHRASES = [
  "V1 must not be marked complete unless every required acceptance gate",
  "They do not replace feature guards.",
  "They do not replace `npm.cmd run lint:fast`.",
  "They do not permit manual assumptions.",
  "They do not activate post-v1 surfaces.",
  "npm.cmd run acceptance:v1:check",
  "npm.cmd run acceptance:v1:run",
  "npm.cmd run lint:fast"
];

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function readText(path) {
  if (!fs.existsSync(path)) {
    fail("S-V1-F-02 required file missing.", { path });
  }

  return fs.readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function flattenCommands(manifest) {
  return manifest.required_acceptance_gates.flatMap((gate) => gate.commands || []);
}

function assertContains(text, phrase, path) {
  if (!text.includes(phrase)) {
    fail("S-V1-F-02 required phrase missing.", { path, phrase });
  }
}

function assertFileExists(path) {
  if (!fs.existsSync(path)) {
    fail("S-V1-F-02 referenced command target missing.", { path });
  }
}

function validateManifest() {
  const manifest = readJson(MANIFEST_PATH);

  if (manifest.slice_id !== "S-V1-F-02") {
    fail("S-V1-F-02 manifest slice id mismatch.", { actual: manifest.slice_id });
  }

  if (manifest.manifest_id !== "v1_acceptance_gate_manifest") {
    fail("S-V1-F-02 manifest id mismatch.", { actual: manifest.manifest_id });
  }

  const authority = manifest.authority_boundary || {};
  for (const [key, expected] of Object.entries({
    creates_product_law: false,
    creates_engine_law: false,
    creates_registry_law: false,
    creates_workflow_law: false,
    authorises_production_data_access: false,
    activates_post_v1_scope: false,
    manual_assumption_allowed: false
  })) {
    if (authority[key] !== expected) {
      fail("S-V1-F-02 authority boundary mismatch.", { key, actual: authority[key], expected });
    }
  }

  const rule = manifest.completion_rule || {};
  for (const key of [
    "v1_must_not_be_marked_complete_unless_all_required_gates_pass",
    "every_required_gate_blocks_completion",
    "every_gate_must_name_exact_commands",
    "post_v1_scope_leak_blocks_completion",
    "generated_indexes_must_be_refreshed_by_generators",
    "broad_workflows_must_not_be_touched_without_preflight_proof"
  ]) {
    if (rule[key] !== true) {
      fail("S-V1-F-02 completion rule missing.", { key });
    }
  }

  const gates = Array.isArray(manifest.required_acceptance_gates)
    ? manifest.required_acceptance_gates
    : [];

  const ids = new Set(gates.map((gate) => gate.gate_id));
  for (const gateId of REQUIRED_GATE_IDS) {
    if (!ids.has(gateId)) {
      fail("S-V1-F-02 required gate missing.", { gateId });
    }
  }

  for (const gate of gates) {
    if (gate.required !== true || gate.blocks_completion !== true) {
      fail("S-V1-F-02 gate must be required and completion-blocking.", { gate_id: gate.gate_id });
    }

    if (!Array.isArray(gate.commands) || gate.commands.length === 0) {
      fail("S-V1-F-02 gate must name exact commands.", { gate_id: gate.gate_id });
    }
  }

  const commands = flattenCommands(manifest);
  for (const command of REQUIRED_EXACT_COMMANDS) {
    if (!commands.includes(command)) {
      fail("S-V1-F-02 exact command missing.", { command });
    }
  }

  for (const command of commands) {
    const parts = command.split(/\s+/).filter(Boolean);
    if (parts[0] === "node") {
      const target = parts[1] === "--test" ? parts[2] : parts[1];
      assertFileExists(target);
    }
  }

  const blocker = gates.find((gate) => gate.gate_id === "v1_post_scope_leak_blocker_gate");
  if (!blocker) {
    fail("S-V1-F-02 post-v1 blocker gate missing.");
  }

  for (const label of [
    "marketplace",
    "messaging",
    "team runtime",
    "organisation runtime",
    "organization runtime",
    "gym runtime",
    "federation runtime",
    "enterprise runtime"
  ]) {
    if (!blocker.blocked_scope_labels.includes(label)) {
      fail("S-V1-F-02 blocked scope label missing.", { label });
    }
  }

  return { gates, commands };
}

function validateDocs() {
  const doc = readText(RUNNER_DOC_PATH);

  for (const phrase of REQUIRED_DOC_PHRASES) {
    assertContains(doc, phrase, RUNNER_DOC_PATH);
  }

  const acceptanceGateDoc = readText("docs/v1/V1_ACCEPTANCE_GATE.md");
  assertContains(acceptanceGateDoc, "## S-V1-F-02 V1 Acceptance Gate Runner", "docs/v1/V1_ACCEPTANCE_GATE.md");
  assertContains(acceptanceGateDoc, "npm.cmd run lint:fast", "docs/v1/V1_ACCEPTANCE_GATE.md");

  const releaseBoundaryDoc = readText("docs/v1/V1_RELEASE_BOUNDARY.md");
  assertContains(releaseBoundaryDoc, "## S-V1-F-02 V1 Acceptance Gate Runner", "docs/v1/V1_RELEASE_BOUNDARY.md");

  const notInScopeDoc = readText("docs/v1/V1_NOT_IN_SCOPE.md");
  assertContains(notInScopeDoc, "## S-V1-F-02 V1 Acceptance Gate Runner Non-Scope", "docs/v1/V1_NOT_IN_SCOPE.md");

  const authorityDoc = readText("docs/v1/V1_DOC_AUTHORITY_MAP.md");
  assertContains(authorityDoc, "## S-V1-F-02 V1 Acceptance Gate Runner Authority", "docs/v1/V1_DOC_AUTHORITY_MAP.md");
}

function validatePackage() {
  const pkg = readJson(PACKAGE_PATH);
  const proofCommand = "node --test test/s_v1_f_02_v1_acceptance_gate_runner.test.mjs && node ci/guards/s_v1_f_02_v1_acceptance_gate_runner_guard.mjs && node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check";

  if (pkg.scripts?.["proof:s-v1-f-02"] !== proofCommand) {
    fail("S-V1-F-02 proof package script mismatch.", {
      actual: pkg.scripts?.["proof:s-v1-f-02"],
      expected: proofCommand
    });
  }

  for (const [name, expected] of Object.entries({
    "acceptance:v1:check": "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check",
    "acceptance:v1:list": "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --list",
    "acceptance:v1:run": "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --run"
  })) {
    if (pkg.scripts?.[name] !== expected) {
      fail("S-V1-F-02 acceptance package script mismatch.", {
        name,
        actual: pkg.scripts?.[name],
        expected
      });
    }
  }

  for (const scriptName of ["lint:fast:inline", "lint:fast"]) {
    if (!String(pkg.scripts?.[scriptName] || "").includes(proofCommand)) {
      fail("S-V1-F-02 proof command missing from package script.", { scriptName });
    }
  }
}

function validateRunnerCheck() {
  const result = spawnSync("node", [RUNNER_PATH, "--check"], {
    encoding: "utf8",
    shell: false
  });

  if (result.status !== 0) {
    fail("S-V1-F-02 runner check failed.", {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr
    });
  }

  if (!result.stdout.includes(TOKEN)) {
    fail("S-V1-F-02 runner output token missing.", { stdout: result.stdout });
  }
}

const result = validateManifest();
validateDocs();
validatePackage();
validateRunnerCheck();
readText(TEST_PATH);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-F-02",
  token: TOKEN,
  gates_checked: result.gates.length,
  commands_checked: result.commands.length,
  message: "V1 acceptance gate runner blocks completion unless all required gates pass."
}, null, 2));
