// @law: Runtime Boundary
// @severity: high
// @scope: engine

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_ENGINE_ROOTS = [
  "engine/src",
  "engine/runtime",
  "engine/session"
];

const DEFAULT_PACKAGE_PATH = "engine/package.json";

const FORBIDDEN_SURFACE_PARTS = [
  "/app/",
  "/apps/",
  "/ui/",
  "/web/",
  "/copy/",
  "/commercial/",
  "/marketing/",
  "/billing/",
  "/payment/",
  "/payments/",
  "/stripe/",
  "/subscription/",
  "/subscriptions/",
  "/notes/",
  "/coach-notes/",
  "/coach_notes/",
  "/auth/",
  "/dashboard/",
  "/dashboards/",
  "/analytics/",
  "/claims/",
  "/server/",
  "/src/api/"
];

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
]);

function toPosix(value) {
  return String(value).replaceAll("\\", "/");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

/**
 * DEV NOTE: Comment stripping keeps this guard focused on executable import
 * relationships. Boundary wording in DEV NOTE comments is handled by comment
 * policy guards, not by this import graph check.
 */
function stripComments(sourceText) {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, "$1");
}

/**
 * DEV NOTE: Import extraction covers static imports, re-exports, dynamic imports,
 * and CommonJS require calls so product surfaces cannot enter engine code through
 * a different module syntax.
 */
export function extractImportSpecifiers(sourceText) {
  const source = stripComments(sourceText);
  const specs = [];

  const patterns = [
    /import\s+[^"']*["']([^"']+)["']/g,
    /export\s+[^"']*from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(String(match[1] || ""));
    }
  }

  return [...new Set(specs)].sort((a, b) => a.localeCompare(b));
}

function walkFiles(rootPath, files = []) {
  if (!fs.existsSync(rootPath)) return files;

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    const rel = toPosix(path.relative(process.cwd(), fullPath));

    if (entry.isDirectory()) {
      if (
        rel.includes("/node_modules/") ||
        rel.includes("/dist/") ||
        rel.includes("/types/") ||
        rel.includes("/coverage/") ||
        rel.includes("/__fixtures__/")
      ) {
        continue;
      }

      walkFiles(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function normaliseImportForBoundary(repoRoot, importerPath, specifier) {
  const importerDir = path.dirname(importerPath);

  if (specifier.startsWith(".")) {
    return "/" + toPosix(path.relative(repoRoot, path.resolve(importerDir, specifier))) + "/";
  }

  return "/" + toPosix(specifier) + "/";
}

function isForbiddenSurfacePath(normalisedPath) {
  return FORBIDDEN_SURFACE_PARTS.some((part) => normalisedPath.includes(part));
}

/**
 * DEV NOTE: Engine implementation may use node built-ins, package dependencies,
 * and internal engine files. It must not reach sideways into app, UI, copy,
 * notes, commercial, payment, auth, analytics, server, or claim surfaces.
 */
export function collectEngineImportBoundaryFailures(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const engineRoots = options.engineRoots || DEFAULT_ENGINE_ROOTS;
  const failures = [];

  for (const relRoot of engineRoots) {
    const rootPath = path.join(repoRoot, relRoot);
    for (const filePath of walkFiles(rootPath)) {
      const sourceText = readUtf8(filePath);
      const specifiers = extractImportSpecifiers(sourceText);
      const relFile = toPosix(path.relative(repoRoot, filePath));

      for (const specifier of specifiers) {
        const normalised = normaliseImportForBoundary(repoRoot, filePath, specifier);

        if (specifier.startsWith(".")) {
          const resolvedPath = path.resolve(path.dirname(filePath), specifier);
          const resolvedRel = "/" + toPosix(path.relative(repoRoot, resolvedPath)) + "/";

          if (!resolvedPath.startsWith(path.join(repoRoot, "engine") + path.sep)) {
            failures.push({
              token: "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT",
              file: relFile,
              import_specifier: specifier,
              details: "Engine source must not import files outside engine."
            });
            continue;
          }

          if (isForbiddenSurfacePath(resolvedRel)) {
            failures.push({
              token: "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT",
              file: relFile,
              import_specifier: specifier,
              details: "Engine source imports a forbidden product surface."
            });
          }

          continue;
        }

        if (isForbiddenSurfacePath(normalised)) {
          failures.push({
            token: "CI_ENGINE_BOUNDARY_FORBIDDEN_IMPORT",
            file: relFile,
            import_specifier: specifier,
            details: "Engine source imports a forbidden package surface."
          });
        }
      }
    }
  }

  return failures;
}

/**
 * DEV NOTE: Package export hygiene prevents callers from treating app, UI, copy,
 * notes, commercial, payment, auth, analytics, server, or claim files as public
 * engine API through engine/package.json.
 */
export function collectEnginePackageExportBoundaryFailures(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const packagePath = path.join(repoRoot, options.packagePath || DEFAULT_PACKAGE_PATH);
  const failures = [];

  if (!fs.existsSync(packagePath)) {
    return [
      {
        token: "CI_ENGINE_BOUNDARY_PACKAGE_MISSING",
        file: toPosix(path.relative(repoRoot, packagePath)),
        details: "engine/package.json is required for engine export boundary checks."
      }
    ];
  }

  const pkg = readJson(packagePath);
  const exportsField = pkg.exports;

  if (!isPlainObject(exportsField)) {
    return [
      {
        token: "CI_ENGINE_BOUNDARY_EXPORTS_INVALID",
        file: toPosix(path.relative(repoRoot, packagePath)),
        details: "engine/package.json exports must be an object."
      }
    ];
  }

  for (const [exportKey, exportValue] of Object.entries(exportsField)) {
    if (!isPlainObject(exportValue)) {
      failures.push({
        token: "CI_ENGINE_BOUNDARY_EXPORTS_INVALID",
        file: toPosix(path.relative(repoRoot, packagePath)),
        export_key: exportKey,
        details: "Each engine export must be an object."
      });
      continue;
    }

    for (const field of ["types", "default"]) {
      const value = exportValue[field];

      if (typeof value !== "string") {
        failures.push({
          token: "CI_ENGINE_BOUNDARY_EXPORTS_INVALID",
          file: toPosix(path.relative(repoRoot, packagePath)),
          export_key: exportKey,
          details: `Export ${field} must be a string.`
        });
        continue;
      }

      const normalised = "/" + toPosix(value).replace(/^\.\//, "") + "/";

      if (isForbiddenSurfacePath(normalised)) {
        failures.push({
          token: "CI_ENGINE_BOUNDARY_FORBIDDEN_EXPORT",
          file: toPosix(path.relative(repoRoot, packagePath)),
          export_key: exportKey,
          export_field: field,
          export_path: value,
          details: "Engine package export points at a forbidden product surface."
        });
      }
    }
  }

  return failures;
}

export function runNoCouplingEngineBoundaryGuard(options = {}) {
  const failures = [
    ...collectEngineImportBoundaryFailures(options),
    ...collectEnginePackageExportBoundaryFailures(options)
  ];

  return {
    ok: failures.length === 0,
    checked_engine_roots: options.engineRoots || DEFAULT_ENGINE_ROOTS,
    checked_package_path: options.packagePath || DEFAULT_PACKAGE_PATH,
    forbidden_surface_parts: FORBIDDEN_SURFACE_PARTS,
    failures
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runNoCouplingEngineBoundaryGuard();

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }
}
