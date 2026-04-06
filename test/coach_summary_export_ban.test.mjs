import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCoachSummaryExportBanLint } from "../ci/scripts/run_coach_summary_export_ban_lint.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeTempCase({ copySurface, fieldBoundary }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-summary-export-ban-"));
  const copySurfacePath = path.join(dir, "copy-surface.json");
  const fieldBoundaryPath = path.join(dir, "field-boundary.json");

  writeJson(copySurfacePath, copySurface);
  writeJson(fieldBoundaryPath, fieldBoundary);

  return { copySurfacePath, fieldBoundaryPath };
}

function baseCopySurface() {
  return {
    schema_version: "kolosseum.coach_summary_copy_surface.v1.0.0",
    scope: "active_v0_only",
    phrases: [
      "View summary.",
      "Session summary.",
      "Execution summary.",
      "Block summary.",
      "Read-only summary.",
      "View factual session state."
    ]
  };
}

function baseFieldBoundary() {
  return {
    schema_version: "kolosseum.coach_summary_field_boundary.v1.0.0",
    scope: "active_v0_only",
    allowed_fields: [
      "execution_status",
      "execution_state",
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
    ],
    forbidden_fields: [
      "export_id",
      "report_id",
      "report_url",
      "download_url",
      "file_name",
      "mime_type",
      "evidence_envelope",
      "seal_id",
      "artifact_hash",
      "pdf_path",
      "printable_summary",
      "share_token"
    ]
  };
}

test("passes on the repo coach summary export ban slice", () => {
  const report = runCoachSummaryExportBanLint({
    copySurfacePath: path.resolve("docs/commercial/COACH_SUMMARY_COPY_SURFACE.json"),
    fieldBoundaryPath: path.resolve("docs/commercial/COACH_SUMMARY_FIELD_BOUNDARY.json")
  });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.failures.length, 0, JSON.stringify(report, null, 2));
});

test("fails when copy says export summary", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Export summary.");

  const files = makeTempCase({
    copySurface,
    fieldBoundary: baseFieldBoundary()
  });

  const report = runCoachSummaryExportBanLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"), JSON.stringify(report, null, 2));
});

test("fails when copy says download report", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Download report.");

  const files = makeTempCase({
    copySurface,
    fieldBoundary: baseFieldBoundary()
  });

  const report = runCoachSummaryExportBanLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"), JSON.stringify(report, null, 2));
});

test("fails when copy says proof-backed summary", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Proof-backed summary.");

  const files = makeTempCase({
    copySurface,
    fieldBoundary: baseFieldBoundary()
  });

  const report = runCoachSummaryExportBanLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC"), JSON.stringify(report, null, 2));
});

test("fails when field boundary includes report_url as allowed", () => {
  const fieldBoundary = baseFieldBoundary();
  fieldBoundary.allowed_fields.push("report_url");

  const files = makeTempCase({
    copySurface: baseCopySurface(),
    fieldBoundary
  });

  const report = runCoachSummaryExportBanLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_FOREIGN_KEY_FAILURE"), JSON.stringify(report, null, 2));
});

test("fails when field boundary includes evidence_envelope as allowed", () => {
  const fieldBoundary = baseFieldBoundary();
  fieldBoundary.allowed_fields.push("evidence_envelope");

  const files = makeTempCase({
    copySurface: baseCopySurface(),
    fieldBoundary
  });

  const report = runCoachSummaryExportBanLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_FOREIGN_KEY_FAILURE"), JSON.stringify(report, null, 2));
});