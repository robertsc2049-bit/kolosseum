#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    manifestPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    preservationReportPath: "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
    completenessReportPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
    packReportPath: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    reportPath: "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
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
    if (arg === "--preservation-report") {
      args.preservationReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--completeness-report") {
      args.completenessReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--pack-report") {
      args.packReportPath = argv[i + 1];
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

  return String(diff.stdout)
    .split(/\r?\n/)
    .map((line) => normalizeRel(line))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function evaluateProofReport(root, relPath) {
  const absolute = path.join(root, relPath);

  if (!fs.existsSync(absolute)) {
    return {
      path: relPath,
      ok: false,
      reason: "missing"
    };
  }

  const parsed = readJson(absolute);
  return {
    path: relPath,
    ok: parsed?.ok === true,
    reason: parsed?.ok === true ? "ok" : "not_ok"
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];

  const manifestAbs = path.join(args.root, args.manifestPath);
  if (!fs.existsSync(manifestAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.manifestPath), "Freeze evidence manifest missing."));
  }

  let governedPaths = [];
  let changedFiles = [];
  let changedGovernedPaths = [];
  let proofChecks = [];

  if (failures.length === 0) {
    const manifest = readJson(manifestAbs);
    governedPaths = collectGovernedPaths(manifest);

    changedFiles =
      args.changedFiles.length > 0
        ? args.changedFiles.map((entry) => normalizeRel(entry)).filter(Boolean).sort((a, b) => a.localeCompare(b))
        : detectChangedFiles(args.root, args.baseRef);

    const governedSet = new Set(governedPaths);
    changedGovernedPaths = changedFiles.filter((file) => governedSet.has(file));

    if (changedGovernedPaths.length > 0) {
      proofChecks = [
        evaluateProofReport(args.root, normalizeRel(args.preservationReportPath)),
        evaluateProofReport(args.root, normalizeRel(args.completenessReportPath)),
        evaluateProofReport(args.root, normalizeRel(args.packReportPath))
      ];

      for (const proof of proofChecks) {
        if (!proof.ok) {
          failures.push(
            buildFailure(
              "CI_MISSING_REQUIRED_PROOF",
              proof.path,
              "Sealed mainline change touched freeze-governed artefacts without required proof artefact passing.",
              {
                reason: proof.reason,
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
    verifier_id: "freeze_mainline_entry_guard",
    checked_at_utc: new Date().toISOString(),
    manifest: normalizeRel(args.manifestPath),
    base_ref: args.baseRef,
    invariant: "sealed freeze surfaces cannot change silently on mainline",
    governed_paths: governedPaths,
    changed_files: changedFiles,
    changed_governed_paths: changedGovernedPaths,
    required_proofs: proofChecks,
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