#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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
    failures
  };

  if (args.writeReport) {
    writeJson(path.join(args.root, args.outputPath), report);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();