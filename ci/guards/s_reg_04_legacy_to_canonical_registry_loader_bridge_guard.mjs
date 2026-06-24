// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-04 guard.
 * Purpose: proves the legacy-to-canonical registry bridge is explicit and
 * bridge-only.
 * Boundary: this guard must not activate canonical registry files, alter
 * registry_index, alter registry_bundle, weaken registry law, or change engine
 * runtime behaviour.
 * Determinism: reads fixed repo files, a frozen alias map, and git state only.
 * Failure: emits CI_S_REG_04_LEGACY_CANONICAL_REGISTRY_BRIDGE when the bridge
 * drifts from the accepted compact-source boundary.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-04";
const TOKEN = "CI_S_REG_04_LEGACY_CANONICAL_REGISTRY_BRIDGE";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const expectedAliasMap = Object.freeze({
  activity_registry_1: Object.freeze({
    legacy_registry_id: "activity",
    alias_scope: "legacy_compact_activity_alias"
  }),
  movement_registry_3: Object.freeze({
    legacy_registry_id: "movement",
    alias_scope: "legacy_compact_movement_alias"
  }),
  exercise_registry_3a: Object.freeze({
    legacy_registry_id: "exercise",
    alias_scope: "legacy_compact_exercise_alias"
  }),
  sport_program_profile_registry_5d: Object.freeze({
    legacy_registry_id: "program",
    alias_scope: "legacy_compact_program_profile_alias_no_template_structure"
  })
});

const files = Object.freeze({
  module: "ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs",
  test: "test/s_reg_04_legacy_to_canonical_registry_loader_bridge.test.mjs",
  guard: "ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs",
  doc: "docs/roadmap/S_REG_04_LEGACY_TO_CANONICAL_REGISTRY_LOADER_BRIDGE.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const allowedChangedFiles = new Set([
  files.module,
  files.test,
  files.guard,
  files.doc,
  files.packageJson,
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exit(1);
}

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readText(relativePath) {
  const fullPath = repoPath(relativePath);

  if (!fs.existsSync(fullPath)) {
    fail("Required S-REG-04 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-04 JSON file is invalid.", {
      path: relativePath,
      error: error?.message ?? String(error)
    });
  }
}

function assertDeepEqual(actual, expected, message, details = {}) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    fail(message, {
      ...details,
      actual,
      expected
    });
  }
}

function assertIncludes(text, marker, context) {
  if (!text.includes(marker)) {
    fail("Required S-REG-04 marker is missing.", {
      context,
      marker
    });
  }
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}

function parsePorcelainPath(line) {
  if (!line) {
    return "";
  }

  let relPath = "";

  if (line.length >= 3 && line[2] === " ") {
    relPath = line.slice(3);
  } else if (line.length >= 2) {
    relPath = line.slice(2).trimStart();
  } else {
    relPath = line.trim();
  }

  if (relPath.includes(" -> ")) {
    relPath = relPath.split(" -> ").pop().trim();
  }

  return relPath.replace(/^"|"$/gu, "").replace(/\\/gu, "/");
}

function currentChangedFiles() {
  const changed = new Set();

  const porcelain = gitOutput(["status", "--porcelain=v1", "-uall"]);
  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      changed.add(relPath);
    }
  }

  const base = gitOutput(["merge-base", "HEAD", "origin/main"]);
  if (base) {
    const committed = gitOutput(["diff", "--name-only", `${base}..HEAD`]);
    for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
      changed.add(relPath.replace(/\\/gu, "/"));
    }
  }

  return [...changed].sort();
}

function assertChangedFilesAllowed() {
  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-04 touched files outside the bridge-only boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }
}

function assertNoCanonicalRegistryActivation() {
  for (const canonicalRegistryId of Object.keys(expectedAliasMap)) {
    const canonicalPath = path.join("registries", canonicalRegistryId);
    if (fs.existsSync(repoPath(canonicalPath))) {
      fail("S-REG-04 must not activate canonical registry directories.", {
        canonical_registry_id: canonicalRegistryId,
        path: canonicalPath
      });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();

  const registryIndex = readJson(files.registryIndex);
  const registryBundle = readJson(files.registryBundle);

  assertDeepEqual(
    registryIndex.order,
    compactOrder,
    "S-REG-04 requires the active registry_index order to remain compact."
  );

  assertDeepEqual(
    Object.keys(registryBundle.registries),
    compactOrder,
    "S-REG-04 requires the active registry_bundle keys to remain compact."
  );

  assertNoCanonicalRegistryActivation();

  const bridgeModule = await import(pathToFileURL(repoPath(files.module)).href);
  const actualAliasMap = bridgeModule.sReg04CanonicalAliasMap();

  assertDeepEqual(
    actualAliasMap,
    expectedAliasMap,
    "S-REG-04 bridge alias map drifted from the accepted explicit mapping."
  );

  for (const canonicalRegistryId of Object.keys(expectedAliasMap)) {
    const resolved = bridgeModule.sReg04ResolveCanonicalRegistry(registryBundle, canonicalRegistryId);
    const expected = expectedAliasMap[canonicalRegistryId];

    if (resolved.canonical_registry_id !== canonicalRegistryId) {
      fail("S-REG-04 bridge returned the wrong canonical registry id.", {
        canonical_registry_id: canonicalRegistryId,
        resolved
      });
    }

    if (resolved.legacy_registry_id !== expected.legacy_registry_id) {
      fail("S-REG-04 bridge returned the wrong legacy registry id.", {
        canonical_registry_id: canonicalRegistryId,
        expected_legacy_registry_id: expected.legacy_registry_id,
        actual_legacy_registry_id: resolved.legacy_registry_id
      });
    }

    if (resolved.registry_completion_claim !== false || resolved.content_migration_claim !== false || resolved.template_structure_claim !== false) {
      fail("S-REG-04 bridge must not claim registry completion, content migration, or template structure.", {
        canonical_registry_id: canonicalRegistryId,
        resolved
      });
    }
  }

  try {
    bridgeModule.sReg04ResolveCanonicalRegistry(registryBundle, "equipment_registry");
    fail("S-REG-04 unsupported canonical registry id did not fail closed.");
  } catch (error) {
    if (error?.code !== TOKEN || error?.reason !== "unsupported_canonical_registry_id") {
      fail("S-REG-04 unsupported canonical registry id emitted the wrong failure.", {
        code: error?.code ?? null,
        reason: error?.reason ?? null
      });
    }
  }

  const doc = readText(files.doc);
  for (const marker of [
    "S-REG-04 - Legacy-to-Canonical Registry Loader Bridge",
    "This is a bridge-only slice.",
    "It does not activate canonical registry IDs in registry_index.json.",
    "It does not add registry content.",
    "It does not claim full canonical v1 registry completion.",
    "activity -> activity_registry_1",
    "movement -> movement_registry_3",
    "exercise -> exercise_registry_3a",
    "program -> sport_program_profile_registry_5d"
  ]) {
    assertIncludes(doc, marker, files.doc);
  }

  const packageJson = readJson(files.packageJson);
  const packageText = JSON.stringify(packageJson);

  for (const marker of [
    "proof:s-reg-04",
    "test/s_reg_04_legacy_to_canonical_registry_loader_bridge.test.mjs",
    "ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, files.packageJson);
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    message: "S-REG-04 legacy-to-canonical registry bridge boundary passed."
  }, null, 2));
}

main().catch((error) => {
  fail("S-REG-04 guard crashed.", {
    error: error?.message ?? String(error)
  });
});