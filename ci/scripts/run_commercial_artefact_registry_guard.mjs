import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function fail(token, details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token,
        details,
        ...extra
      }
    ]
  };
}

function ok() {
  return { ok: true, failures: [] };
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isAllowedExtension(filePath, allowedExtensions) {
  return allowedExtensions.includes(path.extname(filePath).toLowerCase());
}

function collectFiles(rootDir, cwd, allowedExtensions) {
  const out = [];

  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const rel = toPosix(path.relative(cwd, abs));
      if (isAllowedExtension(rel, allowedExtensions)) {
        out.push(rel);
      }
    }
  }

  out.sort();
  return out;
}

export function runCommercialArtefactRegistryGuard(options = {}) {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const registryPath = options.registryPath
    ? path.resolve(cwd, options.registryPath)
    : path.resolve(cwd, "ci/registries/commercial_artefact_registry.json");

  if (!fs.existsSync(registryPath)) {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_MISSING",
      "Commercial artefact registry is missing.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (error) {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      `Commercial artefact registry is not valid JSON: ${error.message}`,
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  const requiredTopLevel = [
    "registry_id",
    "registry_version",
    "engine_compatibility",
    "scope_class",
    "rewrite_policy",
    "scan_roots",
    "allowed_extensions",
    "artefacts"
  ];

  for (const key of requiredTopLevel) {
    if (!(key in registry)) {
      return fail(
        "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
        `Missing required top-level key '${key}'.`,
        { path: toPosix(path.relative(cwd, registryPath)) }
      );
    }
  }

  if (registry.registry_id !== "commercial_artefact_registry") {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "registry_id must equal 'commercial_artefact_registry'.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  if (registry.engine_compatibility !== "EB2-1.0.0") {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "engine_compatibility must equal 'EB2-1.0.0'.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  if (registry.scope_class !== "closed_world" || registry.rewrite_policy !== "rewrite_only") {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "scope_class must be 'closed_world' and rewrite_policy must be 'rewrite_only'.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  if (!Array.isArray(registry.scan_roots) || registry.scan_roots.length === 0) {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "scan_roots must be a non-empty array.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  if (!Array.isArray(registry.allowed_extensions) || registry.allowed_extensions.length === 0) {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "allowed_extensions must be a non-empty array.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  if (!Array.isArray(registry.artefacts) || registry.artefacts.length === 0) {
    return fail(
      "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
      "artefacts must be a non-empty array.",
      { path: toPosix(path.relative(cwd, registryPath)) }
    );
  }

  const declaredPaths = new Set();
  for (const artefact of registry.artefacts) {
    if (!artefact || typeof artefact !== "object") {
      return fail(
        "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
        "Each artefact entry must be an object.",
        { path: toPosix(path.relative(cwd, registryPath)) }
      );
    }

    for (const key of ["artefact_id", "path", "class"]) {
      if (!(key in artefact) || typeof artefact[key] !== "string" || artefact[key].trim() === "") {
        return fail(
          "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
          `Each artefact must contain non-empty string '${key}'.`,
          { path: toPosix(path.relative(cwd, registryPath)) }
        );
      }
    }

    const relPath = toPosix(artefact.path);
    if (declaredPaths.has(relPath)) {
      return fail(
        "CI_COMMERCIAL_ARTEFACT_REGISTRY_INVALID",
        `Duplicate declared artefact path '${relPath}'.`,
        { path: toPosix(path.relative(cwd, registryPath)) }
      );
    }
    declaredPaths.add(relPath);

    const absPath = path.resolve(cwd, relPath);
    if (!fs.existsSync(absPath)) {
      return fail(
        "CI_COMMERCIAL_ARTEFACT_MISSING",
        `Declared commercial artefact is missing: '${relPath}'.`,
        { path: relPath, artefact_id: artefact.artefact_id }
      );
    }
  }

  const discoveredPaths = new Set();
  for (const root of registry.scan_roots) {
    const absRoot = path.resolve(cwd, root);
    for (const relPath of collectFiles(absRoot, cwd, registry.allowed_extensions)) {
      discoveredPaths.add(relPath);
    }
  }

  for (const relPath of discoveredPaths) {
    if (!declaredPaths.has(relPath)) {
      return fail(
        "CI_COMMERCIAL_ARTEFACT_UNDECLARED",
        `Undeclared commercial artefact detected: '${relPath}'.`,
        { path: relPath }
      );
    }
  }

  return ok();
}

function main() {
  const report = runCommercialArtefactRegistryGuard();
  const payload = JSON.stringify(report, null, 2) + "\n";

  if (!report.ok) {
    process.stderr.write(payload);
    process.exit(1);
  }

  process.stdout.write(payload);
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}