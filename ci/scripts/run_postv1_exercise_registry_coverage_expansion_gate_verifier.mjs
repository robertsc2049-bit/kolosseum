import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  COVERAGE_SOURCE_UNPARSEABLE: "coverage_source_unparseable",
  COVERAGE_INVALID_DECLARATION: "coverage_invalid_declaration",
  COVERAGE_REQUIRED_SURFACE_MISSING: "coverage_required_surface_missing",
  COVERAGE_DUPLICATE_REQUIRED_ENTRY: "coverage_duplicate_required_entry",
  COVERAGE_DUPLICATE_DECLARED_ENTRY: "coverage_duplicate_declared_entry",
  COVERAGE_MISSING_MVP_ENTRY: "coverage_missing_mvp_entry",
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function createFailure(token, filePath, details, coverageKey = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(coverageKey ? { coverage_key: coverageKey } : {}),
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function validateCoverageEntry(item, index, fieldName) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${fieldName}[${index}] must be an object.`);
  }

  if (typeof item.movement_class !== "string" || item.movement_class.trim().length === 0) {
    throw new Error(`${fieldName}[${index}].movement_class must be a non-empty string.`);
  }

  if (typeof item.movement_pattern !== "string" || item.movement_pattern.trim().length === 0) {
    throw new Error(`${fieldName}[${index}].movement_pattern must be a non-empty string.`);
  }

  return {
    movementClass: item.movement_class.trim(),
    movementPattern: item.movement_pattern.trim(),
  };
}

function coverageKey(item) {
  return `${item.movementClass}::${item.movementPattern}`;
}

function loadCoverageDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Exercise registry coverage declaration must be a JSON object.");
  }

  if (typeof declarationJson.coverage_map_id !== "string" || declarationJson.coverage_map_id.trim().length === 0) {
    throw new Error("Exercise registry coverage declaration must declare a non-empty coverage_map_id.");
  }

  if (!Array.isArray(declarationJson.required_surfaces)) {
    throw new Error("Exercise registry coverage declaration must contain a required_surfaces array.");
  }

  if (!Array.isArray(declarationJson.mvp_required_coverage)) {
    throw new Error("Exercise registry coverage declaration must contain an mvp_required_coverage array.");
  }

  if (!Array.isArray(declarationJson.declared_mvp_coverage)) {
    throw new Error("Exercise registry coverage declaration must contain a declared_mvp_coverage array.");
  }

  return {
    coverageMapId: declarationJson.coverage_map_id.trim(),
    requiredSurfaces: declarationJson.required_surfaces.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_surfaces[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    requiredCoverage: declarationJson.mvp_required_coverage.map((item, index) =>
      validateCoverageEntry(item, index, "mvp_required_coverage")
    ),
    declaredCoverage: declarationJson.declared_mvp_coverage.map((item, index) =>
      validateCoverageEntry(item, index, "declared_mvp_coverage")
    ),
  };
}

function verifyCoverageExpansionGate({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadCoverageDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.COVERAGE_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  const failures = [];

  const seenSurfacePaths = new Set();
  for (const surface of declaration.requiredSurfaces) {
    if (seenSurfacePaths.has(surface.repoRelative)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_INVALID_DECLARATION,
          declarationRepoRelative,
          `Duplicate required surface '${surface.repoRelative}' is not permitted.`
        )
      );
      continue;
    }
    seenSurfacePaths.add(surface.repoRelative);

    if (!fs.existsSync(surface.absolute)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_REQUIRED_SURFACE_MISSING,
          surface.repoRelative,
          `Required exercise registry coverage surface '${surface.repoRelative}' is missing.`
        )
      );
    }
  }

  const requiredSet = new Set();
  for (const item of declaration.requiredCoverage) {
    const key = coverageKey(item);
    if (requiredSet.has(key)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_DUPLICATE_REQUIRED_ENTRY,
          declarationRepoRelative,
          `Duplicate required MVP coverage entry '${key}' is not permitted.`,
          key
        )
      );
      continue;
    }
    requiredSet.add(key);
  }

  const declaredSet = new Set();
  for (const item of declaration.declaredCoverage) {
    const key = coverageKey(item);
    if (declaredSet.has(key)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_DUPLICATE_DECLARED_ENTRY,
          declarationRepoRelative,
          `Duplicate declared MVP coverage entry '${key}' is not permitted.`,
          key
        )
      );
      continue;
    }
    declaredSet.add(key);
  }

  for (const key of requiredSet) {
    if (!declaredSet.has(key)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_MISSING_MVP_ENTRY,
          declarationRepoRelative,
          `Required MVP coverage entry '${key}' is missing from declared_mvp_coverage.`,
          key
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    coverage_map_id: declaration.coverageMapId,
    verified_surfaces: declaration.requiredSurfaces.map((item) => item.repoRelative),
    verified_required_coverage: declaration.requiredCoverage.map((item) => ({
      movement_class: item.movementClass,
      movement_pattern: item.movementPattern,
    })),
    failures,
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_EXERCISE_REGISTRY_COVERAGE_MAP.json";
  const report = verifyCoverageExpansionGate({ repoRoot, declarationPath });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

main();