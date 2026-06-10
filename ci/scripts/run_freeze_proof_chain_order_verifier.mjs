import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

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
  "V1_FREEZE_PROOF_CHAIN_ORDER.json",
);

function normalizeRelative(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function ensureString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function ensureExists(relPath, label) {
  const absolutePath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} missing: ${relPath}`);
  }
  return absolutePath;
}

function buildResult() {
  const indexDoc = readJson(FREEZE_PROOF_INDEX_PATH);

  const proofChain = ensureArray(
    indexDoc.freeze_proof_chain,
    "freeze_proof_chain",
  );

  const nodeByPath = new Map();
  const duplicatePaths = [];
  const orphanProofs = [];
  const outOfOrderDependencies = [];
  const missingUpstreamNodes = [];

  for (let i = 0; i < proofChain.length; i += 1) {
    const entry = proofChain[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`freeze_proof_chain[${i}] must be an object`);
    }

    const proofPath = normalizeRelative(
      ensureString(entry.path, `freeze_proof_chain[${i}].path`),
    );
    const upstreamPaths = ensureArray(
      entry.upstream_paths ?? [],
      `freeze_proof_chain[${i}].upstream_paths`,
    ).map((p, j) =>
      normalizeRelative(
        ensureString(
          p,
          `freeze_proof_chain[${i}].upstream_paths[${j}]`,
        ),
      ),
    );

    if (nodeByPath.has(proofPath)) {
      duplicatePaths.push(proofPath);
      continue;
    }

    const absolutePath = ensureExists(proofPath, "freeze proof");
    nodeByPath.set(proofPath, {
      path: proofPath,
      order: i,
      upstream_paths: upstreamPaths,
      sha256: sha256File(absolutePath),
    });
  }

  const nodes = [...nodeByPath.values()].sort((a, b) => a.order - b.order);

  for (const node of nodes) {
    if (node.upstream_paths.length === 0 && node.order !== 0) {
      orphanProofs.push(node.path);
    }

    for (const upstreamPath of node.upstream_paths) {
      const upstreamNode = nodeByPath.get(upstreamPath);
      if (!upstreamNode) {
        missingUpstreamNodes.push({
          path: node.path,
          missing_upstream_path: upstreamPath,
        });
        continue;
      }

      if (upstreamNode.order >= node.order) {
        outOfOrderDependencies.push({
          path: node.path,
          upstream_path: upstreamPath,
          upstream_order: upstreamNode.order,
          path_order: node.order,
        });
      }
    }
  }

  const ok =
    duplicatePaths.length === 0 &&
    orphanProofs.length === 0 &&
    missingUpstreamNodes.length === 0 &&
    outOfOrderDependencies.length === 0;

  return {
    ok,
    verifier: "freeze_proof_chain_order",
    generated_at_utc: new Date().toISOString(),
    compared_against: {
      freeze_proof_index: normalizeRelative(
        path.relative(REPO_ROOT, FREEZE_PROOF_INDEX_PATH),
      ),
    },
    invariants: [
      "every non-root proof must declare at least one upstream proof stage",
      "every declared upstream proof stage must exist in the proof chain",
      "every declared upstream proof stage must appear earlier in the proof chain",
      "proof chain node paths must be unique",
    ],
    proof_chain_nodes: nodes.map((node) => ({
      path: node.path,
      order: node.order,
      upstream_paths: node.upstream_paths,
      sha256: node.sha256,
    })),
    duplicate_paths: duplicatePaths,
    orphan_proofs: orphanProofs,
    missing_upstream_nodes: missingUpstreamNodes,
    out_of_order_dependencies: outOfOrderDependencies,
  };
}

function main() {
  ensureExists(
    normalizeRelative(path.relative(REPO_ROOT, FREEZE_PROOF_INDEX_PATH)),
    "freeze proof index",
  );

  const result = buildResult();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n", "utf8");

  if (!result.ok) {
    const parts = [];
    if (result.duplicate_paths.length > 0) {
      parts.push(`duplicate_paths=${result.duplicate_paths.join(", ")}`);
    }
    if (result.orphan_proofs.length > 0) {
      parts.push(`orphan_proofs=${result.orphan_proofs.join(", ")}`);
    }
    if (result.missing_upstream_nodes.length > 0) {
      parts.push(
        `missing_upstream_nodes=${result.missing_upstream_nodes
          .map((x) => `${x.path}->${x.missing_upstream_path}`)
          .join(", ")}`,
      );
    }
    if (result.out_of_order_dependencies.length > 0) {
      parts.push(
        `out_of_order_dependencies=${result.out_of_order_dependencies
          .map((x) => `${x.path}->${x.upstream_path}`)
          .join(", ")}`,
      );
    }

    throw new Error(
      `freeze proof chain order failed | ${parts.join(" | ")}`,
    );
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();