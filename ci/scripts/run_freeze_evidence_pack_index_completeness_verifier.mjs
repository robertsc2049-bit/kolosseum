#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_INDEX_PATH = "docs/releases/V1_FREEZE_EVIDENCE_PACK_INDEX.json";

export const REQUIRED_REVIEW_SURFACES = Object.freeze([
  { id: "operator_runbook", path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md", role: "operator_runbook" },
  { id: "freeze_proof_index", path: "docs/releases/V1_FREEZE_PROOF_INDEX.json", role: "proof_index" },
  { id: "freeze_proof_chain", path: "docs/releases/V1_FREEZE_PROOF_CHAIN.json", role: "proof_chain" },
  { id: "freeze_drift_status", path: "docs/releases/V1_FREEZE_DRIFT_STATUS.json", role: "drift_status" },
  { id: "freeze_bundle_preservation", path: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json", role: "packet_integrity" },
  { id: "freeze_pack_cleanliness", path: "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json", role: "cleanliness" },
  { id: "freeze_exit_criteria", path: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", role: "exit_criteria" },
  { id: "promotion_readiness", path: "docs/releases/V1_PROMOTION_READINESS.json", role: "promotion_readiness" }
]);

function normalizeRel(input) {
  return String(input).replace(/\\/g, "/").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(token, file, details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token,
        file,
        details,
        ...extra
      }
    ]
  };
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    inputPath: DEFAULT_INDEX_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--input") {
      args.inputPath = argv[i + 1];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function compareStringArrays(a, b) {
  return JSON.stringify([...a].sort((x, y) => x.localeCompare(y))) === JSON.stringify([...b].sort((x, y) => x.localeCompare(y)));
}

export function verifyFreezeEvidencePackIndexCompleteness({
  root = process.cwd(),
  inputPath = DEFAULT_INDEX_PATH
} = {}) {
  const normalizedInputPath = normalizeRel(inputPath);
  const absoluteInputPath = path.resolve(root, inputPath);

  if (!fs.existsSync(absoluteInputPath)) {
    return fail(
      "CI_SPINE_MISSING_DOC",
      normalizedInputPath,
      "Freeze evidence pack index is missing."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8"));
  } catch (error) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      `Freeze evidence pack index contains invalid JSON: ${error.message}`
    );
  }

  if (!isPlainObject(parsed)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Freeze evidence pack index must be a JSON object."
    );
  }

  if (!Array.isArray(parsed.review_surfaces)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Freeze evidence pack index must contain review_surfaces array.",
      { path: "review_surfaces" }
    );
  }

  const normalizedActual = parsed.review_surfaces.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(`review_surfaces[${i}] must be an object`);
    }

    return {
      id: typeof entry.id === "string" ? entry.id.trim() : "",
      path: normalizeRel(entry.path ?? ""),
      role: typeof entry.role === "string" ? entry.role.trim() : ""
    };
  });

  for (let i = 0; i < normalizedActual.length; i += 1) {
    const entry = normalizedActual[i];

    if (!entry.id || !entry.path || !entry.role) {
      return fail(
        "CI_MANIFEST_MISMATCH",
        normalizedInputPath,
        "Each review_surfaces entry must declare id, path, and role.",
        { path: `review_surfaces[${i}]` }
      );
    }

    const absoluteSurfacePath = path.resolve(root, entry.path);
    if (!fs.existsSync(absoluteSurfacePath)) {
      return fail(
        "CI_SPINE_MISSING_DOC",
        normalizedInputPath,
        "Review surface listed in evidence pack index does not exist.",
        {
          path: `review_surfaces[${i}].path`,
          missing_surface: entry.path
        }
      );
    }
  }

  const actualPaths = normalizedActual.map((x) => x.path);
  const requiredPaths = REQUIRED_REVIEW_SURFACES.map((x) => x.path);

  if (!compareStringArrays(actualPaths, requiredPaths)) {
    const missingRequired = REQUIRED_REVIEW_SURFACES
      .filter((required) => !actualPaths.includes(required.path))
      .map((x) => x.path);

    const orphanIndexed = normalizedActual
      .filter((actual) => !requiredPaths.includes(actual.path))
      .map((x) => x.path);

    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Freeze evidence pack index must include all and only the required human-review freeze surfaces.",
      {
        missing_required_paths: missingRequired,
        orphan_indexed_paths: orphanIndexed
      }
    );
  }

  const expectedTriples = REQUIRED_REVIEW_SURFACES
    .map((entry) => `${entry.id}|${entry.role}|${entry.path}`)
    .sort((a, b) => a.localeCompare(b));

  const actualTriples = normalizedActual
    .map((entry) => `${entry.id}|${entry.role}|${entry.path}`)
    .sort((a, b) => a.localeCompare(b));

  if (JSON.stringify(expectedTriples) !== JSON.stringify(actualTriples)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Freeze evidence pack index entries must match frozen id/role/path bindings.",
      {
        expected_entries: REQUIRED_REVIEW_SURFACES,
        actual_entries: normalizedActual
      }
    );
  }

  return {
    ok: true,
    verifier_id: "freeze_evidence_pack_index_completeness_verifier",
    checked_at_utc: new Date().toISOString(),
    input_path: normalizedInputPath,
    review_surface_count: normalizedActual.length,
    required_review_surfaces: REQUIRED_REVIEW_SURFACES
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const report = fail("CI_MANIFEST_MISMATCH", "cli", error.message);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  const result = verifyFreezeEvidencePackIndexCompleteness(args);
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main();
}
