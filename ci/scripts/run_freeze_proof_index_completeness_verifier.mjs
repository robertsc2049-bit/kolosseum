import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const PACKAGING_SURFACE_REGISTRY_PATH = path.join(
  REPO_ROOT,
  "docs",
  "releases",
  "V1_PACKAGING_SURFACE_REGISTRY.json",
);

const FREEZE_PROOF_INDEX_PATH = path.join(
  REPO_ROOT,
  "docs",
  "releases",
  "V1_FREEZE_PROOF_INDEX.json",
);

const OUTPUT_PATH = path.join(
  REPO_ROOT,
  "docs",
  "releases",
  "V1_FREEZE_PROOF_INDEX_COMPLETENESS.json",
);

const SELF_RELATIVE_PATH = normalizeRelative(
  path.relative(REPO_ROOT, __filename),
);

const EXCLUDED_INDEX_PATHS = new Set([
  "docs/releases/V1_FREEZE_PROOF_INDEX.json",
  "docs/releases/V1_FREEZE_PROOF_INDEX_COMPLETENESS.json",
  SELF_RELATIVE_PATH,
]);

function normalizeRelative(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function sha256File(absolutePath) {
  const bytes = fs.readFileSync(absolutePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function collectStringsDeep(node, out = []) {
  if (typeof node === "string") {
    out.push(node);
    return out;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectStringsDeep(item, out);
    }
    return out;
  }

  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (
        typeof value === "string" &&
        /(^|_)(path|file|runner|report|artefact|artifact|surface)(_|$)/i.test(key)
      ) {
        out.push(value);
      } else {
        collectStringsDeep(value, out);
      }
    }
  }

  return out;
}

function extractPathsFromPackagingRegistry(registry) {
  const rawStrings = collectStringsDeep(registry);
  const relPaths = new Set();

  for (const raw of rawStrings) {
    const candidate = normalizeRelative(raw.trim());
    if (!candidate) continue;
    if (
      candidate.startsWith("docs/releases/") ||
      candidate.startsWith("ci/scripts/")
    ) {
      relPaths.add(candidate);
    }
  }

  return [...relPaths].sort();
}

function extractPathsFromProofIndex(indexDoc) {
  const rawStrings = collectStringsDeep(indexDoc);
  const relPaths = new Set();

  for (const raw of rawStrings) {
    const candidate = normalizeRelative(raw.trim());
    if (!candidate) continue;
    if (
      candidate.startsWith("docs/releases/") ||
      candidate.startsWith("ci/scripts/")
    ) {
      relPaths.add(candidate);
    }
  }

  return [...relPaths].sort();
}

function isFreezeProofReportPath(relPath) {
  return (
    relPath.startsWith("docs/releases/") &&
    /^docs\/releases\/V1_FREEZE_.*\.json$/i.test(relPath)
  );
}

function isFreezeProofRunnerPath(relPath) {
  return (
    relPath.startsWith("ci/scripts/") &&
    /^ci\/scripts\/run_freeze_.*\.mjs$/i.test(relPath)
  );
}

function isTrackedFreezeProofSurface(relPath) {
  if (EXCLUDED_INDEX_PATHS.has(relPath)) return false;
  return isFreezeProofReportPath(relPath) || isFreezeProofRunnerPath(relPath);
}

function assertExists(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} missing: ${normalizeRelative(path.relative(REPO_ROOT, absolutePath))}`);
  }
}

function toMapWithHashes(paths) {
  return paths.map((relPath) => {
    const absolutePath = path.join(REPO_ROOT, relPath);
    assertExists(absolutePath, "tracked freeze proof surface");
    return {
      path: relPath,
      sha256: sha256File(absolutePath),
    };
  });
}

function buildResult() {
  assertExists(PACKAGING_SURFACE_REGISTRY_PATH, "packaging surface registry");
  assertExists(FREEZE_PROOF_INDEX_PATH, "freeze proof index");

  const packagingRegistry = readJson(PACKAGING_SURFACE_REGISTRY_PATH);
  const proofIndex = readJson(FREEZE_PROOF_INDEX_PATH);

  const packagingPaths = extractPathsFromPackagingRegistry(packagingRegistry);
  const indexedPaths = extractPathsFromProofIndex(proofIndex);

  const trackedFreezeProofPaths = packagingPaths
    .filter(isTrackedFreezeProofSurface)
    .sort();

  const indexedFreezeProofPaths = indexedPaths
    .filter(isTrackedFreezeProofSurface)
    .sort();

  const trackedSet = new Set(trackedFreezeProofPaths);
  const indexedSet = new Set(indexedFreezeProofPaths);

  const missingIndexEntries = trackedFreezeProofPaths.filter((item) => !indexedSet.has(item));
  const staleExtraEntries = indexedFreezeProofPaths.filter((item) => !trackedSet.has(item));

  return {
    ok: missingIndexEntries.length === 0 && staleExtraEntries.length === 0,
    verifier: "freeze_proof_index_completeness",
    generated_at_utc: new Date().toISOString(),
    compared_against: {
      packaging_surface_registry: normalizeRelative(path.relative(REPO_ROOT, PACKAGING_SURFACE_REGISTRY_PATH)),
      freeze_proof_index: normalizeRelative(path.relative(REPO_ROOT, FREEZE_PROOF_INDEX_PATH)),
    },
    invariants: [
      "every tracked freeze proof report must be indexed",
      "every tracked freeze proof runner must be indexed",
      "no stale extra proof index entry may remain after proof surface removal",
    ],
    tracked_freeze_proof_surfaces: toMapWithHashes(trackedFreezeProofPaths),
    indexed_freeze_proof_surfaces: indexedFreezeProofPaths.map((relPath) => ({ path: relPath })),
    missing_index_entries: missingIndexEntries,
    stale_extra_entries: staleExtraEntries,
  };
}

function main() {
  const result = buildResult();

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");

  if (!result.ok) {
    const missing = result.missing_index_entries.join(", ") || "(none)";
    const stale = result.stale_extra_entries.join(", ") || "(none)";
    throw new Error(
      [
        "freeze proof index completeness failed",
        `missing_index_entries=${missing}`,
        `stale_extra_entries=${stale}`,
      ].join(" | "),
    );
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();