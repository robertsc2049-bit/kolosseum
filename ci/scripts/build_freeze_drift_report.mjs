#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    reportPath: "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    writeReport: true,
    childReports: [
      "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
      "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
      "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
      "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
    ]
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--report") {
      args.reportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--child-report") {
      args.childReports.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--replace-child-reports") {
      args.childReports = [];
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

function summarizeChildReport(relPath, parsed) {
  return {
    path: relPath,
    ok: parsed?.ok === true,
    verifier_id: typeof parsed?.verifier_id === "string" ? parsed.verifier_id : null,
    checked_at_utc: typeof parsed?.checked_at_utc === "string" ? parsed.checked_at_utc : null,
    failure_count: Array.isArray(parsed?.failures) ? parsed.failures.length : 0
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const childSummaries = [];

  const uniqueChildReports = Array.from(
    new Set(args.childReports.map((entry) => normalizeRel(entry)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  for (const relPath of uniqueChildReports) {
    const absolute = path.join(args.root, relPath);

    if (!fs.existsSync(absolute)) {
      failures.push(
        buildFailure(
          "CI_SPINE_MISSING_DOC",
          relPath,
          "Required freeze child report missing."
        )
      );
      continue;
    }

    const parsed = readJson(absolute);
    childSummaries.push(summarizeChildReport(relPath, parsed));

    if (parsed?.ok !== true) {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          relPath,
          "Freeze drift report requires all child reports to be present and passing.",
          {
            verifier_id: typeof parsed?.verifier_id === "string" ? parsed.verifier_id : null,
            child_ok: parsed?.ok === true
          }
        )
      );
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_drift_report_builder",
    checked_at_utc: new Date().toISOString(),
    invariant: "freeze state must be inspectable from one bounded report",
    child_report_count: uniqueChildReports.length,
    child_reports: childSummaries,
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