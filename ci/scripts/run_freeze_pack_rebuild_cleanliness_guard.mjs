#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    builderPath: "ci/scripts/build_operator_freeze_pack.mjs",
    artefactSetPath: "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
    reportPath: "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--builder") {
      args.builderPath = argv[i + 1];
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

function gitStatusPorcelain(root) {
  const result = spawnSync("git", ["status", "--porcelain=v1"], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`git status failed: ${result.stderr || result.stdout}`);
  }

  return String(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function runBuilder(nodeExe, builderAbs, root, artefactSetPath, outDirOverride) {
  return spawnSync(
    nodeExe,
    [
      builderAbs,
      "--root", root,
      "--set", artefactSetPath,
      "--out-dir", outDirOverride
    ],
    {
      cwd: root,
      encoding: "utf8"
    }
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];

  const builderAbs = path.join(args.root, args.builderPath);
  const artefactSetAbs = path.join(args.root, args.artefactSetPath);

  if (!fs.existsSync(builderAbs)) {
    failures.push(
      buildFailure(
        "CI_SPINE_MISSING_DOC",
        normalizeRel(args.builderPath),
        "Freeze pack builder missing."
      )
    );
  }

  if (!fs.existsSync(artefactSetAbs)) {
    failures.push(
      buildFailure(
        "CI_SPINE_MISSING_DOC",
        normalizeRel(args.artefactSetPath),
        "Operator freeze artefact set missing."
      )
    );
  }

  let beforeStatus = [];
  let afterStatus = [];
  let disposableOutputDir = null;
  let builderStdout = null;

  if (failures.length === 0) {
    const artefactSet = readJson(artefactSetAbs);
    if (!artefactSet || typeof artefactSet !== "object") {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.artefactSetPath),
          "Operator freeze artefact set must be a JSON object."
        )
      );
    } else if (!Array.isArray(artefactSet.artefacts) || artefactSet.artefacts.length === 0) {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.artefactSetPath),
          "Operator freeze artefact set must contain a non-empty artefacts array."
        )
      );
    }
  }

  if (failures.length === 0) {
    beforeStatus = gitStatusPorcelain(args.root);

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeze-pack-cleanliness-"));
    disposableOutputDir = normalizeRel(path.relative(args.root, path.join(tempRoot, "operator-freeze-pack")));

    try {
      const build = runBuilder(
        process.execPath,
        builderAbs,
        args.root,
        args.artefactSetPath,
        disposableOutputDir
      );

      builderStdout = build.stdout;

      if (build.status !== 0) {
        failures.push(
          buildFailure(
            "CI_MISSING_HARD_FAIL",
            normalizeRel(args.builderPath),
            "Freeze pack builder failed during cleanliness verification.",
            {
              stdout: build.stdout,
              stderr: build.stderr
            }
          )
        );
      }

      afterStatus = gitStatusPorcelain(args.root);

      if (beforeStatus.length !== afterStatus.length || beforeStatus.join("\n") !== afterStatus.join("\n")) {
        const beforeSet = new Set(beforeStatus);
        const afterSet = new Set(afterStatus);

        const introduced = afterStatus.filter((line) => !beforeSet.has(line));
        const removed = beforeStatus.filter((line) => !afterSet.has(line));

        if (introduced.length > 0) {
          for (const line of introduced) {
            failures.push(
              buildFailure(
                "CI_DIRTY_TREE_AFTER_BUILD",
                line,
                "Freeze pack rebuild introduced repo dirt.",
                {
                  before_status: beforeStatus,
                  after_status: afterStatus
                }
              )
            );
          }
        }

        if (removed.length > 0) {
          for (const line of removed) {
            failures.push(
              buildFailure(
                "CI_DIRTY_TREE_AFTER_BUILD",
                line,
                "Freeze pack rebuild changed existing repo dirt footprint.",
                {
                  before_status: beforeStatus,
                  after_status: afterStatus
                }
              )
            );
          }
        }
      }
    } finally {
      if (disposableOutputDir) {
        const disposableAbs = path.join(args.root, disposableOutputDir);
        if (fs.existsSync(disposableAbs)) {
          fs.rmSync(disposableAbs, { recursive: true, force: true });
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_pack_rebuild_cleanliness_guard",
    checked_at_utc: new Date().toISOString(),
    builder: normalizeRel(args.builderPath),
    artefact_set: normalizeRel(args.artefactSetPath),
    disposable_output_dir: disposableOutputDir,
    invariant: "standard freeze build path must leave clean working tree",
    before_status: beforeStatus,
    after_status: afterStatus,
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