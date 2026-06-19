/*
 * DEV NOTE: S-V1-F-02 v1 acceptance gate runner.
 * Purpose: validates and optionally executes the final v1 acceptance manifest.
 * Boundary: proof orchestration only. This runner does not create product law,
 * engine law, registry law, workflow law, production-data authority, or
 * post-v1 product scope.
 * Failure behaviour: fails closed on missing required gates, missing exact
 * commands, non-scope activation, or command failure in --run mode.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TOKEN = "CI_V1_ACCEPTANCE_GATE_RUNNER";
const MANIFEST_PATH = "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json";

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

const REQUIRED_BLOCKED_SCOPE_LABELS = [
  "marketplace",
  "messaging",
  "team runtime",
  "organisation runtime",
  "organization runtime",
  "unit runtime",
  "gym runtime",
  "federation runtime",
  "enterprise runtime"
];

function fail(code, details = {}) {
  const error = new Error(code);
  error.details = details;
  throw error;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail("v1_acceptance_manifest_missing", { filePath });
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenCommands(manifest) {
  return manifest.required_acceptance_gates.flatMap((gate) => gate.commands || []);
}

function assertFileExists(filePath, command) {
  if (!fs.existsSync(filePath)) {
    fail("v1_acceptance_command_target_missing", { filePath, command });
  }
}

function assertCommandTargetsExist(commands) {
  for (const command of commands) {
    const parts = command.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      fail("v1_acceptance_empty_command", { command });
    }

    if (parts[0] === "node") {
      if (parts[1] === "--test") {
        assertFileExists(parts[2], command);
        continue;
      }

      assertFileExists(parts[1], command);
      continue;
    }

    if (parts[0] === "npm.cmd") {
      if (parts[1] !== "run" || !parts[2]) {
        fail("v1_acceptance_invalid_npm_command", { command });
      }

      continue;
    }

    fail("v1_acceptance_unsupported_command", { command });
  }
}

function validateManifest(manifest) {
  if (manifest.slice_id !== "S-V1-F-02") {
    fail("v1_acceptance_manifest_slice_id_invalid", { actual: manifest.slice_id });
  }

  if (manifest.manifest_id !== "v1_acceptance_gate_manifest") {
    fail("v1_acceptance_manifest_id_invalid", { actual: manifest.manifest_id });
  }

  if (manifest.status !== "active_acceptance_gate_manifest") {
    fail("v1_acceptance_manifest_status_invalid", { actual: manifest.status });
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
      fail("v1_acceptance_authority_boundary_invalid", { key, actual: authority[key], expected });
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
      fail("v1_acceptance_completion_rule_missing", { key });
    }
  }

  const gates = Array.isArray(manifest.required_acceptance_gates)
    ? manifest.required_acceptance_gates
    : [];

  const gateIds = new Set(gates.map((gate) => gate.gate_id));
  for (const gateId of REQUIRED_GATE_IDS) {
    if (!gateIds.has(gateId)) {
      fail("v1_acceptance_required_gate_missing", { gateId });
    }
  }

  for (const gate of gates) {
    if (gate.required !== true) {
      fail("v1_acceptance_gate_not_required", { gate_id: gate.gate_id });
    }

    if (gate.blocks_completion !== true) {
      fail("v1_acceptance_gate_does_not_block_completion", { gate_id: gate.gate_id });
    }

    if (!Array.isArray(gate.commands) || gate.commands.length === 0) {
      fail("v1_acceptance_gate_commands_missing", { gate_id: gate.gate_id });
    }

    for (const command of gate.commands) {
      if (typeof command !== "string" || command.trim() !== command || command.length < 5) {
        fail("v1_acceptance_gate_command_invalid", { gate_id: gate.gate_id, command });
      }
    }
  }

  const commands = flattenCommands(manifest);

  for (const command of REQUIRED_EXACT_COMMANDS) {
    if (!commands.includes(command)) {
      fail("v1_acceptance_required_exact_command_missing", { command });
    }
  }

  assertCommandTargetsExist(commands);

  const blockerGate = gates.find((gate) => gate.gate_id === "v1_post_scope_leak_blocker_gate");
  if (!blockerGate) {
    fail("v1_acceptance_post_scope_blocker_missing");
  }

  const labels = new Set(blockerGate.blocked_scope_labels || []);
  for (const label of REQUIRED_BLOCKED_SCOPE_LABELS) {
    if (!labels.has(label)) {
      fail("v1_acceptance_post_scope_label_missing", { label });
    }
  }

  return {
    gate_count: gates.length,
    command_count: commands.length
  };
}

function listCommands(manifest) {
  for (const gate of manifest.required_acceptance_gates) {
    console.log("");
    console.log(`# ${gate.gate_id} - ${gate.title}`);
    for (const command of gate.commands) {
      console.log(command);
    }
  }
}

function splitCommand(command) {
  return command.split(/\s+/).filter(Boolean);
}

function runCommand(command) {
  const parts = splitCommand(command);
  let executable = parts[0];
  const args = parts.slice(1);

  if (process.platform !== "win32" && executable === "npm.cmd") {
    executable = "npm";
  }

  const result = spawnSync(executable, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    fail("v1_acceptance_command_spawn_failed", { command, message: result.error.message });
  }

  if (result.status !== 0) {
    fail("v1_acceptance_command_failed", { command, status: result.status });
  }
}

function runManifest(manifest) {
  for (const gate of manifest.required_acceptance_gates) {
    console.log("");
    console.log(`S-V1-F-02 running gate: ${gate.gate_id}`);
    for (const command of gate.commands) {
      console.log(`>>> ${command}`);
      runCommand(command);
    }
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const modeCount = ["--check", "--list", "--run"].filter((mode) => args.has(mode)).length;
  if (modeCount > 1) {
    fail("v1_acceptance_runner_mode_conflict");
  }

  const manifest = readJson(MANIFEST_PATH);
  const result = validateManifest(manifest);

  if (args.has("--list")) {
    listCommands(manifest);
  } else if (args.has("--run")) {
    runManifest(manifest);
  }

  console.log(JSON.stringify({
    ok: true,
    runner: "S-V1-F-02",
    token: TOKEN,
    manifest_path: MANIFEST_PATH,
    gate_count: result.gate_count,
    command_count: result.command_count,
    message: "V1 acceptance gate manifest is valid and blocks completion unless required gates pass."
  }, null, 2));
}

main();