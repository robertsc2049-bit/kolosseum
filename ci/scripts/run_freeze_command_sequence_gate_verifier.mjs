#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    commandOrderPath: "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
    reportPath: "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--command-order") {
      args.commandOrderPath = argv[i + 1];
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

function collectStepRecords(node, out = []) {
  if (Array.isArray(node)) {
    for (const value of node) {
      collectStepRecords(value, out);
    }
    return out;
  }

  if (!node || typeof node !== "object") {
    return out;
  }

  const candidateName =
    typeof node.id === "string" ? node.id :
    typeof node.step_id === "string" ? node.step_id :
    typeof node.name === "string" ? node.name :
    typeof node.title === "string" ? node.title :
    null;

  const candidatePath =
    typeof node.script === "string" ? node.script :
    typeof node.path === "string" ? node.path :
    typeof node.surface === "string" ? node.surface :
    typeof node.file === "string" ? node.file :
    null;

  if (candidateName || candidatePath) {
    out.push({
      id: candidateName ? normalizeRel(candidateName).toLowerCase() : null,
      path: candidatePath ? normalizeRel(candidatePath) : null,
      raw: node
    });
  }

  for (const value of Object.values(node)) {
    collectStepRecords(value, out);
  }

  return out;
}

function findIndexByPathOrId(records, expected) {
  const expectedPath = expected.path ? normalizeRel(expected.path) : null;
  const expectedId = expected.id ? expected.id.toLowerCase() : null;

  return records.findIndex((record) => {
    const pathMatch = expectedPath && record.path === expectedPath;
    const idMatch = expectedId && record.id === expectedId;
    return Boolean(pathMatch || idMatch);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const commandOrderAbs = path.join(args.root, args.commandOrderPath);

  if (!fs.existsSync(commandOrderAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.commandOrderPath), "Freeze command order document missing."));
  }

  const requiredSequence = [
    {
      key: "freeze_state_established",
      path: "docs/releases/V1_FREEZE_STATE.json"
    },
    {
      key: "manifest_completeness_verified",
      path: "ci/scripts/run_freeze_evidence_manifest_completeness_verifier.mjs"
    },
    {
      key: "manifest_self_hash_verified",
      path: "ci/scripts/run_freeze_evidence_manifest_self_hash_verifier.mjs"
    },
    {
      key: "mainline_preservation_verified",
      path: "ci/scripts/run_mainline_freeze_preservation_verifier.mjs"
    },
    {
      key: "operator_bundle_built",
      path: "ci/scripts/build_operator_freeze_pack.mjs"
    },
    {
      key: "operator_bundle_composition_verified",
      path: "ci/scripts/run_operator_freeze_pack_composition_verifier.mjs"
    },
    {
      key: "operator_bundle_preservation_verified",
      path: "ci/scripts/run_operator_freeze_bundle_preservation_verifier.mjs"
    },
    {
      key: "operator_bundle_surface_completeness_verified",
      path: "ci/scripts/run_operator_freeze_bundle_surface_completeness_verifier.mjs"
    }
  ];

  let located = [];

  if (failures.length === 0) {
    const commandOrder = readJson(commandOrderAbs);
    const records = collectStepRecords(commandOrder);

    if (records.length === 0) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.commandOrderPath), "No addressable steps found in freeze command order document."));
    } else {
      located = requiredSequence.map((expected) => {
        const index = findIndexByPathOrId(records, expected);
        return {
          key: expected.key,
          path: expected.path,
          index
        };
      });

      for (const item of located) {
        if (item.index === -1) {
          failures.push(buildFailure(
            "CI_SPINE_MISSING_DOC",
            item.path,
            "Required freeze command sequence step missing from command order."
          ));
        }
      }

      const present = located.filter((item) => item.index !== -1);
      for (let i = 1; i < present.length; i += 1) {
        const prev = present[i - 1];
        const curr = present[i];
        if (curr.index <= prev.index) {
          failures.push(buildFailure(
            "CI_ORDER_VIOLATION",
            normalizeRel(args.commandOrderPath),
            "Freeze command order violates lawful sequencing.",
            {
              earlier_required_step: prev.key,
              earlier_required_path: prev.path,
              earlier_index: prev.index,
              later_required_step: curr.key,
              later_required_path: curr.path,
              later_index: curr.index
            }
          ));
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_command_sequence_gate_verifier",
    checked_at_utc: new Date().toISOString(),
    command_order: normalizeRel(args.commandOrderPath),
    invariant: "freeze packaging and preservation checks must not run before freeze state + manifest integrity are established",
    required_sequence: located,
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