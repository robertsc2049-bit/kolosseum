import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  CI_SEAL_SCOPE_INCOMPLETE: "CI_SEAL_SCOPE_INCOMPLETE",
  CI_SEAL_BUNDLE_DRIFT: "CI_SEAL_BUNDLE_DRIFT",
  CI_SEAL_REGISTRY_DRIFT: "CI_SEAL_REGISTRY_DRIFT",
  CI_BUNDLE_ONLY_DRIFT: "CI_BUNDLE_ONLY_DRIFT",
  CI_BUNDLE_REGISTRY_MISMATCH: "CI_BUNDLE_REGISTRY_MISMATCH",
  CI_REGISTRY_LOAD_ORDER_INVALID: "CI_REGISTRY_LOAD_ORDER_INVALID",
  CI_MANIFEST_MISMATCH: "CI_MANIFEST_MISMATCH"
};

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function fail(token, details, pathValue = undefined) {
  return {
    token,
    details,
    ...(pathValue ? { path: pathValue } : {})
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveExistingPath(candidates, label) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to locate ${label}. Checked: ${candidates.join(", ")}`);
}

function getCanonicalRegistryIdsFromBundle(bundle) {
  if (Array.isArray(bundle.registry_ids)) return [...bundle.registry_ids];
  if (Array.isArray(bundle.registries)) {
    return bundle.registries.map((entry) => {
      if (typeof entry === "string") return entry;
      if (isObject(entry) && typeof entry.registry_id === "string") return entry.registry_id;
      if (isObject(entry) && typeof entry.document_id === "string") return entry.document_id;
      throw new Error("registry_bundle.json contains an invalid registry entry.");
    });
  }
  throw new Error("registry_bundle.json must expose either registry_ids[] or registries[].");
}

function getCanonicalRegistryMapFromBundle(bundle) {
  const ids = getCanonicalRegistryIdsFromBundle(bundle);
  const byId = new Map();

  if (Array.isArray(bundle.registries)) {
    for (const entry of bundle.registries) {
      if (typeof entry === "string") {
        byId.set(entry, { registry_id: entry });
        continue;
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
        throw new Error("registry_bundle.json contains a registry entry without registry_id/document_id.");
      }
      byId.set(registryId, entry);
    }
  } else {
    for (const id of ids) {
      byId.set(id, { registry_id: id });
    }
  }

  return { ids, byId };
}

function normalizeRegistryEntryPath(rawPath, repoRoot) {
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    return null;
  }
  const candidate = path.isAbsolute(rawPath) ? rawPath : path.join(repoRoot, rawPath);
  return fs.existsSync(candidate) ? candidate : null;
}

function discoverRegistryFile(registryId, entry, repoRoot) {
  const explicitCandidates = [
    entry?.path,
    entry?.file,
    entry?.relative_path,
    entry?.source_path
  ]
    .map((value) => normalizeRegistryEntryPath(value, repoRoot))
    .filter(Boolean);

  if (explicitCandidates.length > 0) {
    return explicitCandidates[0];
  }

  const payloadDir = path.join(repoRoot, "registries");
  const preferred = [
    path.join(payloadDir, `${registryId}.json`),
    path.join(payloadDir, `${registryId}.registry.json`),
    path.join(payloadDir, `${registryId}.registry.bundle.json`)
  ];

  for (const candidate of preferred) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const matches = [];
  for (const file of fs.readdirSync(payloadDir)) {
    if (!file.endsWith(".json")) continue;
    if (file === "registry_bundle.json") continue;
    if (file === "registry_seal.json") continue;
    if (file === "registry_seal_manifest.json") continue;
    if (file.includes(registryId)) {
      matches.push(path.join(payloadDir, file));
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  throw new Error(`Unable to resolve registry file for '${registryId}'.`);
}

function buildCurrentSnapshot(repoRoot, bundle) {
  const { ids, byId } = getCanonicalRegistryMapFromBundle(bundle);
  const registryHashes = {};
  const registryPaths = {};
  for (const registryId of ids) {
    const filePath = discoverRegistryFile(registryId, byId.get(registryId), repoRoot);
    registryPaths[registryId] = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    registryHashes[registryId] = sha256File(filePath);
  }
  return { registryIds: ids, registryHashes, registryPaths };
}

function extractSealRegistryHashes(seal) {
  if (isObject(seal.registry_hashes)) return seal.registry_hashes;
  if (isObject(seal.registries)) {
    const out = {};
    for (const [registryId, value] of Object.entries(seal.registries)) {
      if (typeof value === "string") {
        out[registryId] = value;
      } else if (isObject(value) && typeof value.sha256 === "string") {
        out[registryId] = value.sha256;
      } else if (isObject(value) && typeof value.hash === "string") {
        out[registryId] = value.hash;
      }
    }
    return out;
  }
  return {};
}

function verifySealAwareRegistryBundleGuard({
  repoRoot,
  bundlePath,
  sealPath
}) {
  const failures = [];

  if (!fs.existsSync(bundlePath)) {
    failures.push(fail(TOKEN.CI_MANIFEST_MISMATCH, "registry_bundle.json is missing.", path.relative(repoRoot, bundlePath)));
    return { ok: false, failures };
  }

  if (!fs.existsSync(sealPath)) {
    return { ok: true, failures: [] };
  }

  const bundle = readJson(bundlePath);
  const seal = readJson(sealPath);

  const currentBundleHash = sha256File(bundlePath);
  const current = buildCurrentSnapshot(repoRoot, bundle);
  const sealedRegistryHashes = extractSealRegistryHashes(seal);
  const sealedBundleHash =
    typeof seal.bundle_hash === "string"
      ? seal.bundle_hash
      : typeof seal.registry_bundle_hash === "string"
        ? seal.registry_bundle_hash
        : null;

  if (!sealedBundleHash) {
    failures.push(
      fail(
        TOKEN.CI_SEAL_SCOPE_INCOMPLETE,
        "Seal manifest does not include bundle_hash / registry_bundle_hash.",
        path.relative(repoRoot, sealPath)
      )
    );
    return { ok: false, failures };
  }

  const sealedRegistryIds = Object.keys(sealedRegistryHashes);
  const currentRegistryIds = [...current.registryIds];

  if (sealedBundleHash !== currentBundleHash) {
    failures.push(
      fail(
        TOKEN.CI_SEAL_BUNDLE_DRIFT,
        `registry_bundle.json hash drifted after seal. sealed=${sealedBundleHash} current=${currentBundleHash}`,
        path.relative(repoRoot, bundlePath)
      )
    );
  }

  const currentSet = new Set(currentRegistryIds);
  const sealedSet = new Set(sealedRegistryIds);

  for (const registryId of currentRegistryIds) {
    if (!sealedSet.has(registryId)) {
      failures.push(
        fail(
          TOKEN.CI_BUNDLE_REGISTRY_MISMATCH,
          `Registry '${registryId}' exists in bundle but not in seal scope.`,
          path.relative(repoRoot, bundlePath)
        )
      );
    }
  }

  for (const registryId of sealedRegistryIds) {
    if (!currentSet.has(registryId)) {
      failures.push(
        fail(
          TOKEN.CI_BUNDLE_REGISTRY_MISMATCH,
          `Registry '${registryId}' exists in seal scope but not in current bundle.`,
          path.relative(repoRoot, sealPath)
        )
      );
    }
  }

  const sameLength = sealedRegistryIds.length === currentRegistryIds.length;
  if (sameLength) {
    for (let i = 0; i < currentRegistryIds.length; i += 1) {
      if (currentRegistryIds[i] !== sealedRegistryIds[i]) {
        failures.push(
          fail(
            TOKEN.CI_REGISTRY_LOAD_ORDER_INVALID,
            `Registry order drifted at index ${i}. sealed='${sealedRegistryIds[i]}' current='${currentRegistryIds[i]}'`,
            path.relative(repoRoot, bundlePath)
          )
        );
        break;
      }
    }
  }

  let registryDriftDetected = false;
  for (const registryId of currentRegistryIds) {
    const sealedHash = sealedRegistryHashes[registryId];
    const currentHash = current.registryHashes[registryId];
    if (sealedHash && currentHash && sealedHash !== currentHash) {
      registryDriftDetected = true;
      failures.push(
        fail(
          TOKEN.CI_SEAL_REGISTRY_DRIFT,
          `Registry '${registryId}' drifted after seal. sealed=${sealedHash} current=${currentHash}`,
          current.registryPaths[registryId]
        )
      );
    }
  }

  if (!registryDriftDetected && sealedBundleHash !== currentBundleHash) {
    failures.push(
      fail(
        TOKEN.CI_BUNDLE_ONLY_DRIFT,
        "registry_bundle.json drifted after seal while all sealed registry payload hashes remained unchanged.",
        path.relative(repoRoot, bundlePath)
      )
    );
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const repoRoot = process.cwd();
  const bundlePath = resolveExistingPath(
    [
      path.join(repoRoot, "registries", "registry_bundle.json")
    ],
    "registry bundle"
  );

  const sealPath = resolveExistingPath(
    [
      path.join(repoRoot, "ci", "evidence", "registry_seal.json"),
      path.join(repoRoot, "ci", "evidence", "registry_seal_manifest.json"),
      path.join(repoRoot, "registries", "registry_seal.json")
    ],
    "registry seal manifest"
  );

  const result = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath,
    sealPath
  });

  if (!result.ok) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifySealAwareRegistryBundleGuard, TOKEN };