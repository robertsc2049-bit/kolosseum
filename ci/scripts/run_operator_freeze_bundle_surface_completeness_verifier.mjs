#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    bundleSetPath: "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    freezeRunbookPath: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    commandOrderPath: "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    rollbackRunbookPath: "docs/releases/V1_ROLLBACK_RUNBOOK.md",
    reportPath: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--bundle-set") {
      args.bundleSetPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--freeze-runbook") {
      args.freezeRunbookPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--command-order") {
      args.commandOrderPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--rollback-runbook") {
      args.rollbackRunbookPath = argv[i + 1];
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

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function writeReport(root, reportPath, report) {
  const absolute = path.join(root, reportPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function collectPathReferencesFromText(text) {
  const refs = new Set();
  const regex = /\b(?:docs|ci)\/[A-Za-z0-9._\-\/ ]+\.(?:md|json|mjs|txt)\b/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    refs.add(normalizeRel(match[0]));
  }

  return refs;
}

function walkJson(node, refs) {
  if (Array.isArray(node)) {
    for (const value of node) {
      walkJson(value, refs);
    }
    return;
  }

  if (node && typeof node === "object") {
    for (const value of Object.values(node)) {
      walkJson(value, refs);
    }
    return;
  }

  if (typeof node === "string") {
    for (const ref of collectPathReferencesFromText(node)) {
      refs.add(ref);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];

  const bundleSetAbs = path.join(args.root, args.bundleSetPath);
  const freezeRunbookAbs = path.join(args.root, args.freezeRunbookPath);
  const commandOrderAbs = path.join(args.root, args.commandOrderPath);
  const rollbackRunbookAbs = path.join(args.root, args.rollbackRunbookPath);

  const requiredInputs = [
    { rel: normalizeRel(args.bundleSetPath), abs: bundleSetAbs },
    { rel: normalizeRel(args.freezeRunbookPath), abs: freezeRunbookAbs },
    { rel: normalizeRel(args.commandOrderPath), abs: commandOrderAbs },
    { rel: normalizeRel(args.rollbackRunbookPath), abs: rollbackRunbookAbs }
  ];

  for (const item of requiredInputs) {
    if (!fs.existsSync(item.abs)) {
      failures.push(buildFailure("CI_SPINE_MISSING_DOC", item.rel, "Required operator freeze source surface missing."));
    }
  }

  let bundleSet = null;
  let declared = [];
  let referenced = [];

  if (failures.length === 0) {
    bundleSet = readJson(bundleSetAbs);

    if (!bundleSet || typeof bundleSet !== "object") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.bundleSetPath), "Operator freeze artefact set must be a JSON object."));
    } else if (!Array.isArray(bundleSet.artefacts) || bundleSet.artefacts.length === 0) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.bundleSetPath), "Operator freeze artefact set must contain a non-empty artefacts array."));
    } else {
      declared = bundleSet.artefacts.map((entry) => normalizeRel(String(entry).trim()));

      const refs = new Set();
      refs.add(normalizeRel(args.freezeRunbookPath));
      refs.add(normalizeRel(args.commandOrderPath));
      refs.add(normalizeRel(args.rollbackRunbookPath));

      for (const ref of collectPathReferencesFromText(readText(freezeRunbookAbs))) {
        refs.add(ref);
      }
      for (const ref of collectPathReferencesFromText(readText(rollbackRunbookAbs))) {
        refs.add(ref);
      }

      const commandOrder = readJson(commandOrderAbs);
      walkJson(commandOrder, refs);

      referenced = Array.from(refs).sort((a, b) => a.localeCompare(b));

      const declaredSet = new Set(declared);
      const referencedSet = new Set(referenced);

      for (const relPath of referenced) {
        const absolute = path.join(args.root, relPath);

        if (!fs.existsSync(absolute)) {
          failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Referenced operator-needed freeze surface missing from repo."));
          continue;
        }

        if (!declaredSet.has(relPath)) {
          failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Referenced operator-needed freeze surface missing from operator freeze bundle artefact set."));
        }
      }

      for (const relPath of declared) {
        if (!referencedSet.has(relPath)) {
          failures.push(buildFailure("CI_MANIFEST_MISMATCH", relPath, "Undeclared extra surface in operator freeze bundle artefact set relative to operator law surfaces."));
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "operator_freeze_bundle_surface_completeness_verifier",
    checked_at_utc: new Date().toISOString(),
    bundle_set: normalizeRel(args.bundleSetPath),
    freeze_runbook: normalizeRel(args.freezeRunbookPath),
    command_order: normalizeRel(args.commandOrderPath),
    rollback_runbook: normalizeRel(args.rollbackRunbookPath),
    invariant: "handoff bundle must be minimal and sufficient",
    referenced_surfaces: referenced,
    declared_bundle_surfaces: declared,
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