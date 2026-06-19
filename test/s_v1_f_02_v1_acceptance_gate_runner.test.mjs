import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const MANIFEST_PATH = "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json";
const RUNNER_PATH = "ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs";
const DOC_PATH = "docs/v1/V1_ACCEPTANCE_GATE_RUNNER.md";

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

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function readManifest() {
  return JSON.parse(readText(MANIFEST_PATH));
}

function allCommands(manifest) {
  return manifest.required_acceptance_gates.flatMap((gate) => gate.commands);
}

test("S-V1-F-02 acceptance manifest and runner docs exist", () => {
  assert.ok(fs.existsSync(MANIFEST_PATH));
  assert.ok(fs.existsSync(RUNNER_PATH));
  assert.ok(fs.existsSync(DOC_PATH));

  const doc = readText(DOC_PATH);
  assert.match(doc, /# V1 Acceptance Gate Runner/);
  assert.match(doc, /V1 must not be marked complete unless every required acceptance gate/);
  assert.match(doc, /does not create product law/);
  assert.match(doc, /does not activate post-v1 surfaces/);
});

test("S-V1-F-02 manifest blocks v1 completion unless all required gates pass", () => {
  const manifest = readManifest();

  assert.equal(manifest.slice_id, "S-V1-F-02");
  assert.equal(manifest.manifest_id, "v1_acceptance_gate_manifest");
  assert.equal(manifest.status, "active_acceptance_gate_manifest");

  assert.equal(
    manifest.completion_rule.v1_must_not_be_marked_complete_unless_all_required_gates_pass,
    true
  );
  assert.equal(manifest.completion_rule.every_required_gate_blocks_completion, true);
  assert.equal(manifest.completion_rule.every_gate_must_name_exact_commands, true);
  assert.equal(manifest.completion_rule.post_v1_scope_leak_blocks_completion, true);

  for (const gate of manifest.required_acceptance_gates) {
    assert.equal(gate.required, true, `${gate.gate_id} must be required`);
    assert.equal(gate.blocks_completion, true, `${gate.gate_id} must block completion`);
    assert.ok(Array.isArray(gate.commands), `${gate.gate_id} must name commands`);
    assert.ok(gate.commands.length > 0, `${gate.gate_id} must name at least one command`);
  }
});

test("S-V1-F-02 manifest includes the required acceptance gate ids", () => {
  const manifest = readManifest();
  const ids = new Set(manifest.required_acceptance_gates.map((gate) => gate.gate_id));

  for (const gateId of REQUIRED_GATE_IDS) {
    assert.ok(ids.has(gateId), `missing gate: ${gateId}`);
  }
});

test("S-V1-F-02 manifest names exact runner, lint, generated index, and blocker commands", () => {
  const manifest = readManifest();
  const commands = allCommands(manifest);

  const requiredCommands = [
    "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check",
    "node --test test/s_v1_f_02_v1_acceptance_gate_runner.test.mjs",
    "node ci/guards/s_v1_f_02_v1_acceptance_gate_runner_guard.mjs",
    "npm.cmd run lint:fast",
    "node ci/guards/s_v1_02b_non_scope_guard_hardening_guard.mjs",
    "node ci/guards/postv1_packaging_surface_registry_guard.mjs",
    "node ci/scripts/run_failure_token_index_guard.mjs",
    "node ci/guards/guards_index_guard.mjs",
    "node ci/guards/guards_entrypoint_coverage_guard.mjs",
    "node ci/scripts/sha256_guard.mjs",
    "node --test test/s_v1_f_01_founder_test_pack.test.mjs",
    "node ci/guards/s_v1_f_01_founder_test_pack_guard.mjs"
  ];

  for (const command of requiredCommands) {
    assert.ok(commands.includes(command), `missing exact command: ${command}`);
  }
});

test("S-V1-F-02 manifest blocks post-v1 scope leaks", () => {
  const manifest = readManifest();
  const blocker = manifest.required_acceptance_gates.find(
    (gate) => gate.gate_id === "v1_post_scope_leak_blocker_gate"
  );

  assert.ok(blocker);
  assert.equal(blocker.required, true);
  assert.equal(blocker.blocks_completion, true);

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
    assert.ok(blocker.blocked_scope_labels.includes(label), `missing blocked label: ${label}`);
  }
});

test("S-V1-F-02 runner check passes and package scripts are wired", () => {
  const result = spawnSync("node", [RUNNER_PATH, "--check"], {
    encoding: "utf8",
    shell: false
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /CI_V1_ACCEPTANCE_GATE_RUNNER/);

  const pkg = JSON.parse(readText("package.json"));
  const proofCommand = "node --test test/s_v1_f_02_v1_acceptance_gate_runner.test.mjs && node ci/guards/s_v1_f_02_v1_acceptance_gate_runner_guard.mjs && node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check";

  assert.equal(pkg.scripts["proof:s-v1-f-02"], proofCommand);
  assert.equal(
    pkg.scripts["acceptance:v1:check"],
    "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check"
  );
  assert.equal(
    pkg.scripts["acceptance:v1:list"],
    "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --list"
  );
  assert.equal(
    pkg.scripts["acceptance:v1:run"],
    "node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --run"
  );
  assert.ok(pkg.scripts["lint:fast:inline"].includes(proofCommand));
  assert.ok(pkg.scripts["lint:fast"].includes(proofCommand));
});