#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    freezeStatePath: "docs/releases/V1_FREEZE_STATE.json",
    reportPath: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--freeze-state") {
      args.freezeStatePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--report") {
      args.reportPath = argv[i + 1];
      i += 1;
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

function writeReport(root, reportPath, report) {
  const absolute = path.join(root, reportPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function summarizeProofReport(relPath, parsed) {
  return {
    path: relPath,
    ok: parsed?.ok === true,
    verifier_id: typeof parsed?.verifier_id === "string" ? parsed.verifier_id : null,
    checked_at_utc: typeof parsed?.checked_at_utc === "string" ? parsed.checked_at_utc : null,
    failure_count: Array.isArray(parsed?.failures) ? parsed.failures.length : 0
  };
}

function requiredFreezeProofReports() {
  return [
    "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
    "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
    "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
    "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
    "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
    "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json"
  ];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const freezeStateAbs = path.join(args.root, args.freezeStatePath);
  const proofPaths = requiredFreezeProofReports();
  const proofSummaries = [];

  let freezeState = null;
  let freezeDeclared = null;

  if (!fs.existsSync(freezeStateAbs)) {
    failures.push(
      buildFailure(
        "CI_SPINE_MISSING_DOC",
        normalizeRel(args.freezeStatePath),
        "Freeze state declaration missing."
      )
    );
  } else {
    const parsedState = readJson(freezeStateAbs);
    freezeState = typeof parsedState?.freeze_state === "string" ? parsedState.freeze_state : null;
    freezeDeclared = parsedState?.freeze_declared === true;

    if (freezeState !== "sealed") {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          normalizeRel(args.freezeStatePath),
          "Freeze exit criteria requires freeze_state to be sealed.",
          { actual_freeze_state: freezeState }
        )
      );
    }

    if (freezeDeclared !== true) {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          normalizeRel(args.freezeStatePath),
          "Freeze exit criteria requires freeze_declared=true.",
          { freeze_declared: freezeDeclared }
        )
      );
    }
  }

  for (const relPath of proofPaths) {
    const absolute = path.join(args.root, relPath);

    if (!fs.existsSync(absolute)) {
      failures.push(
        buildFailure(
          "CI_SPINE_MISSING_DOC",
          relPath,
          "Required freeze proof report missing."
        )
      );
      proofSummaries.push({
        path: relPath,
        ok: false,
        verifier_id: null,
        checked_at_utc: null,
        failure_count: null
      });
      continue;
    }

    const parsed = readJson(absolute);
    const summary = summarizeProofReport(relPath, parsed);
    proofSummaries.push(summary);

    if (parsed?.ok !== true) {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          relPath,
          "Freeze cannot be declared complete while a required freeze proof report is absent or failing.",
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
    verifier_id: "freeze_exit_criteria_verifier",
    checked_at_utc: new Date().toISOString(),
    invariant: "freeze cannot be declared complete while any freeze-proof surface is absent or failing",
    freeze_state_path: normalizeRel(args.freezeStatePath),
    freeze_state: freezeState,
    freeze_declared: freezeDeclared,
    required_freeze_proof_reports: proofSummaries,
    failures
  };

  if (args.writeReport) {
    writeReport(args.root, args.reportPath, report);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();