#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    manifestPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    artefactSetPath: "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
    reportPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
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
    if (arg === "--artefact-set") {
      args.artefactSetPath = argv[i + 1];
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
  return input.replace(/\\/g, "/").trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function walkFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }

  return out;
}

function expectedGovernedPaths(root, manifest, artefactSet, selfReportPath) {
  const governed = new Set();

  if (!Array.isArray(manifest.artefacts)) {
    throw new Error("Freeze evidence manifest: artefacts must be an array.");
  }
  if (!Array.isArray(artefactSet.artefacts)) {
    throw new Error("Freeze artefact set: artefacts must be an array.");
  }

  for (const item of manifest.artefacts) {
    if (item && typeof item.path === "string") {
      const relPath = normalizeRel(item.path);
      if (relPath && relPath !== "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json") {
        governed.add(relPath);
      }
    }
  }

  for (const item of artefactSet.artefacts) {
    if (typeof item === "string" && item.trim()) {
      governed.add(normalizeRel(item));
    }
  }

  const includeGlobs = Array.isArray(manifest.discovery?.include_globs) ? manifest.discovery.include_globs : [];
  const excludePaths = new Set(
    (Array.isArray(manifest.discovery?.exclude_paths) ? manifest.discovery.exclude_paths : [])
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => normalizeRel(x))
  );

  if (includeGlobs.length > 0) {
    const allFiles = walkFiles(path.join(root, "docs", "releases"))
      .map((filePath) => normalizeRel(path.relative(root, filePath)));

    const includeRegexes = includeGlobs.map(globToRegex);

    for (const relPath of allFiles) {
      if (excludePaths.has(relPath)) {
        continue;
      }
      if (includeRegexes.some((rx) => rx.test(relPath))) {
        governed.add(relPath);
      }
    }
  }

  governed.delete("docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json");
  governed.delete("docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json");
  governed.delete(normalizeRel(selfReportPath));

  return Array.from(governed).sort((a, b) => a.localeCompare(b));
}

function writeReport(root, reportPath, report) {
  const absolute = path.join(root, reportPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestAbs = path.join(args.root, args.manifestPath);
  const artefactSetAbs = path.join(args.root, args.artefactSetPath);
  const failures = [];

  if (!fs.existsSync(manifestAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.manifestPath), "Freeze evidence manifest missing."));
  }
  if (!fs.existsSync(artefactSetAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.artefactSetPath), "Freeze artefact set missing."));
  }

  let manifest = null;
  let artefactSet = null;
  let expected = [];
  let actual = [];

  if (failures.length === 0) {
    manifest = readJson(manifestAbs);
    artefactSet = readJson(artefactSetAbs);

    if (!Array.isArray(manifest.governed_artefacts)) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.manifestPath), "Freeze evidence manifest must contain governed_artefacts array."));
    } else {
      expected = expectedGovernedPaths(args.root, manifest, artefactSet, args.reportPath);
      actual = manifest.governed_artefacts.map((entry) => normalizeRel(String(entry?.path ?? ""))).filter(Boolean);

      const seen = new Set();
      for (const relPath of actual) {
        if (seen.has(relPath)) {
          failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", relPath, "Duplicate governed_artefacts path found in freeze evidence manifest."));
        }
        seen.add(relPath);
      }

      const actualSet = new Set(actual);
      const expectedSet = new Set(expected);

      for (const relPath of expected) {
        if (!actualSet.has(relPath)) {
          failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Freeze-governed artefact missing from governed_artefacts."));
        }
      }

      for (const relPath of actual) {
        if (!expectedSet.has(relPath)) {
          failures.push(buildFailure("CI_MANIFEST_MISMATCH", relPath, "Stale extra governed_artefacts entry present in freeze evidence manifest."));
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_evidence_manifest_completeness_verifier",
    checked_at_utc: new Date().toISOString(),
    manifest: normalizeRel(args.manifestPath),
    artefact_set: normalizeRel(args.artefactSetPath),
    invariant: "freeze manifest must fully enumerate governed byte identities",
    expected_governed_paths: expected,
    actual_governed_paths: actual,
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