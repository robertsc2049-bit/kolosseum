import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  CI_REGISTRY_CANONICAL_PATH_MISSING: "CI_REGISTRY_CANONICAL_PATH_MISSING",
  CI_REGISTRY_FILE_IDENTITY_MISMATCH: "CI_REGISTRY_FILE_IDENTITY_MISMATCH",
  CI_REGISTRY_CANONICAL_PATH_RELOCATED: "CI_REGISTRY_CANONICAL_PATH_RELOCATED"
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function tryResolveExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function rel(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function fail(token, details, filePath, repoRoot) {
  return {
    token,
    details,
    ...(filePath ? { path: rel(repoRoot, filePath) } : {})
  };
}

function getRegistryEntriesFromBundle(bundle) {
  if (Array.isArray(bundle.registries)) {
    return bundle.registries.map((entry) => {
      if (typeof entry === "string") {
        return {
          registry_id: entry,
          canonical_path: `registries/${entry}.json`
        };
      }
      if (!isObject(entry)) {
        throw new Error("registry_bundle.json contains a non-object registry entry.");
      }

      const registryId =
        typeof entry.registry_id === "string"
          ? entry.registry_id
          : typeof entry.document_id === "string"
            ? entry.document_id
            : null;

      if (!registryId) {
        throw new Error("registry_bundle.json entry missing registry_id/document_id.");
      }

      const canonicalPath =
        typeof entry.canonical_path === "string"
          ? entry.canonical_path
          : typeof entry.path === "string"
            ? entry.path
            : typeof entry.file === "string"
              ? entry.file
              : `registries/${registryId}.json`;

      return {
        registry_id: registryId,
        canonical_path: canonicalPath
      };
    });
  }

  if (Array.isArray(bundle.registry_ids)) {
    return bundle.registry_ids.map((registryId) => ({
      registry_id: registryId,
      canonical_path: `registries/${registryId}.json`
    }));
  }

  throw new Error("registry_bundle.json must expose registries[] or registry_ids[].");
}

function listJsonFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listJsonFilesRecursive(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(full);
    }
  }

  return results;
}

function verifyRegistryFileIdentityLock({
  repoRoot,
  bundlePath = null
}) {
  const resolvedBundlePath =
    bundlePath ??
    tryResolveExistingPath([
      path.join(repoRoot, "registries", "registry_bundle.json")
    ]);

  if (!resolvedBundlePath) {
    return {
      ok: false,
      enforced: true,
      reason: "registry bundle is required",
      failures: [
        fail(
          TOKEN.CI_REGISTRY_CANONICAL_PATH_MISSING,
          "registry_bundle.json is missing.",
          null,
          repoRoot
        )
      ]
    };
  }

  const bundle = readJson(resolvedBundlePath);
  const registryEntries = getRegistryEntriesFromBundle(bundle);
  const failures = [];

  const searchRoots = [
    path.join(repoRoot, "registries"),
    path.join(repoRoot, "ci", "evidence"),
    path.join(repoRoot, "docs")
  ];

  const allJsonFiles = searchRoots.flatMap((root) => listJsonFilesRecursive(root));
  const canonicalFullPaths = new Set(
    registryEntries.map((entry) =>
      path.isAbsolute(entry.canonical_path)
        ? entry.canonical_path
        : path.join(repoRoot, entry.canonical_path)
    )
  );

  for (const entry of registryEntries) {
    const canonicalFullPath = path.isAbsolute(entry.canonical_path)
      ? entry.canonical_path
      : path.join(repoRoot, entry.canonical_path);

    if (!fs.existsSync(canonicalFullPath)) {
      failures.push(
        fail(
          TOKEN.CI_REGISTRY_CANONICAL_PATH_MISSING,
          `Canonical registry path is missing for '${entry.registry_id}'. Expected '${entry.canonical_path}'.`,
          canonicalFullPath,
          repoRoot
        )
      );

      const relocatedCandidates = allJsonFiles.filter((candidate) => {
        if (canonicalFullPaths.has(candidate)) return false;
        return path.basename(candidate) === path.basename(canonicalFullPath);
      });

      if (relocatedCandidates.length > 0) {
        failures.push(
          fail(
            TOKEN.CI_REGISTRY_CANONICAL_PATH_RELOCATED,
            `Registry '${entry.registry_id}' appears to exist only at non-canonical path(s): ${relocatedCandidates.map((p) => `'${rel(repoRoot, p)}'`).join(", ")}`,
            relocatedCandidates[0],
            repoRoot
          )
        );
      }

      continue;
    }

    const canonicalHash = sha256File(canonicalFullPath);

    const relocatedMatch = allJsonFiles.find((candidate) => {
      if (candidate === canonicalFullPath) return false;
      if (canonicalFullPaths.has(candidate)) return false;
      return sha256File(candidate) === canonicalHash;
    });

    if (relocatedMatch) {
      failures.push(
        fail(
          TOKEN.CI_REGISTRY_FILE_IDENTITY_MISMATCH,
          `Registry '${entry.registry_id}' content appears at non-canonical path '${rel(repoRoot, relocatedMatch)}'. File identity is path-bound, not hash-only.`,
          relocatedMatch,
          repoRoot
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    enforced: true,
    reason:
      failures.length === 0
        ? "registry file identity locked to canonical paths"
        : "registry file identity/path violation detected",
    bundle_path: rel(repoRoot, resolvedBundlePath),
    failures
  };
}

function main() {
  const repoRoot = process.cwd();
  const result = verifyRegistryFileIdentityLock({ repoRoot });
  const text = `${JSON.stringify(result, null, 2)}\n`;

  if (!result.ok) {
    process.stderr.write(text);
    process.exit(1);
  }

  process.stdout.write(text);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyRegistryFileIdentityLock, TOKEN };