import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function ensureArray(value, code, message, details = {}) {
  if (!Array.isArray(value)) {
    fail(code, message, details);
  }
}

function toAbs(repoRoot, repoRelativePath) {
  return path.resolve(repoRoot, repoRelativePath);
}

function loadGovernedSurface(repoRoot, surfaceManifestPath) {
  const abs = toAbs(repoRoot, surfaceManifestPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_GOVERNED_SURFACE_MISSING",
      `Governed surface manifest '${surfaceManifestPath}' does not exist.`,
      { path: surfaceManifestPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.governed_surface.v1") {
    fail(
      "FREEZE_GOVERNED_SURFACE_SCHEMA_INVALID",
      "Governed surface manifest schema_version must be kolosseum.freeze.governed_surface.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.governed_artefacts,
    "FREEZE_GOVERNED_SURFACE_ARTEFACTS_INVALID",
    "Governed surface manifest governed_artefacts must be an array."
  );

  const seen = new Set();
  const artefacts = [];

  for (const [index, item] of manifest.governed_artefacts.entries()) {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_GOVERNED_SURFACE_ENTRY_INVALID",
        `Governed artefact entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.path !== "string" || item.path.length === 0) {
      fail(
        "FREEZE_GOVERNED_SURFACE_PATH_INVALID",
        `Governed artefact entry at index ${index} must include a non-empty path.`,
        { index }
      );
    }

    if (seen.has(item.path)) {
      fail(
        "FREEZE_GOVERNED_SURFACE_DUPLICATE_PATH",
        `Duplicate governed artefact path '${item.path}'.`,
        { path: item.path }
      );
    }

    seen.add(item.path);
    artefacts.push(item.path);
  }

  artefacts.sort((a, b) => a.localeCompare(b, "en"));
  return artefacts;
}

function loadBindings(repoRoot, bindingsManifestPath) {
  const abs = toAbs(repoRoot, bindingsManifestPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_BINDINGS_MISSING",
      `Proof bindings manifest '${bindingsManifestPath}' does not exist.`,
      { path: bindingsManifestPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.surface_to_proof_bindings.v1") {
    fail(
      "FREEZE_PROOF_BINDINGS_SCHEMA_INVALID",
      "Proof bindings manifest schema_version must be kolosseum.freeze.surface_to_proof_bindings.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.proof_surfaces,
    "FREEZE_PROOF_SURFACES_INVALID",
    "Proof bindings manifest proof_surfaces must be an array."
  );

  ensureArray(
    manifest.surface_to_proof_bindings,
    "FREEZE_SURFACE_TO_PROOF_BINDINGS_INVALID",
    "Proof bindings manifest surface_to_proof_bindings must be an array."
  );

  const proofSurfaces = new Set();
  for (const [index, item] of manifest.proof_surfaces.entries()) {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_SURFACE_ENTRY_INVALID",
        `Proof surface entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.proof_surface_id !== "string" || item.proof_surface_id.length === 0) {
      fail(
        "FREEZE_PROOF_SURFACE_ID_INVALID",
        `Proof surface entry at index ${index} must include a non-empty proof_surface_id.`,
        { index }
      );
    }

    if (proofSurfaces.has(item.proof_surface_id)) {
      fail(
        "FREEZE_PROOF_SURFACE_ID_DUPLICATE",
        `Duplicate proof_surface_id '${item.proof_surface_id}'.`,
        { proof_surface_id: item.proof_surface_id }
      );
    }

    proofSurfaces.add(item.proof_surface_id);
  }

  const bindings = [];
  const bindingKeys = new Set();

  for (const [index, item] of manifest.surface_to_proof_bindings.entries()) {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_BINDING_ENTRY_INVALID",
        `Binding entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.governed_artefact_path !== "string" || item.governed_artefact_path.length === 0) {
      fail(
        "FREEZE_PROOF_BINDING_GOVERNED_PATH_INVALID",
        `Binding entry at index ${index} must include a non-empty governed_artefact_path.`,
        { index }
      );
    }

    if (typeof item.proof_surface_id !== "string" || item.proof_surface_id.length === 0) {
      fail(
        "FREEZE_PROOF_BINDING_SURFACE_ID_INVALID",
        `Binding entry at index ${index} must include a non-empty proof_surface_id.`,
        { index }
      );
    }

    const key = `${item.governed_artefact_path}::${item.proof_surface_id}`;
    if (bindingKeys.has(key)) {
      fail(
        "FREEZE_PROOF_BINDING_DUPLICATE",
        `Duplicate binding '${key}'.`,
        { governed_artefact_path: item.governed_artefact_path, proof_surface_id: item.proof_surface_id }
      );
    }

    bindingKeys.add(key);
    bindings.push({
      governed_artefact_path: item.governed_artefact_path,
      proof_surface_id: item.proof_surface_id
    });
  }

  return { proofSurfaces, bindings };
}

export function verifyFreezeProofCoverage({
  repoRoot = process.cwd(),
  surfaceManifestPath = "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json",
  bindingsManifestPath = "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json"
} = {}) {
  const governedArtefacts = loadGovernedSurface(repoRoot, surfaceManifestPath);
  const { proofSurfaces, bindings } = loadBindings(repoRoot, bindingsManifestPath);

  const governedSet = new Set(governedArtefacts);
  const coverage = new Map(governedArtefacts.map((item) => [item, []]));
  const failures = [];
  const usedProofSurfaceIds = new Set();

  for (const binding of bindings) {
    if (!governedSet.has(binding.governed_artefact_path)) {
      failures.push({
        code: "FREEZE_PROOF_BINDING_DANGLING_GOVERNED_ARTEFACT",
        message: `Binding references non-governed artefact '${binding.governed_artefact_path}'.`,
        governed_artefact_path: binding.governed_artefact_path,
        proof_surface_id: binding.proof_surface_id
      });
      continue;
    }

    if (!proofSurfaces.has(binding.proof_surface_id)) {
      failures.push({
        code: "FREEZE_PROOF_BINDING_UNKNOWN_PROOF_SURFACE",
        message: `Binding references unknown proof surface '${binding.proof_surface_id}'.`,
        governed_artefact_path: binding.governed_artefact_path,
        proof_surface_id: binding.proof_surface_id
      });
      continue;
    }

    coverage.get(binding.governed_artefact_path).push(binding.proof_surface_id);
    usedProofSurfaceIds.add(binding.proof_surface_id);
  }

  for (const governedArtefactPath of governedArtefacts) {
    const boundProofSurfaces = coverage.get(governedArtefactPath) ?? [];
    if (boundProofSurfaces.length === 0) {
      failures.push({
        code: "FREEZE_GOVERNED_ARTEFACT_UNCOVERED",
        message: `Governed artefact '${governedArtefactPath}' has no proof coverage.`,
        governed_artefact_path: governedArtefactPath
      });
    }
  }

  for (const proofSurfaceId of proofSurfaces) {
    if (!usedProofSurfaceIds.has(proofSurfaceId)) {
      failures.push({
        code: "FREEZE_PROOF_SURFACE_UNUSED",
        message: `Proof surface '${proofSurfaceId}' is declared but unused.`,
        proof_surface_id: proofSurfaceId
      });
    }
  }

  return {
    ok: failures.length === 0,
    schema_version: "kolosseum.freeze.proof_coverage_report.v1",
    governed_artefact_count: governedArtefacts.length,
    proof_surface_count: proofSurfaces.size,
    binding_count: bindings.length,
    coverage: governedArtefacts.map((governed_artefact_path) => ({
      governed_artefact_path,
      proof_surface_ids: [...(coverage.get(governed_artefact_path) ?? [])].sort((a, b) => a.localeCompare(b, "en"))
    })),
    failures
  };
}

function main() {
  const surfaceManifestPath = process.argv[2] ?? "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json";
  const bindingsManifestPath = process.argv[3] ?? "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json";
  const outputPath = process.argv[4] ?? null;

  let report;
  try {
    report = verifyFreezeProofCoverage({
      repoRoot: process.cwd(),
      surfaceManifestPath,
      bindingsManifestPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_coverage_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_COVERAGE_FATAL",
        message: error?.message ?? String(error),
        details: error?.details ?? {}
      }
    };
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
  }

  process.stdout.write(json);
  process.exit(report.ok ? 0 : 1);
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main();
}