#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    indexPath: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
    writeReport: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--index") {
      args.indexPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--write-report") {
      args.writeReport = true;
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

function requiredEntries() {
  return [
    {
      slice_id: "P114",
      proof_surface: "docs/releases/V1_FREEZE_ROLLBACK_COMPATIBILITY.json",
      invariant: "freeze rollback must stay compatible with sealed freeze semantics",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P115",
      proof_surface: "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json",
      invariant: "mainline freeze preservation must remain byte-stable across governed surfaces",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P116",
      proof_surface: "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json",
      invariant: "operator freeze bundle input surface must stay deterministic and bounded",
      proof_type: "bundle_spec"
    },
    {
      slice_id: "P117",
      proof_surface: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
      invariant: "operator freeze bundle rebuild must not drift from governed source artefacts",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P118",
      proof_surface: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_COMPLETENESS.json",
      invariant: "freeze manifest must fully enumerate governed byte identities",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P119",
      proof_surface: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
      invariant: "freeze evidence manifest cannot drift structurally without fresh governed artefact recomputation",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P120",
      proof_surface: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_SURFACE_COMPLETENESS.json",
      invariant: "handoff bundle must be minimal and sufficient",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P121",
      proof_surface: "docs/releases/V1_FREEZE_COMMAND_SEQUENCE_GATE.json",
      invariant: "freeze packaging and preservation checks must not run before freeze state + manifest integrity are established",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P122",
      proof_surface: "docs/releases/V1_FREEZE_MAINLINE_ENTRY_GUARD.json",
      invariant: "sealed freeze surfaces cannot change silently on mainline",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P123",
      proof_surface: "docs/releases/V1_FREEZE_DRIFT_REPORT.json",
      invariant: "freeze state must be inspectable from one bounded report",
      proof_type: "aggregate_report"
    },
    {
      slice_id: "P124",
      proof_surface: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
      invariant: "freeze cannot be declared complete while any freeze-proof surface is absent or failing",
      proof_type: "verifier_report"
    },
    {
      slice_id: "P125",
      proof_surface: "docs/releases/V1_PROMOTION_READINESS.json",
      invariant: "promotion readiness must depend on completed freeze proof chain",
      proof_type: "readiness_report"
    },
    {
      slice_id: "P126",
      proof_surface: "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json",
      invariant: "standard freeze build path must leave clean working tree",
      proof_type: "verifier_report"
    }
  ];
}

function canonicalIndex() {
  const entries = requiredEntries();
  return {
    ok: true,
    verifier_id: "freeze_proof_index_verifier",
    checked_at_utc: new Date().toISOString(),
    invariant: "freeze governance must be inspectable from one authoritative proof map",
    proof_entry_count: entries.length,
    proof_entries: entries
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const indexAbs = path.join(args.root, args.indexPath);

  if (!fs.existsSync(indexAbs)) {
    failures.push(
      buildFailure(
        "CI_SPINE_MISSING_DOC",
        normalizeRel(args.indexPath),
        "Freeze proof index missing."
      )
    );
  }

  const expectedEntries = requiredEntries();
  const expectedBySlice = new Map(expectedEntries.map((entry) => [entry.slice_id, entry]));
  const expectedByPath = new Map(expectedEntries.map((entry) => [entry.proof_surface, entry]));

  let actual = null;
  let actualEntries = [];
  let seenSlices = new Set();
  let seenPaths = new Set();

  if (failures.length === 0) {
    actual = readJson(indexAbs);

    if (!actual || typeof actual !== "object") {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.indexPath),
          "Freeze proof index must be a JSON object."
        )
      );
    } else if (!Array.isArray(actual.proof_entries)) {
      failures.push(
        buildFailure(
          "CI_REGISTRY_STRUCTURE_INVALID",
          normalizeRel(args.indexPath),
          "Freeze proof index must contain proof_entries array."
        )
      );
    } else {
      actualEntries = actual.proof_entries.map((entry) => ({
        slice_id: String(entry?.slice_id ?? "").trim(),
        proof_surface: normalizeRel(entry?.proof_surface ?? ""),
        invariant: String(entry?.invariant ?? "").trim(),
        proof_type: String(entry?.proof_type ?? "").trim()
      }));

      for (const entry of actualEntries) {
        if (!entry.slice_id) {
          failures.push(
            buildFailure(
              "CI_REGISTRY_STRUCTURE_INVALID",
              normalizeRel(args.indexPath),
              "Freeze proof index entry missing slice_id."
            )
          );
          continue;
        }

        if (seenSlices.has(entry.slice_id)) {
          failures.push(
            buildFailure(
              "CI_REGISTRY_STRUCTURE_INVALID",
              entry.slice_id,
              "Duplicate freeze proof index entry by slice_id."
            )
          );
        }
        seenSlices.add(entry.slice_id);

        if (!entry.proof_surface) {
          failures.push(
            buildFailure(
              "CI_REGISTRY_STRUCTURE_INVALID",
              entry.slice_id,
              "Freeze proof index entry missing proof_surface."
            )
          );
          continue;
        }

        if (seenPaths.has(entry.proof_surface)) {
          failures.push(
            buildFailure(
              "CI_REGISTRY_STRUCTURE_INVALID",
              entry.proof_surface,
              "Duplicate freeze proof index entry by proof_surface."
            )
          );
        }
        seenPaths.add(entry.proof_surface);

        const surfaceAbs = path.join(args.root, entry.proof_surface);
        if (!fs.existsSync(surfaceAbs)) {
          failures.push(
            buildFailure(
              "CI_SPINE_MISSING_DOC",
              entry.proof_surface,
              "Indexed freeze proof surface missing from repo."
            )
          );
        }
      }

      for (const expected of expectedEntries) {
        const actualBySlice = actualEntries.find((entry) => entry.slice_id === expected.slice_id);
        if (!actualBySlice) {
          failures.push(
            buildFailure(
              "CI_SPINE_MISSING_DOC",
              expected.slice_id,
              "Required freeze proof index entry missing."
            )
          );
          continue;
        }

        if (actualBySlice.proof_surface !== expected.proof_surface) {
          failures.push(
            buildFailure(
              "CI_MANIFEST_MISMATCH",
              expected.slice_id,
              "Freeze proof index proof_surface mismatch.",
              {
                expected_proof_surface: expected.proof_surface,
                actual_proof_surface: actualBySlice.proof_surface
              }
            )
          );
        }

        if (actualBySlice.invariant !== expected.invariant) {
          failures.push(
            buildFailure(
              "CI_MANIFEST_MISMATCH",
              expected.slice_id,
              "Freeze proof index invariant mismatch.",
              {
                expected_invariant: expected.invariant,
                actual_invariant: actualBySlice.invariant
              }
            )
          );
        }

        if (actualBySlice.proof_type !== expected.proof_type) {
          failures.push(
            buildFailure(
              "CI_MANIFEST_MISMATCH",
              expected.slice_id,
              "Freeze proof index proof_type mismatch.",
              {
                expected_proof_type: expected.proof_type,
                actual_proof_type: actualBySlice.proof_type
              }
            )
          );
        }
      }

      for (const actualEntry of actualEntries) {
        if (!expectedBySlice.has(actualEntry.slice_id)) {
          failures.push(
            buildFailure(
              "CI_MANIFEST_MISMATCH",
              actualEntry.slice_id,
              "Stale extra freeze proof index entry present."
            )
          );
        } else if (!expectedByPath.has(actualEntry.proof_surface)) {
          failures.push(
            buildFailure(
              "CI_MANIFEST_MISMATCH",
              actualEntry.proof_surface,
              "Stale extra freeze proof surface present."
            )
          );
        }
      }

      if (actualEntries.length !== expectedEntries.length) {
        failures.push(
          buildFailure(
            "CI_MANIFEST_MISMATCH",
            normalizeRel(args.indexPath),
            "Freeze proof index entry count mismatch.",
            {
              expected_count: expectedEntries.length,
              actual_count: actualEntries.length
            }
          )
        );
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_proof_index_verifier",
    checked_at_utc: new Date().toISOString(),
    invariant: "freeze governance must be inspectable from one authoritative proof map",
    proof_entry_count: actualEntries.length,
    expected_proof_entry_count: expectedEntries.length,
    failures
  };

  if (args.writeReport) {
    writeJson(indexAbs, canonicalIndex());
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();