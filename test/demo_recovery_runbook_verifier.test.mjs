import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function writeUtf8NoBomLf(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\r\n/g, "\n"), { encoding: "utf8" });
}

function makeBaseRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p171-demo-recovery-"));

  writeUtf8NoBomLf(path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_RUNBOOK.md"), `# P171

No improvising product claims during recovery.
No engine retry, no hidden alternate logic, no mutation, no recovery code path.
If a live demo misbehaves, the operator may only route to already-live v0 proof surfaces or stop.

"This surface is not the one I am using to prove the flow. I am moving to the corresponding factual artefact."
"I am staying inside the proven v0 path."
"I am not making claims beyond what this artefact shows."
`);

  writeUtf8NoBomLf(path.join(root, "docs/demo/founder_demo/P150_COACH_ASSIGNMENT_PROOF.md"), "# P150\n");
  writeUtf8NoBomLf(path.join(root, "docs/demo/founder_demo/P167_COACH_OBJECTION_HANDLING_PACK.md"), "# P167\n");
  writeUtf8NoBomLf(path.join(root, "docs/demo/founder_demo/P168_COACH_NOTES_BOUNDARY_PROOF.md"), "# P168\n");
  writeUtf8NoBomLf(path.join(root, "docs/demo/founder_demo/P155_SESSION_HISTORY_COUNTS_CONTRACT.md"), "# P155\n");

  const manifest = {
    schema_version: "kolosseum.demo_recovery_manifest.v1",
    artifact_id: "p171_live_demo_failure_recovery_manifest",
    engine_compatibility: "EB2-1.0.0",
    release_scope: "v0",
    allowed_target_surface_types: ["ui_surface", "factual_artefact", "proof_doc", "stop"],
    steps: [
      {
        step_id: "step_01_continue_primary",
        fallback_order_index: 1,
        trigger_surface_id: "demo_primary_surface_ok",
        target_artefact_id: "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_RUNBOOK.md",
        target_surface_type: "proof_doc",
        allowed_in_v0: true,
        live_required: true,
        terminal: false,
        next_step_id: "step_02_switch_to_factual_artefact",
        notes: null
      },
      {
        step_id: "step_02_switch_to_factual_artefact",
        fallback_order_index: 2,
        trigger_surface_id: "demo_surface_visual_or_interaction_failure",
        target_artefact_id: "docs/demo/founder_demo/P150_COACH_ASSIGNMENT_PROOF.md",
        target_surface_type: "factual_artefact",
        allowed_in_v0: true,
        live_required: true,
        terminal: false,
        next_step_id: "step_03_switch_to_completed_execution_proof",
        notes: null
      },
      {
        step_id: "step_03_switch_to_completed_execution_proof",
        fallback_order_index: 3,
        trigger_surface_id: "demo_execution_surface_unstable",
        target_artefact_id: "docs/demo/founder_demo/P167_COACH_OBJECTION_HANDLING_PACK.md",
        target_surface_type: "factual_artefact",
        allowed_in_v0: true,
        live_required: true,
        terminal: false,
        next_step_id: "step_04_switch_to_adjacent_coach_proof",
        notes: null
      },
      {
        step_id: "step_04_switch_to_adjacent_coach_proof",
        fallback_order_index: 4,
        trigger_surface_id: "demo_coach_surface_unstable",
        target_artefact_id: "docs/demo/founder_demo/P168_COACH_NOTES_BOUNDARY_PROOF.md",
        target_surface_type: "factual_artefact",
        allowed_in_v0: true,
        live_required: true,
        terminal: false,
        next_step_id: "step_05_switch_to_history_counts_proof",
        notes: null
      },
      {
        step_id: "step_05_switch_to_history_counts_proof",
        fallback_order_index: 5,
        trigger_surface_id: "demo_history_or_neutral_summary_surface_unstable",
        target_artefact_id: "docs/demo/founder_demo/P155_SESSION_HISTORY_COUNTS_CONTRACT.md",
        target_surface_type: "factual_artefact",
        allowed_in_v0: true,
        live_required: true,
        terminal: false,
        next_step_id: "step_06_terminal_stop",
        notes: null
      },
      {
        step_id: "step_06_terminal_stop",
        fallback_order_index: 6,
        trigger_surface_id: "demo_no_lawful_live_v0_recovery_surface_remaining",
        target_artefact_id: "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_RUNBOOK.md",
        target_surface_type: "stop",
        allowed_in_v0: true,
        live_required: true,
        terminal: true,
        next_step_id: null,
        notes: null
      }
    ]
  };

  writeUtf8NoBomLf(
    path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_MANIFEST.json"),
    JSON.stringify(manifest, null, 2)
  );

  return { root, manifest };
}

function copyVerifier(root) {
  const source = path.resolve("ci/scripts/run_demo_recovery_runbook_verifier.mjs");
  const dest = path.join(root, "ci/scripts/run_demo_recovery_runbook_verifier.mjs");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
}

function runVerifier(root) {
  return execFileSync(
    process.execPath,
    [path.join(root, "ci/scripts/run_demo_recovery_runbook_verifier.mjs")],
    { cwd: root, encoding: "utf8" }
  );
}

function runVerifierExpectFailure(root) {
  try {
    runVerifier(root);
    assert.fail("expected verifier to fail");
  } catch (error) {
    return String(error.stderr || error.message || error);
  }
}

test("passes for complete ordered manifest inside v0 live set", () => {
  const { root } = makeBaseRepo();
  copyVerifier(root);
  const output = runVerifier(root);
  const parsed = JSON.parse(output);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.checked_steps, 6);
  assert.equal(parsed.terminal_step_id, "step_06_terminal_stop");
});

test("fails if a target artefact is missing", () => {
  const { root } = makeBaseRepo();
  copyVerifier(root);
  fs.rmSync(path.join(root, "docs/demo/founder_demo/P167_COACH_OBJECTION_HANDLING_PACK.md"));
  const message = runVerifierExpectFailure(root);
  assert.match(message, /target artefact/i);
});

test("fails if a step points to dormant proof-layer surface", () => {
  const { root, manifest } = makeBaseRepo();
  copyVerifier(root);
  manifest.steps[2].target_artefact_id = "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json";
  writeUtf8NoBomLf(
    path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_MANIFEST.json"),
    JSON.stringify(manifest, null, 2)
  );
  writeUtf8NoBomLf(path.join(root, "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json"), "{}");
  const message = runVerifierExpectFailure(root);
  assert.match(message, /forbidden target scope/i);
});

test("fails if fallback order skips or duplicates", () => {
  const { root, manifest } = makeBaseRepo();
  copyVerifier(root);
  manifest.steps[3].fallback_order_index = 3;
  writeUtf8NoBomLf(
    path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_MANIFEST.json"),
    JSON.stringify(manifest, null, 2)
  );
  const message = runVerifierExpectFailure(root);
  assert.match(message, /duplicate fallback_order_index/i);
});

test("fails if runbook contains banned improvisational recovery language", () => {
  const { root } = makeBaseRepo();
  copyVerifier(root);
  writeUtf8NoBomLf(
    path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_RUNBOOK.md"),
    `# P171

No improvising product claims during recovery.
No engine retry, no hidden alternate logic, no mutation, no recovery code path.
If a live demo misbehaves, the operator may only route to already-live v0 proof surfaces or stop.
This surface gracefully falls back.
"This surface is not the one I am using to prove the flow. I am moving to the corresponding factual artefact."
"I am staying inside the proven v0 path."
"I am not making claims beyond what this artefact shows."
`
  );
  const message = runVerifierExpectFailure(root);
  assert.match(message, /banned recovery language/i);
});

test("fails if no terminal stop step exists", () => {
  const { root, manifest } = makeBaseRepo();
  copyVerifier(root);
  manifest.steps[5].terminal = false;
  manifest.steps[5].target_surface_type = "proof_doc";
  manifest.steps[5].next_step_id = "step_06_terminal_stop";
  writeUtf8NoBomLf(
    path.join(root, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_MANIFEST.json"),
    JSON.stringify(manifest, null, 2)
  );
  const message = runVerifierExpectFailure(root);
  assert.match(message, /exactly one terminal step is required/i);
});