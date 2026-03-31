import fs from "node:fs";
import path from "node:path";

import {
  verifySealAwareRegistryBundleGuard,
  TOKEN as P88_TOKEN
} from "./run_seal_aware_registry_bundle_guard.mjs";

const TOKEN = {
  CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE: "CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE",
  ...P88_TOKEN
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

function detectLifecycleMode(repoRoot, lifecyclePath) {
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

function verifySealPromotionReadinessGate({
  repoRoot,
  promotion = false,
  bundlePath = null,
  sealPath = null,
  lifecyclePath = null
}) {
  const lifecycle = detectLifecycleMode(repoRoot, lifecyclePath);
  const failures = [];

  if (lifecycle.mode !== "sealed") {
    if (promotion) {
      failures.push({
        token: TOKEN.CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE,
        details: "Launch promotion requires sealed registry lifecycle state.",
        ...(lifecycle.lifecyclePath ? { path: path.relative(repoRoot, lifecycle.lifecyclePath).replace(/\\/g, "/") } : {})
      });
      return {
        ok: false,
        mode: lifecycle.mode,
        promotion,
        enforced: true,
        reason: lifecycle.reason,
        failures
      };
    }

    return {
      ok: true,
      mode: lifecycle.mode,
      promotion,
      enforced: false,
      reason: "pre-seal lifecycle is allowed for normal dev checks",
      failures: []
    };
  }

  const resolvedBundlePath =
    bundlePath ??
    path.join(repoRoot, "registries", "registry_bundle.json");

  const resolvedSealPath =
    sealPath ??
    tryResolveExistingPath([
      path.join(repoRoot, "ci", "evidence", "registry_seal.json"),
      path.join(repoRoot, "ci", "evidence", "registry_seal_manifest.json"),
      path.join(repoRoot, "registries", "registry_seal.json")
    ]);

  if (!resolvedSealPath) {
    failures.push({
      token: TOKEN.CI_PROMOTION_REQUIRES_SEALED_REGISTRY_STATE,
      details: "Lifecycle is sealed but no seal manifest could be found."
    });
    return {
      ok: false,
      mode: lifecycle.mode,
      promotion,
      enforced: true,
      reason: lifecycle.reason,
      failures
    };
  }

  const sealVerification = verifySealAwareRegistryBundleGuard({
    repoRoot,
    bundlePath: resolvedBundlePath,
    sealPath: resolvedSealPath
  });

  if (!sealVerification.ok) {
    return {
      ok: false,
      mode: lifecycle.mode,
      promotion,
      enforced: true,
      reason: "sealed lifecycle requires valid seal-aware bundle verification",
      failures: sealVerification.failures
    };
  }

  return {
    ok: true,
    mode: lifecycle.mode,
    promotion,
    enforced: true,
    reason: promotion
      ? "sealed promotion readiness verified"
      : "sealed dev/runtime path verified",
    failures: []
  };
}

function main() {
  const repoRoot = process.cwd();
  const args = new Set(process.argv.slice(2));
  const promotion = args.has("--promotion");

  const result = verifySealPromotionReadinessGate({ repoRoot, promotion });

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

export { verifySealPromotionReadinessGate, TOKEN };