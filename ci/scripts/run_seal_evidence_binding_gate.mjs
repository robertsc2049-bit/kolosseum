import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  CI_EVIDENCE_SEAL_BINDING_MISSING: "CI_EVIDENCE_SEAL_BINDING_MISSING",
  CI_EVIDENCE_SEAL_BINDING_MISMATCH: "CI_EVIDENCE_SEAL_BINDING_MISMATCH",
  CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE: "CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE"
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

function normalizeLifecycleMode(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "sealed") return "sealed";
  if (value === "pre-seal") return "pre-seal";
  if (value === "pre_seal") return "pre-seal";
  if (value === "preseal") return "pre-seal";
  if (value === "unsealed") return "pre-seal";
  if (value === "dev") return "pre-seal";
  if (value === "development") return "pre-seal";
  return null;
}

function detectLifecycleMode(repoRoot, lifecyclePath = null) {
  const candidatePaths = [];

  if (lifecyclePath) {
    candidatePaths.push(lifecyclePath);
  }

  candidatePaths.push(
    path.join(repoRoot, "ci", "evidence", "registry_seal.lifecycle.json"),
    path.join(repoRoot, "ci", "evidence", "registry_seal_state.json"),
    path.join(repoRoot, "ci", "evidence", "registry_seal_lifecycle.json"),
    path.join(repoRoot, "registries", "registry_seal.lifecycle.json")
  );

  const resolvedLifecyclePath = tryResolveExistingPath(candidatePaths);

  if (resolvedLifecyclePath) {
    const payload = readJson(resolvedLifecyclePath);
    const candidateValues = [
      payload?.mode,
      payload?.state,
      payload?.lifecycle,
      payload?.seal_lifecycle,
      payload?.registry_seal_mode
    ];

    for (const value of candidateValues) {
      const normalized = normalizeLifecycleMode(value);
      if (normalized) {
        return {
          mode: normalized,
          lifecyclePath: resolvedLifecyclePath,
          reason: `lifecycle file declares ${normalized}`
        };
      }
    }

    throw new Error(`Unable to determine lifecycle mode from '${resolvedLifecyclePath}'.`);
  }

  const sealPath = tryResolveExistingPath([
    path.join(repoRoot, "ci", "evidence", "registry_seal.json"),
    path.join(repoRoot, "ci", "evidence", "registry_seal_manifest.json"),
    path.join(repoRoot, "registries", "registry_seal.json")
  ]);

  if (sealPath) {
    return {
      mode: "sealed",
      lifecyclePath: null,
      reason: "seal manifest present; defaulting lifecycle to sealed"
    };
  }

  return {
    mode: "pre-seal",
    lifecyclePath: null,
    reason: "no lifecycle file or seal manifest found; defaulting lifecycle to pre-seal"
  };
}

function extractSealRecord(seal) {
  const sealId =
    typeof seal?.seal_id === "string"
      ? seal.seal_id
      : typeof seal?.registry_seal_id === "string"
        ? seal.registry_seal_id
        : null;

  const bundleHash =
    typeof seal?.bundle_hash === "string"
      ? seal.bundle_hash
      : typeof seal?.registry_bundle_hash === "string"
        ? seal.registry_bundle_hash
        : null;

  return { sealId, bundleHash };
}

function extractEvidenceBinding(evidence) {
  const binding =
    isObject(evidence?.seal_binding) ? evidence.seal_binding :
    isObject(evidence?.registry_seal_binding) ? evidence.registry_seal_binding :
    null;

  if (binding) {
    const sealId =
      typeof binding.seal_id === "string"
        ? binding.seal_id
        : typeof binding.registry_seal_id === "string"
          ? binding.registry_seal_id
          : null;

    const bundleHash =
      typeof binding.bundle_hash === "string"
        ? binding.bundle_hash
        : typeof binding.registry_bundle_hash === "string"
          ? binding.registry_bundle_hash
          : null;

    return { sealId, bundleHash, bindingObject: binding };
  }

  const topLevelSealId =
    typeof evidence?.seal_id === "string"
      ? evidence.seal_id
      : typeof evidence?.registry_seal_id === "string"
        ? evidence.registry_seal_id
        : null;

  const topLevelBundleHash =
    typeof evidence?.bundle_hash === "string"
      ? evidence.bundle_hash
      : typeof evidence?.registry_bundle_hash === "string"
        ? evidence.registry_bundle_hash
        : null;

  return {
    sealId: topLevelSealId,
    bundleHash: topLevelBundleHash,
    bindingObject: null
  };
}

function verifySealEvidenceBindingGate({
  repoRoot,
  lifecyclePath = null,
  sealPath = null,
  evidencePath = null
}) {
  const lifecycle = detectLifecycleMode(repoRoot, lifecyclePath);

  if (lifecycle.mode !== "sealed") {
    return {
      ok: false,
      mode: lifecycle.mode,
      enforced: true,
      reason: "release evidence binding requires sealed lifecycle state",
      failures: [
        {
          token: TOKEN.CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE,
          details: "Release evidence binding requires sealed registry lifecycle state.",
          ...(lifecycle.lifecyclePath
            ? { path: path.relative(repoRoot, lifecycle.lifecyclePath).replace(/\\/g, "/") }
            : {})
        }
      ]
    };
  }

  const resolvedSealPath =
    sealPath ??
    tryResolveExistingPath([
      path.join(repoRoot, "ci", "evidence", "registry_seal.json"),
      path.join(repoRoot, "ci", "evidence", "registry_seal_manifest.json"),
      path.join(repoRoot, "registries", "registry_seal.json")
    ]);

  if (!resolvedSealPath) {
    return {
      ok: false,
      mode: lifecycle.mode,
      enforced: true,
      reason: "sealed lifecycle requires an active seal manifest",
      failures: [
        {
          token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
          details: "No active registry seal manifest found."
        }
      ]
    };
  }

  const resolvedEvidencePath =
    evidencePath ??
    tryResolveExistingPath([
      path.join(repoRoot, "ci", "evidence", "promotion_readiness.evidence.json"),
      path.join(repoRoot, "ci", "evidence", "release_evidence.json"),
      path.join(repoRoot, "docs", "releases", "V1_PROMOTION_READINESS.json")
    ]);

  if (!resolvedEvidencePath) {
    return {
      ok: false,
      mode: lifecycle.mode,
      enforced: true,
      reason: "release evidence surface is required",
      failures: [
        {
          token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
          details: "No release evidence surface found to bind to active seal."
        }
      ]
    };
  }

  const seal = readJson(resolvedSealPath);
  const evidence = readJson(resolvedEvidencePath);

  const activeSeal = extractSealRecord(seal);
  const evidenceBinding = extractEvidenceBinding(evidence);

  const failures = [];

  if (!activeSeal.sealId) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
      details: "Active seal manifest does not include seal_id / registry_seal_id.",
      path: path.relative(repoRoot, resolvedSealPath).replace(/\\/g, "/")
    });
  }

  if (!activeSeal.bundleHash) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
      details: "Active seal manifest does not include bundle_hash / registry_bundle_hash.",
      path: path.relative(repoRoot, resolvedSealPath).replace(/\\/g, "/")
    });
  }

  if (!evidenceBinding.sealId) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
      details: "Release evidence does not include seal_id / registry_seal_id binding.",
      path: path.relative(repoRoot, resolvedEvidencePath).replace(/\\/g, "/")
    });
  }

  if (!evidenceBinding.bundleHash) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISSING,
      details: "Release evidence does not include bundle_hash / registry_bundle_hash binding.",
      path: path.relative(repoRoot, resolvedEvidencePath).replace(/\\/g, "/")
    });
  }

  if (
    activeSeal.sealId &&
    evidenceBinding.sealId &&
    activeSeal.sealId !== evidenceBinding.sealId
  ) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISMATCH,
      details: `seal_id mismatch. active='${activeSeal.sealId}' evidence='${evidenceBinding.sealId}'`,
      path: path.relative(repoRoot, resolvedEvidencePath).replace(/\\/g, "/")
    });
  }

  if (
    activeSeal.bundleHash &&
    evidenceBinding.bundleHash &&
    activeSeal.bundleHash !== evidenceBinding.bundleHash
  ) {
    failures.push({
      token: TOKEN.CI_EVIDENCE_SEAL_BINDING_MISMATCH,
      details: `bundle_hash mismatch. active='${activeSeal.bundleHash}' evidence='${evidenceBinding.bundleHash}'`,
      path: path.relative(repoRoot, resolvedEvidencePath).replace(/\\/g, "/")
    });
  }

  return {
    ok: failures.length === 0,
    mode: lifecycle.mode,
    enforced: true,
    reason:
      failures.length === 0
        ? "release evidence is bound to active sealed registry freeze"
        : "release evidence seal binding mismatch detected",
    active_seal: {
      seal_id: activeSeal.sealId,
      bundle_hash: activeSeal.bundleHash,
      source: path.relative(repoRoot, resolvedSealPath).replace(/\\/g, "/")
    },
    evidence_surface: {
      source: path.relative(repoRoot, resolvedEvidencePath).replace(/\\/g, "/"),
      seal_id: evidenceBinding.sealId,
      bundle_hash: evidenceBinding.bundleHash
    },
    failures
  };
}

function main() {
  const repoRoot = process.cwd();
  const result = verifySealEvidenceBindingGate({ repoRoot });
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

export { verifySealEvidenceBindingGate, TOKEN };