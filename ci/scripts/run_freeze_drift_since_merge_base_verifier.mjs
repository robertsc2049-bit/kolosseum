#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    manifestPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    driftReportPath: "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
    reportPath: "docs/releases/V1_FREEZE_DRIFT_SINCE_MERGE_BASE.json",
    baseRef: "origin/main",
    changedFiles: [],
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--manifest") {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--drift-report") {
      args.driftReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--report") {
      args.reportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--base-ref") {
      args.baseRef = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--changed-file") {
      args.changedFiles.push(argv[i + 1]);
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

function collectGovernedPaths(manifest) {
  if (!Array.isArray(manifest.governed_artefacts)) {
    throw new Error("Freeze evidence manifest must contain governed_artefacts array.");
  }

  const out = [];
  for (const entry of manifest.governed_artefacts) {
    const relPath = normalizeRel(entry?.path ?? "");
    if (!relPath) {
      throw new Error("governed_artefacts entry missing path.");
    }
    out.push(relPath);
  }

  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}

function detectChangedFiles(root, baseRef) {
  const mergeBase = spawnSync("git", ["merge-base", baseRef, "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });

  if (mergeBase.status !== 0) {
    throw new Error(`git merge-base failed for ${baseRef}: ${mergeBase.stderr || mergeBase.stdout}`);
  }

  const baseSha = String(mergeBase.stdout).trim();
  if (!baseSha) {
    throw new Error(`git merge-base returned empty sha for ${baseRef}`);
  }

  const diff = spawnSync("git", ["diff", "--name-only", `${baseSha}..HEAD`], {
    cwd: root,
    encoding: "utf8"
  });

  if (diff.status !== 0) {
    throw new Error(`git diff failed: ${diff.stderr || diff.stdout}`);
  }

  return {
    mergeBase: baseSha,
    changedFiles: String(diff.stdout)
      .split(/\r?\n/)
      .map((line) => normalizeRel(line))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];

  const manifestAbs = path.join(args.root, args.manifestPath);
  const driftReportAbs = path.join(args.root, args.driftReportPath);

  if (!fs.existsSync(manifestAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.manifestPath), "Freeze evidence manifest missing."));
  }
  if (!fs.existsSync(driftReportAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.driftReportPath), "Freeze drift report missing."));
  }

  let governedPaths = [];
  let mergeBase = null;
  let changedFiles = [];
  let changedGovernedPaths = [];
  let driftReport = null;

  if (failures.length === 0) {
    const manifest = readJson(manifestAbs);
    governedPaths = collectGovernedPaths(manifest);

    if (args.changedFiles.length > 0) {
      changedFiles = Array.from(
        new Set(args.changedFiles.map((entry) => normalizeRel(entry)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
    } else {
      const detected = detectChangedFiles(args.root, args.baseRef);
      mergeBase = detected.mergeBase;
      changedFiles = detected.changedFiles;
    }

    const governedSet = new Set(governedPaths);
    changedGovernedPaths = changedFiles.filter((file) => governedSet.has(file));

    driftReport = readJson(driftReportAbs);

    if (driftReport?.ok !== true) {
      failures.push(
        buildFailure(
          "CI_MISSING_REQUIRED_PROOF",
          normalizeRel(args.driftReportPath),
          "Freeze drift since merge-base requires a passing aggregated freeze drift report.",
          {
            drift_report_ok: driftReport?.ok === true
          }
        )
      );
    }

    if (!Array.isArray(driftReport?.child_reports)) {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.driftReportPath),
          "Freeze drift report must contain child_reports array."
        )
      );
    }

    if (Array.isArray(driftReport?.child_reports) && driftReport.child_reports.length === 0) {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.driftReportPath),
          "Freeze drift report must enumerate at least one child report."
        )
      );
    }

    if (changedGovernedPaths.length > 0 && driftReport?.ok === true) {
      const requiredChildPaths = [
        "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
        "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
        "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
        "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json"
      ];

      const reportedChildPaths = new Set(
        Array.isArray(driftReport.child_reports)
          ? driftReport.child_reports
              .map((entry) => normalizeRel(entry?.path ?? ""))
              .filter(Boolean)
          : []
      );

      for (const relPath of requiredChildPaths) {
        if (!reportedChildPaths.has(relPath)) {
          failures.push(
            buildFailure(
              "CI_MISSING_REQUIRED_PROOF",
              relPath,
              "Freeze drift report is not fresh enough for governed drift because a required child proof is absent from the aggregate.",
              {
                changed_governed_paths: changedGovernedPaths
              }
            )
          );
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_drift_since_merge_base_verifier",
    checked_at_utc: new Date().toISOString(),
    manifest: normalizeRel(args.manifestPath),
    drift_report: normalizeRel(args.driftReportPath),
    base_ref: args.baseRef,
    merge_base: mergeBase,
    invariant: "freeze-governed drift since merge-base must not exist without a fresh aggregated freeze report",
    governed_paths: governedPaths,
    changed_files: changedFiles,
    changed_governed_paths: changedGovernedPaths,
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