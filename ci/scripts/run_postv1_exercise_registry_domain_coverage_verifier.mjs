import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  COVERAGE_SOURCE_UNPARSEABLE: "coverage_source_unparseable",
  COVERAGE_INVALID_DECLARATION: "coverage_invalid_declaration",
  COVERAGE_REQUIRED_SURFACE_MISSING: "coverage_required_surface_missing",
  COVERAGE_REQUIRED_DOMAIN_MISSING: "coverage_required_domain_missing",
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

function createFailure(token, filePath, details, registryDomain = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(registryDomain ? { registry_domain: registryDomain } : {}),
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function loadCoverageDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Exercise registry domain coverage declaration must be a JSON object.");
  }

  if (typeof declarationJson.coverage_id !== "string" || declarationJson.coverage_id.trim().length === 0) {
    throw new Error("Exercise registry domain coverage declaration must declare a non-empty coverage_id.");
  }

  if (!Array.isArray(declarationJson.required_surfaces)) {
    throw new Error("Exercise registry domain coverage declaration must contain a required_surfaces array.");
  }

  if (!Array.isArray(declarationJson.required_registry_domains)) {
    throw new Error("Exercise registry domain coverage declaration must contain a required_registry_domains array.");
  }

  if (!Array.isArray(declarationJson.declared_registry_domain_claims)) {
    throw new Error("Exercise registry domain coverage declaration must contain a declared_registry_domain_claims array.");
  }

  return {
    coverageId: declarationJson.coverage_id.trim(),
    requiredSurfaces: declarationJson.required_surfaces.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_surfaces[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    requiredRegistryDomains: declarationJson.required_registry_domains.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_registry_domains[${index}] must be a non-empty string.`);
      }
      return item.trim();
    }),
    declaredRegistryDomainClaims: declarationJson.declared_registry_domain_claims.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`declared_registry_domain_claims[${index}] must be a non-empty string.`);
      }
      return item.trim();
    }),
  };
}

function verifyCoverage({ repoRoot, declarationPath }) {
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

  const declaredClaims = new Set(declaration.declaredRegistryDomainClaims);

  for (const registryDomain of declaration.requiredRegistryDomains) {
    if (!declaredClaims.has(registryDomain)) {
      failures.push(
        createFailure(
          FAILURE.COVERAGE_REQUIRED_DOMAIN_MISSING,
          declarationRepoRelative,
          `Required exercise registry domain '${registryDomain}' is missing from declared_registry_domain_claims.`,
          registryDomain
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    coverage_id: declaration.coverageId,
    verified_surfaces: declaration.requiredSurfaces.map((item) => item.repoRelative),
    verified_registry_domains: declaration.requiredRegistryDomains,
    failures,
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_EXERCISE_REGISTRY_DOMAIN_COVERAGE.json";
  const report = verifyCoverage({ repoRoot, declarationPath });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

main();