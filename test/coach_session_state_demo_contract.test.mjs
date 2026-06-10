import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCoachSessionStateDemoContractLint } from "../ci/scripts/run_coach_session_state_demo_contract_lint.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeTempCase({ fieldRegistry, copySurface }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-session-state-demo-contract-"));
  const fieldRegistryPath = path.join(dir, "field-registry.json");
  const copySurfacePath = path.join(dir, "copy-surface.json");

  writeJson(fieldRegistryPath, fieldRegistry);
  writeJson(copySurfacePath, copySurface);

  return { fieldRegistryPath, copySurfacePath };
}

function baseFieldRegistry() {
  return {
    schema_version: "kolosseum.coach_session_state_field_registry.v1.0.0",
    scope: "active_v0_only",
    fields: [
      { field_id: "canonical_input_hash", path: "canonical_input_hash", field_class: "truth_reference", allowed: true },
      { field_id: "selection_hash", path: "selection_hash", field_class: "truth_reference", allowed: true },
      { field_id: "execution_status", path: "execution_status", field_class: "execution_state", allowed: true },
      { field_id: "execution_state", path: "execution_state", field_class: "execution_state", allowed: true },
      { field_id: "runtime_events", path: "runtime_events", field_class: "runtime_events", allowed: true },
      { field_id: "block_execution_summary_block_id", path: "block_execution_summary[].block_id", field_class: "block_summary", allowed: true },
      { field_id: "block_execution_summary_block_index", path: "block_execution_summary[].block_index", field_class: "block_summary", allowed: true },
      { field_id: "block_execution_summary_sessions_total", path: "block_execution_summary[].sessions_total", field_class: "block_summary", allowed: true },
      { field_id: "block_execution_summary_sessions_ended", path: "block_execution_summary[].sessions_ended", field_class: "block_summary", allowed: true },
      { field_id: "block_execution_summary_work_items_total", path: "block_execution_summary[].work_items_total", field_class: "block_summary", allowed: true },
      { field_id: "block_execution_summary_work_items_done", path: "block_execution_summary[].work_items_done", field_class: "block_summary", allowed: true },
      { field_id: "session_execution_summary_session_id", path: "session_execution_summary[].session_id", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_block_id", path: "session_execution_summary[].block_id", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_session_index_global", path: "session_execution_summary[].session_index_global", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_session_index_in_block", path: "session_execution_summary[].session_index_in_block", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_session_ended", path: "session_execution_summary[].session_ended", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_work_items_total", path: "session_execution_summary[].work_items_total", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_work_items_done", path: "session_execution_summary[].work_items_done", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_pain_flag_count", path: "session_execution_summary[].pain_flag_count", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_split_entered", path: "session_execution_summary[].split_entered", field_class: "session_summary", allowed: true },
      { field_id: "session_execution_summary_split_return_decision", path: "session_execution_summary[].split_return_decision", field_class: "session_summary", allowed: true }
    ]
  };
}

function baseCopySurface() {
  return {
    schema_version: "kolosseum.coach_session_state_copy_surface.v1.0.0",
    scope: "active_v0_only",
    phrases: [
      "Session active.",
      "Session complete.",
      "Execution state: partial.",
      "Work items done: 4 of 6.",
      "Pain flags recorded: 1.",
      "Split entered: yes.",
      "Return decision: continue."
    ],
    demo_fields: [
      "canonical_input_hash",
      "selection_hash",
      "execution_status",
      "execution_state",
      "runtime_events",
      "block_execution_summary[].block_id",
      "block_execution_summary[].block_index",
      "block_execution_summary[].sessions_total",
      "block_execution_summary[].sessions_ended",
      "block_execution_summary[].work_items_total",
      "block_execution_summary[].work_items_done",
      "session_execution_summary[].session_id",
      "session_execution_summary[].block_id",
      "session_execution_summary[].session_index_global",
      "session_execution_summary[].session_index_in_block",
      "session_execution_summary[].session_ended",
      "session_execution_summary[].work_items_total",
      "session_execution_summary[].work_items_done",
      "session_execution_summary[].pain_flag_count",
      "session_execution_summary[].split_entered",
      "session_execution_summary[].split_return_decision"
    ]
  };
}

test("passes on the repo coach session state demo contract slice", () => {
  const report = runCoachSessionStateDemoContractLint({
    fieldRegistryPath: path.resolve("docs/commercial/COACH_SESSION_STATE_FIELD_REGISTRY.json"),
    copySurfacePath: path.resolve("docs/commercial/COACH_SESSION_STATE_COPY_SURFACE.json")
  });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.failures.length, 0, JSON.stringify(report, null, 2));
});

test("fails when a demo field is not pinned in the field registry", () => {
  const copySurface = baseCopySurface();
  copySurface.demo_fields.push("session_execution_summary[].coach_intervention_score");

  const files = makeTempCase({
    fieldRegistry: baseFieldRegistry(),
    copySurface
  });

  const report = runCoachSessionStateDemoContractLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_FOREIGN_KEY_FAILURE"), JSON.stringify(report, null, 2));
});

test("fails when copy introduces inference wording", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Athlete likely fatigued.");

  const files = makeTempCase({
    fieldRegistry: baseFieldRegistry(),
    copySurface
  });

  const report = runCoachSessionStateDemoContractLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC" || failure.token === "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"), JSON.stringify(report, null, 2));
});

test("fails when copy introduces intervention wording", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Coach should intervene.");

  const files = makeTempCase({
    fieldRegistry: baseFieldRegistry(),
    copySurface
  });

  const report = runCoachSessionStateDemoContractLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"), JSON.stringify(report, null, 2));
});

test("fails when copy introduces judgement wording", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Poor adherence.");

  const files = makeTempCase({
    fieldRegistry: baseFieldRegistry(),
    copySurface
  });

  const report = runCoachSessionStateDemoContractLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"), JSON.stringify(report, null, 2));
});