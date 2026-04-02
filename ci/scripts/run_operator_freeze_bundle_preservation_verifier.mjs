#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    setPath: "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    builderPath: "ci/scripts/build_operator_freeze_pack.mjs",
    reportPath: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--set") {
      args.setPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--builder") {
      args.builderPath = argv[i + 1];
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
  return input.replace(/\\/g, "/");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function listFilesRecursive(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }

  return out;
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function writeReport(root, reportPath, report) {
  const absolute = path.join(root, reportPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function snapshotDir(rootDir) {
  const files = listFilesRecursive(rootDir)
    .map((fullPath) => normalizeRel(path.relative(rootDir, fullPath)))
    .sort();

  const entries = files.map((relPath) => {
    const absolute = path.join(rootDir, relPath);
    return {
      path: relPath,
      sha256: sha256File(absolute)
    };
  });

  return {
    file_count: entries.length,
    files: entries,
    directory_sha256: sha256Bytes(Buffer.from(JSON.stringify(entries), "utf8"))
  };
}

function runBuilder(nodeExe, builderAbs, root, setPath) {
  return spawnSync(
    nodeExe,
    [builderAbs, "--root", root, "--set", setPath],
    {
      encoding: "utf8"
    }
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const setAbs = path.join(args.root, args.setPath);
  const builderAbs = path.join(args.root, args.builderPath);
  const failures = [];

  if (!fs.existsSync(setAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.setPath), "Operator freeze artefact set missing."));
  }
  if (!fs.existsSync(builderAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.builderPath), "Operator freeze pack builder missing."));
  }

  let artefactSet = null;
  let outputDirRel = null;

  if (failures.length === 0) {
    artefactSet = readJson(setAbs);
    if (!artefactSet || typeof artefactSet !== "object") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must be a JSON object."));
    } else if (!Array.isArray(artefactSet.artefacts) || artefactSet.artefacts.length === 0) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must contain a non-empty artefacts array."));
    } else if (typeof artefactSet.output_dir !== "string" || artefactSet.output_dir.trim() === "") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must declare output_dir."));
    } else {
      outputDirRel = normalizeRel(artefactSet.output_dir.trim());
    }
  }

  let snapshotA = null;
  let snapshotB = null;

  if (failures.length === 0) {
    const originalOutputAbs = path.join(args.root, outputDirRel);
    const backupAbs = path.join(args.root, `${outputDirRel}.__p117_backup__`);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "operator-freeze-preservation-"));
    const runARoot = path.join(tempRoot, "run-a");
    const runBRoot = path.join(tempRoot, "run-b");

    ensureDir(runARoot);
    ensureDir(runBRoot);

    if (fs.existsSync(backupAbs)) {
      fs.rmSync(backupAbs, { recursive: true, force: true });
    }

    const hadOriginalOutput = fs.existsSync(originalOutputAbs);
    if (hadOriginalOutput) {
      ensureDir(path.dirname(backupAbs));
      fs.renameSync(originalOutputAbs, backupAbs);
    }

    try {
      const runA = runBuilder(process.execPath, builderAbs, args.root, args.setPath);
      if (runA.status !== 0) {
        failures.push(buildFailure("CI_MISSING_HARD_FAIL", normalizeRel(args.builderPath), "First operator freeze bundle rebuild failed.", { stderr: runA.stderr, stdout: runA.stdout }));
      } else {
        fs.cpSync(path.join(args.root, outputDirRel), runARoot, { recursive: true });
        snapshotA = snapshotDir(runARoot);
      }

      const runB = runBuilder(process.execPath, builderAbs, args.root, args.setPath);
      if (runB.status !== 0) {
        failures.push(buildFailure("CI_MISSING_HARD_FAIL", normalizeRel(args.builderPath), "Second operator freeze bundle rebuild failed.", { stderr: runB.stderr, stdout: runB.stdout }));
      } else {
        fs.cpSync(path.join(args.root, outputDirRel), runBRoot, { recursive: true });
        snapshotB = snapshotDir(runBRoot);
      }

      if (snapshotA && snapshotB) {
        if (snapshotA.file_count !== snapshotB.file_count) {
          failures.push(buildFailure("CI_NON_DETERMINISTIC_OUTPUT", outputDirRel, "Rebuilt operator freeze bundle file count drifted across rebuilds.", { first_file_count: snapshotA.file_count, second_file_count: snapshotB.file_count }));
        }

        const mapA = new Map(snapshotA.files.map((entry) => [entry.path, entry.sha256]));
        const mapB = new Map(snapshotB.files.map((entry) => [entry.path, entry.sha256]));
        const allPaths = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

        for (const relPath of allPaths) {
          const a = mapA.get(relPath);
          const b = mapB.get(relPath);

          if (!a || !b) {
            failures.push(buildFailure("CI_NON_DETERMINISTIC_OUTPUT", normalizeRel(path.join(outputDirRel, relPath)), "Bundle path presence drifted across rebuilds.", { first_sha256: a ?? null, second_sha256: b ?? null }));
            continue;
          }

          if (a !== b) {
            failures.push(buildFailure("CI_NON_DETERMINISTIC_OUTPUT", normalizeRel(path.join(outputDirRel, relPath)), "Bundle file bytes drifted across rebuilds.", { first_sha256: a, second_sha256: b }));
          }
        }

        if (snapshotA.directory_sha256 !== snapshotB.directory_sha256) {
          failures.push(buildFailure("CI_NON_DETERMINISTIC_OUTPUT", outputDirRel, "Bundle manifest + copied artefact hashes drifted across rebuilds.", { first_directory_sha256: snapshotA.directory_sha256, second_directory_sha256: snapshotB.directory_sha256 }));
        }
      }
    } finally {
      fs.rmSync(path.join(args.root, outputDirRel), { recursive: true, force: true });

      if (hadOriginalOutput && fs.existsSync(backupAbs)) {
        ensureDir(path.dirname(originalOutputAbs));
        fs.renameSync(backupAbs, originalOutputAbs);
      } else if (fs.existsSync(backupAbs)) {
        fs.rmSync(backupAbs, { recursive: true, force: true });
      }

      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "operator_freeze_bundle_preservation_verifier",
    checked_at_utc: new Date().toISOString(),
    set: normalizeRel(args.setPath),
    builder: normalizeRel(args.builderPath),
    output_dir: outputDirRel,
    invariant: "operator freeze bundle rebuild must not drift from governed source artefacts",
    first_rebuild_directory_sha256: snapshotA?.directory_sha256 ?? null,
    second_rebuild_directory_sha256: snapshotB?.directory_sha256 ?? null,
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