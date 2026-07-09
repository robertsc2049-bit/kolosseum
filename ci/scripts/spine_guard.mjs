// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { BETA_TOKEN_REPORT_TOPIC_TOKENS, createCiTokenReport, emitCiTokenReport } from "./ci_token_report.mjs";

const GUARD = "BETA-01";
const SUCCESS_TOKEN = BETA_TOKEN_REPORT_TOPIC_TOKENS.spine;
const TOKEN = {
  missingSpineDoc: "CI_SPINE_MISSING_DOC",
  authorityConflict: "CI_SPINE_AUTHORITY_CONFLICT",
  missingManifest: "CI_BETA_SPINE_MANIFEST_MISSING",
  invalidManifest: "CI_BETA_SPINE_MANIFEST_INVALID",
  missingArtefact: "CI_BETA_SPINE_MISSING_ARTEFACT",
  orphanArtefact: "CI_BETA_SPINE_ORPHAN_ARTEFACT",
  versionMismatch: "CI_BETA_SPINE_VERSION_MISMATCH",
  engineCompatibilityMismatch: "CI_BETA_SPINE_ENGINE_COMPATIBILITY_MISMATCH",
  phaseScopeViolation: "CI_BETA_SPINE_PHASE_SCOPE_VIOLATION",
  dependencyOrder: "CI_BETA_SPINE_DEPENDENCY_ORDER",
  forbiddenResolution: "CI_BETA_SPINE_FORBIDDEN_RESOLUTION",
  duplicateArtefact: "CI_BETA_SPINE_DUPLICATE_ARTEFACT"
};

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    spineDoc: "docs/SPINE.md",
    betaManifest: "spine/BETA_ARTEFACT_MANIFEST.json",
    betaTarget: "spine/BUILD_TARGET_september_beta_2026.md"
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") args.root = path.resolve(String(argv[++i] || ""));
    else if (a === "--spine") args.spineDoc = String(argv[++i] || "");
    else if (a === "--manifest") args.betaManifest = String(argv[++i] || "");
    else if (a === "--target") args.betaTarget = String(argv[++i] || "");
    else {
      fail(TOKEN.invalidManifest, "Unknown spine guard argument.", { arg: a });
    }
  }

  return args;
}

const ARGS = parseArgs(process.argv.slice(2));
const ROOT = ARGS.root;
const failures = [];

function normRel(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/g, "")
    .replace(/\/+/g, "/");
}

function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function repoAbs(rel) {
  return path.resolve(ROOT, normRel(rel));
}

function existsRel(rel) {
  return fs.existsSync(repoAbs(rel));
}

function readTextRel(rel) {
  return fs.readFileSync(repoAbs(rel), "utf8");
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function fail(token, message, detail = {}) {
  failures.push({
    ok: false,
    guard: GUARD,
    token,
    message,
    ...detail
  });
}

function finishIfFailed() {
  if (failures.length === 0) return;

  const reportFailures = failures.map((failure) => ({
    token: failure.token,
    message: failure.message,
    source: "ci/scripts/spine_guard.mjs",
    location: failure.path ? { path: failure.path } : undefined,
    details: Object.fromEntries(
      Object.entries(failure).filter(([key]) => !["ok", "guard", "token", "message", "path"].includes(key))
    )
  }));

  emitCiTokenReport(createCiTokenReport({
    guard: GUARD,
    token: SUCCESS_TOKEN,
    failures: reportFailures
  }), { stream: "stderr" });

  process.exit(1);
}

function assertSafeRepoPath(rel, token, context = {}) {
  const p = normRel(rel);
  if (!p || p.startsWith("/") || p.startsWith("../") || p.includes("/../") || /^[a-zA-Z]:\//.test(p) || p.includes("\0")) {
    fail(token, "Unsafe or non-repo-relative artefact path.", { path: rel, ...context });
    return "";
  }

  const abs = repoAbs(p);
  const back = normRel(path.relative(ROOT, abs));
  if (back.startsWith("../") || path.isAbsolute(back)) {
    fail(token, "Artefact path escapes repo root.", { path: rel, ...context });
    return "";
  }

  return p;
}

function readJsonRel(rel) {
  try {
    return JSON.parse(readTextRel(rel));
  } catch (error) {
    fail(TOKEN.invalidManifest, "Manifest JSON is invalid.", {
      path: rel,
      error: String(error?.message || error)
    });
    return null;
  }
}

function validateLegacySpineDoc() {
  const spinePath = normRel(ARGS.spineDoc);

  if (!existsRel(spinePath)) {
    fail(TOKEN.missingSpineDoc, "docs/SPINE.md not found.", { path: spinePath });
    return;
  }

  const spine = readTextRel(spinePath);
  const matches = [...spine.matchAll(/\*\*([^*]+\.(?:md|docx))\*\*/g)].map((m) => m[1]);

  if (matches.length === 0) {
    fail(TOKEN.authorityConflict, "No documents detected in SPINE.md.", { path: spinePath });
    return;
  }

  for (const file of matches) {
    const rel = normRel(path.posix.join("docs", file));
    if (!existsRel(rel)) {
      fail(TOKEN.missingSpineDoc, "SPINE.md lists a missing authority document.", {
        reference: file,
        expected_path: rel
      });
    }
  }
}

function listFilesUnder(relRoot) {
  const root = assertSafeRepoPath(relRoot, TOKEN.invalidManifest, { field: "orphan_scope_roots" });
  if (!root) return [];

  const absRoot = repoAbs(root);
  if (!fs.existsSync(absRoot)) {
    fail(TOKEN.invalidManifest, "Manifest orphan scope root is missing.", { root });
    return [];
  }

  const out = [];

  function walk(absDir) {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    entries.sort((a, b) => asciiCompare(a.name, b.name));

    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      const rel = normRel(path.relative(ROOT, abs));
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.isFile()) {
        out.push(rel);
      }
    }
  }

  walk(absRoot);
  return out.sort(asciiCompare);
}

function phaseValues(artefact) {
  const phases = [];

  if (Array.isArray(artefact.phases)) {
    for (const p of artefact.phases) phases.push(Number(p));
  }

  if (Array.isArray(artefact.phase_range) && artefact.phase_range.length === 2) {
    const start = Number(artefact.phase_range[0]);
    const end = Number(artefact.phase_range[1]);
    if (Number.isInteger(start) && Number.isInteger(end) && start <= end) {
      for (let p = start; p <= end; p++) phases.push(p);
    }
  }

  return [...new Set(phases)].sort((a, b) => a - b);
}

function assertResolutionPolicy(manifest) {
  const policy = manifest.resolution_policy;
  if (!isPlainObject(policy)) {
    fail(TOKEN.forbiddenResolution, "Manifest resolution_policy is missing or invalid.");
    return;
  }

  const requiredTrue = [
    "explicit_manifest_only",
    "no_fallback",
    "no_discovery",
    "no_inference",
    "no_defaults",
    "unknown_reference_hard_fail"
  ];

  for (const key of requiredTrue) {
    if (policy[key] !== true) {
      fail(TOKEN.forbiddenResolution, "Manifest resolution policy must fail closed.", {
        field: `resolution_policy.${key}`,
        expected: true,
        actual: policy[key]
      });
    }
  }
}

function validateBetaManifest() {
  const betaTarget = normRel(ARGS.betaTarget);
  const manifestPath = normRel(ARGS.betaManifest);

  const betaTargetExists = existsRel(betaTarget);
  const manifestExists = existsRel(manifestPath);

  if (!betaTargetExists && !manifestExists) {
    return;
  }

  if (!manifestExists) {
    fail(TOKEN.missingManifest, "Beta build target exists but beta artefact manifest is missing.", {
      beta_target: betaTarget,
      manifest: manifestPath
    });
    return;
  }

  const manifest = readJsonRel(manifestPath);
  if (!manifest) return;

  const pkg = readJsonRel("package.json") || {};
  const packageVersion = String(pkg.version || "").trim();

  if (!isPlainObject(manifest)) {
    fail(TOKEN.invalidManifest, "Beta artefact manifest root must be an object.", { path: manifestPath });
    return;
  }

  if (manifest.schema_version !== "kolosseum.beta.spine_artefact_manifest.v1.0.0") {
    fail(TOKEN.invalidManifest, "Beta artefact manifest schema_version mismatch.", {
      expected: "kolosseum.beta.spine_artefact_manifest.v1.0.0",
      actual: manifest.schema_version
    });
  }

  if (manifest.manifest_id !== "BETA-01") {
    fail(TOKEN.invalidManifest, "Beta artefact manifest id mismatch.", {
      expected: "BETA-01",
      actual: manifest.manifest_id
    });
  }

  if (manifest.build_target !== "september_controlled_beta_2026") {
    fail(TOKEN.invalidManifest, "Beta artefact manifest build_target mismatch.", {
      expected: "september_controlled_beta_2026",
      actual: manifest.build_target
    });
  }

  if (manifest.required_version !== packageVersion) {
    fail(TOKEN.versionMismatch, "Manifest required_version must match package version.", {
      expected: packageVersion,
      actual: manifest.required_version
    });
  }

  if (manifest.engine_compatibility !== packageVersion) {
    fail(TOKEN.engineCompatibilityMismatch, "Manifest engine_compatibility must match package version.", {
      expected: packageVersion,
      actual: manifest.engine_compatibility
    });
  }

  assertResolutionPolicy(manifest);

  if (!isPlainObject(manifest.phase_policy)) {
    fail(TOKEN.phaseScopeViolation, "Manifest phase_policy is missing or invalid.");
  } else {
    const betaOnly = JSON.stringify(manifest.phase_policy.beta_only_phases || []);
    if (betaOnly !== JSON.stringify([7, 8])) {
      fail(TOKEN.phaseScopeViolation, "Phase 7/8 must be explicitly beta-only.", {
        expected: [7, 8],
        actual: manifest.phase_policy.beta_only_phases
      });
    }

    if (manifest.phase_policy.phase_7_8_ship_scope_allowed !== false) {
      fail(TOKEN.phaseScopeViolation, "Phase 7/8 must not be allowed in ship scope.", {
        actual: manifest.phase_policy.phase_7_8_ship_scope_allowed
      });
    }

    if (manifest.phase_policy.beta_target_required !== "september_controlled_beta_2026") {
      fail(TOKEN.phaseScopeViolation, "Phase 7/8 beta-only reachability must name the beta target.", {
        actual: manifest.phase_policy.beta_target_required
      });
    }
  }

  if (!Array.isArray(manifest.artefacts) || manifest.artefacts.length === 0) {
    fail(TOKEN.invalidManifest, "Manifest artefacts must be a non-empty array.");
    return;
  }

  if (!Array.isArray(manifest.dependency_order) || manifest.dependency_order.length === 0) {
    fail(TOKEN.dependencyOrder, "Manifest dependency_order must be a non-empty array.");
  }

  const ids = new Set();
  const paths = new Set();
  const artefactsById = new Map();
  const order = Array.isArray(manifest.dependency_order) ? manifest.dependency_order.map(String) : [];

  for (let i = 0; i < manifest.artefacts.length; i++) {
    const artefact = manifest.artefacts[i];

    if (!isPlainObject(artefact)) {
      fail(TOKEN.invalidManifest, "Manifest artefact entry must be an object.", { index: i });
      continue;
    }

    const id = String(artefact.id || "").trim();
    const relPath = assertSafeRepoPath(artefact.path, TOKEN.invalidManifest, { artefact_id: id, field: "path" });

    if (!id) {
      fail(TOKEN.invalidManifest, "Manifest artefact id is required.", { index: i });
      continue;
    }

    if (ids.has(id)) {
      fail(TOKEN.duplicateArtefact, "Duplicate artefact id.", { id });
    }
    ids.add(id);

    if (relPath) {
      if (paths.has(relPath)) {
        fail(TOKEN.duplicateArtefact, "Duplicate artefact path.", { path: relPath });
      }
      paths.add(relPath);

      if (!existsRel(relPath)) {
        fail(TOKEN.missingArtefact, "Manifest artefact path is missing.", {
          artefact_id: id,
          path: relPath
        });
      }
    }

    const scope = String(artefact.scope || "").trim();
    if (!["beta", "ship", "spine"].includes(scope)) {
      fail(TOKEN.invalidManifest, "Artefact scope is invalid.", {
        artefact_id: id,
        scope
      });
    }

    if (scope === "beta" || scope === "ship") {
      if (artefact.version !== manifest.required_version) {
        fail(TOKEN.versionMismatch, "Reachable artefact version mismatch.", {
          artefact_id: id,
          expected: manifest.required_version,
          actual: artefact.version
        });
      }

      if (artefact.engine_compatibility !== manifest.engine_compatibility) {
        fail(TOKEN.engineCompatibilityMismatch, "Reachable artefact engine_compatibility mismatch.", {
          artefact_id: id,
          expected: manifest.engine_compatibility,
          actual: artefact.engine_compatibility
        });
      }
    }

    const phases = phaseValues(artefact);
    const includesBetaOnlyPhase = phases.some((p) => p === 7 || p === 8);

    if (includesBetaOnlyPhase) {
      if (
        manifest.build_target !== "september_controlled_beta_2026" ||
        scope !== "beta" ||
        artefact.beta_only !== true ||
        artefact.ship_scope !== false
      ) {
        fail(TOKEN.phaseScopeViolation, "Phase 7/8 artefact reachability must be beta-only under beta target.", {
          artefact_id: id,
          build_target: manifest.build_target,
          scope,
          beta_only: artefact.beta_only,
          ship_scope: artefact.ship_scope,
          phases
        });
      }
    }

    artefactsById.set(id, artefact);
  }

  const artefactIdsInOrder = manifest.artefacts.map((a) => String(a.id || "").trim());
  if (JSON.stringify(order) !== JSON.stringify(artefactIdsInOrder)) {
    fail(TOKEN.dependencyOrder, "Manifest dependency_order must exactly match artefacts order.", {
      dependency_order: order,
      artefacts_order: artefactIdsInOrder
    });
  }

  const orderIndex = new Map();
  order.forEach((id, index) => orderIndex.set(id, index));

  for (const artefact of manifest.artefacts) {
    const id = String(artefact.id || "").trim();
    const deps = Array.isArray(artefact.dependencies) ? artefact.dependencies.map(String) : [];

    if (!Array.isArray(artefact.dependencies)) {
      fail(TOKEN.dependencyOrder, "Artefact dependencies must be an explicit array.", { artefact_id: id });
      continue;
    }

    for (const dep of deps) {
      if (!artefactsById.has(dep)) {
        fail(TOKEN.dependencyOrder, "Artefact dependency references an unknown artefact.", {
          artefact_id: id,
          dependency: dep
        });
        continue;
      }

      if ((orderIndex.get(dep) ?? 999999) >= (orderIndex.get(id) ?? -1)) {
        fail(TOKEN.dependencyOrder, "Artefact dependency order is not deterministic/topological.", {
          artefact_id: id,
          dependency: dep
        });
      }
    }
  }

  if (!Array.isArray(manifest.spine_references) || manifest.spine_references.length === 0) {
    fail(TOKEN.invalidManifest, "Manifest spine_references must be a non-empty array.");
  } else {
    for (const ref of manifest.spine_references) {
      const refPath = typeof ref === "string" ? ref : ref?.path;
      const relPath = assertSafeRepoPath(refPath, TOKEN.invalidManifest, { field: "spine_references.path" });
      if (!relPath) continue;

      if (!existsRel(relPath)) {
        fail(TOKEN.missingArtefact, "Spine reference points to a missing artefact.", { path: relPath });
      }

      if (!paths.has(relPath)) {
        fail(TOKEN.missingArtefact, "Spine reference is not declared as a manifest artefact.", { path: relPath });
      }
    }
  }

  if (!Array.isArray(manifest.orphan_scope_roots)) {
    fail(TOKEN.orphanArtefact, "Manifest orphan_scope_roots must be an explicit array.");
  } else {
    for (const root of manifest.orphan_scope_roots) {
      const files = listFilesUnder(root);
      for (const file of files) {
        if (!paths.has(file)) {
          fail(TOKEN.orphanArtefact, "Beta/ship-scope artefact is not reachable from manifest.", {
            path: file,
            scope_root: normRel(root)
          });
        }
      }
    }
  }
}

validateLegacySpineDoc();
validateBetaManifest();
finishIfFailed();

console.log("spine_guard: OK");
console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: SUCCESS_TOKEN,
  manifest: ARGS.betaManifest,
  message: "Spine and beta artefact manifest guard passed."
}, null, 2));
