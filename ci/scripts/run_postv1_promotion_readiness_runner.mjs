#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_COMPONENTS,
  verifyFreezeGovernanceClosure
} from "./run_freeze_governance_closure_gate.mjs";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    outputPath: "docs/releases/V1_PROMOTION_READINESS.json",
    writeReport: true,
    requiredReports: [
      "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
      "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
      "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
      "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
      "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
      "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
      "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
      "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
      "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
      "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json",
      "docs/releases/V1_FREEZE_EXIT_CRITERIA.json"
    ]
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--output") {
      args.outputPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--required-report") {
      args.requiredReports.push(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--replace-required-reports") {
      args.requiredReports = [];
      continue;
    }

    if (arg === "--no-write-report") {
      args.writeReport = false;
      continue;
    }
  }

  return args;
}

function normalizeRel(input) {
  return String(input).replace(/\\/g, "/").trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function summarizeReport(relPath, parsed) {
  return {
    path: relPath,
    ok: parsed?.ok === true,
    verifier_id: typeof parsed?.verifier_id === "string" ? parsed.verifier_id : null,
    checked_at_utc: typeof parsed?.checked_at_utc === "string" ? parsed.checked_at_utc : null,
    failure_count: Array.isArray(parsed?.failures) ? parsed.failures.length : 0
  };
}

function buildClosureComponentPaths(root, promotionReadinessPath) {
  return {
    proof_index: path.join(root, DEFAULT_COMPONENTS.proof_index),
    proof_chain: path.join(root, DEFAULT_COMPONENTS.proof_chain),
    drift_status: path.join(root, DEFAULT_COMPONENTS.drift_status),
    packet_integrity: path.join(root, DEFAULT_COMPONENTS.packet_integrity),
    cleanliness: path.join(root, DEFAULT_COMPONENTS.cleanliness),
    exit_criteria: path.join(root, DEFAULT_COMPONENTS.exit_criteria),
    promotion_readiness: promotionReadinessPath
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const requiredReports = Array.from(
    new Set(args.requiredReports.map((entry) => normalizeRel(entry)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const failures = [];
  const checks = [];

  for (const relPath of requiredReports) {
    const absolute = path.join(args.root, relPath);

    if (!fs.existsSync(absolute)) {
      failures.push(
        buildFailure(
          "CI_SPINE_MISSING_DOC",
          relPath,
          "Promotion readiness requires this freeze proof report, but it is missing."
        )
      );

      checks.push({
        path: relPath,
        ok: false,
        verifier_id: null,
        checked_at_utc: null,
        failure_count: null
      });
      continue;
    }

    const parsed = readJson(absolute);
    const summary = summarizeReport(relPath, parsed);
    checks.push(summary);

    if (parsed?.ok !== true) {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          relPath,
          "Promotion readiness is blocked because a required freeze proof report is absent or failing.",
          {
            verifier_id: summary.verifier_id,
            child_ok: summary.ok,
            failure_count: summary.failure_count
          }
        )
      );
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "postv1_promotion_readiness_runner",
    checked_at_utc: new Date().toISOString(),
    invariant: "promotion readiness must depend on completed freeze proof chain",
    required_reports: checks,
    failures,
    closure_gate: {
      invoked: false,
      ok: null,
      verifier_id: "freeze_governance_closure_gate"
    }
  };

  let cleanupTempPath = null;
  let reportCarrierPath = path.join(args.root, args.outputPath);

  if (!args.writeReport) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "promotion-readiness-"));
    reportCarrierPath = path.join(tempDir, "V1_PROMOTION_READINESS.json");
    cleanupTempPath = reportCarrierPath;
  }

  writeJson(reportCarrierPath, report);

  if (report.ok) {
    report.closure_gate.invoked = true;

    const closureResult = verifyFreezeGovernanceClosure(
      buildClosureComponentPaths(args.root, reportCarrierPath)
    );

    if (!closureResult.ok) {
      report.ok = false;
      report.closure_gate.ok = false;
      report.closure_gate.failures = closureResult.failures;

      report.failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          normalizeRel(args.outputPath),
          "Promotion readiness is blocked because freeze governance closure gate failed.",
          {
            verifier_id: "freeze_governance_closure_gate",
            child_ok: false,
            failure_count: Array.isArray(closureResult.failures) ? closureResult.failures.length : null
          }
        )
      );
    } else {
      report.closure_gate.ok = true;
      report.closure_gate.closure_count = closureResult.closure_count;
      report.closure_gate.promotion_payload_kind =
        typeof closureResult.promotion_payload_kind === "string"
          ? closureResult.promotion_payload_kind
          : null;
    }

    writeJson(reportCarrierPath, report);
  }

  if (args.writeReport) {
    writeJson(path.join(args.root, args.outputPath), report);
  }

  if (cleanupTempPath !== null && fs.existsSync(cleanupTempPath)) {
    fs.unlinkSync(cleanupTempPath);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();
