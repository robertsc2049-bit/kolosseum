import fs from "node:fs";
import path from "node:path";

const TOKEN = {
  CI_REGISTRY_MANIFEST_VERSION_MISSING: "CI_REGISTRY_MANIFEST_VERSION_MISSING",
  CI_REGISTRY_MANIFEST_VERSION_UNKNOWN: "CI_REGISTRY_MANIFEST_VERSION_UNKNOWN",
  CI_REGISTRY_MANIFEST_SCOPE_DRIFT: "CI_REGISTRY_MANIFEST_SCOPE_DRIFT"
};

const MANIFEST_CONTRACTS = {
  "1.0.0": {
    requiredTopLevelKeys: [
      "manifest_version",
      "seal_id",
      "bundle_hash",
      "registry_hashes"
    ],
    optionalTopLevelKeys: [
      "sealed_at",
      "engine_version",
      "registry_bundle_hash",
      "scope"
    ],
    requiredScopeKeys: [
      "bundle_hash_included",
      "registry_hashes_included"
    ],
    optionalScopeKeys: [
      "ordered_registry_scope",
      "sealed_mode_required"
    ]
  }
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function tryResolveExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function fail(token, details, filePath, repoRoot) {
  return {
    token,
    details,
    ...(filePath ? { path: path.relative(repoRoot, filePath).replace(/\\/g, "/") } : {})
  };
}

function validateExactKeySet({
  value,
  requiredKeys,
  optionalKeys,
  unknownToken,
  missingToken,
  objectName,
  repoRoot,
  sourcePath
}) {
  const failures = [];

  if (!isObject(value)) {
    failures.push(
      fail(
        missingToken,
        `${objectName} must be an object.`,
        sourcePath,
        repoRoot
      )
    );
    return failures;
  }

  for (const key of requiredKeys) {
    if (!(key in value)) {
      failures.push(
        fail(
          missingToken,
          `${objectName} is missing required key '${key}'.`,
          sourcePath,
          repoRoot
        )
      );
    }
  }

  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      failures.push(
        fail(
          unknownToken,
          `${objectName} contains unknown key '${key}' for this manifest_version.`,
          sourcePath,
          repoRoot
        )
      );
    }
  }

  return failures;
}

function verifyRegistryManifestVersionLock({
  repoRoot,
  manifestPath = null
}) {
  const resolvedManifestPath =
    manifestPath ??
    tryResolveExistingPath([
      path.join(repoRoot, "ci", "evidence", "registry_seal.json"),
      path.join(repoRoot, "ci", "evidence", "registry_seal_manifest.json"),
      path.join(repoRoot, "registries", "registry_seal.json")
    ]);

  if (!resolvedManifestPath) {
    return {
      ok: false,
      enforced: true,
      reason: "registry seal manifest is required",
      failures: [
        fail(
          TOKEN.CI_REGISTRY_MANIFEST_VERSION_MISSING,
          "No registry seal manifest found.",
          null,
          repoRoot
        )
      ]
    };
  }

  const manifest = readJson(resolvedManifestPath);
  const failures = [];

  const manifestVersion =
    typeof manifest?.manifest_version === "string"
      ? manifest.manifest_version
      : null;

  if (!manifestVersion) {
    failures.push(
      fail(
        TOKEN.CI_REGISTRY_MANIFEST_VERSION_MISSING,
        "Registry seal manifest must declare manifest_version.",
        resolvedManifestPath,
        repoRoot
      )
    );

    return {
      ok: false,
      enforced: true,
      manifest_path: path.relative(repoRoot, resolvedManifestPath).replace(/\\/g, "/"),
      failures
    };
  }

  const contract = MANIFEST_CONTRACTS[manifestVersion];
  if (!contract) {
    failures.push(
      fail(
        TOKEN.CI_REGISTRY_MANIFEST_VERSION_UNKNOWN,
        `Unknown registry seal manifest_version '${manifestVersion}'.`,
        resolvedManifestPath,
        repoRoot
      )
    );

    return {
      ok: false,
      enforced: true,
      manifest_version: manifestVersion,
      manifest_path: path.relative(repoRoot, resolvedManifestPath).replace(/\\/g, "/"),
      failures
    };
  }

  failures.push(
    ...validateExactKeySet({
      value: manifest,
      requiredKeys: contract.requiredTopLevelKeys,
      optionalKeys: contract.optionalTopLevelKeys,
      unknownToken: TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
      missingToken: TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
      objectName: "registry seal manifest",
      repoRoot,
      sourcePath: resolvedManifestPath
    })
  );

  if ("scope" in manifest) {
    failures.push(
      ...validateExactKeySet({
        value: manifest.scope,
        requiredKeys: contract.requiredScopeKeys,
        optionalKeys: contract.optionalScopeKeys,
        unknownToken: TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
        missingToken: TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
        objectName: "registry seal manifest.scope",
        repoRoot,
        sourcePath: resolvedManifestPath
      })
    );
  }

  if (
    isObject(manifest.scope) &&
    "bundle_hash_included" in manifest.scope &&
    manifest.scope.bundle_hash_included !== true
  ) {
    failures.push(
      fail(
        TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
        "registry seal manifest.scope.bundle_hash_included must be true for manifest_version 1.0.0.",
        resolvedManifestPath,
        repoRoot
      )
    );
  }

  if (
    isObject(manifest.scope) &&
    "registry_hashes_included" in manifest.scope &&
    manifest.scope.registry_hashes_included !== true
  ) {
    failures.push(
      fail(
        TOKEN.CI_REGISTRY_MANIFEST_SCOPE_DRIFT,
        "registry seal manifest.scope.registry_hashes_included must be true for manifest_version 1.0.0.",
        resolvedManifestPath,
        repoRoot
      )
    );
  }

  return {
    ok: failures.length === 0,
    enforced: true,
    manifest_version: manifestVersion,
    manifest_path: path.relative(repoRoot, resolvedManifestPath).replace(/\\/g, "/"),
    reason:
      failures.length === 0
        ? "registry seal manifest version and scope contract verified"
        : "registry seal manifest version/scope contract violation detected",
    failures
  };
}

function main() {
  const repoRoot = process.cwd();
  const result = verifyRegistryManifestVersionLock({ repoRoot });
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

export { verifyRegistryManifestVersionLock, TOKEN };