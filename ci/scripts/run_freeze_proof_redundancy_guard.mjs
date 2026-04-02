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

function normalizeSortedUniqueStrings(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      fail(code, `${label} entries must be non-empty strings.`, { value });
    }
    if (seen.has(value)) {
      fail(code, `${label} contains duplicate entry '${value}'.`, { value });
    }
    seen.add(value);
    out.push(value);
  }
  out.sort((a, b) => a.localeCompare(b, "en"));
  return out;
}

function loadProofSurfaceIndex(repoRoot, proofIndexPath) {
  const abs = toAbs(repoRoot, proofIndexPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_INDEX_MISSING",
      `Proof index manifest '${proofIndexPath}' does not exist.`,
      { path: proofIndexPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_surface_index.v1") {
    fail(
      "FREEZE_PROOF_INDEX_SCHEMA_INVALID",
      "Proof index manifest schema_version must be kolosseum.freeze.proof_surface_index.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.proof_surfaces,
    "FREEZE_PROOF_INDEX_SURFACES_INVALID",
    "Proof index manifest proof_surfaces must be an array."
  );

  const proofSurfaces = new Map();

  for (const [index, item] of manifest.proof_surfaces.entries()) {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_INDEX_ENTRY_INVALID",
        `Proof surface entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.proof_surface_id !== "string" || item.proof_surface_id.length === 0) {
      fail(
        "FREEZE_PROOF_INDEX_SURFACE_ID_INVALID",
        `Proof surface entry at index ${index} must include a non-empty proof_surface_id.`,
        { index }
      );
    }

    if (proofSurfaces.has(item.proof_surface_id)) {
      fail(
        "FREEZE_PROOF_INDEX_SURFACE_ID_DUPLICATE",
        `Duplicate proof_surface_id '${item.proof_surface_id}'.`,
        { proof_surface_id: item.proof_surface_id }
      );
    }

    const assertedInvariantIds = normalizeSortedUniqueStrings(
      item.asserted_invariant_ids,
      "FREEZE_PROOF_INDEX_INVARIANTS_INVALID",
      `asserted_invariant_ids for proof surface '${item.proof_surface_id}'`
    );

    proofSurfaces.set(item.proof_surface_id, {
      proof_surface_id: item.proof_surface_id,
      asserted_invariant_ids: assertedInvariantIds
    });
  }

  return proofSurfaces;
}

function loadCoverageBindings(repoRoot, bindingsManifestPath) {
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
    manifest.surface_to_proof_bindings,
    "FREEZE_SURFACE_TO_PROOF_BINDINGS_INVALID",
    "Proof bindings manifest surface_to_proof_bindings must be an array."
  );

  const bindings = [];
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

    bindings.push({
      governed_artefact_path: item.governed_artefact_path,
      proof_surface_id: item.proof_surface_id
    });
  }

  return bindings;
}

function loadRedundancyExceptions(repoRoot, exceptionManifestPath) {
  const abs = toAbs(repoRoot, exceptionManifestPath);
  if (!fs.existsSync(abs)) {
    return [];
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_redundancy_exceptions.v1") {
    fail(
      "FREEZE_PROOF_REDUNDANCY_EXCEPTIONS_SCHEMA_INVALID",
      "Redundancy exceptions manifest schema_version must be kolosseum.freeze.proof_redundancy_exceptions.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.exceptions,
    "FREEZE_PROOF_REDUNDANCY_EXCEPTIONS_INVALID",
    "Redundancy exceptions manifest exceptions must be an array."
  );

  return manifest.exceptions.map((item, index) => {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_REDUNDANCY_EXCEPTION_ENTRY_INVALID",
        `Exception entry at index ${index} must be an object.`,
        { index }
      );
    }

    const proofSurfaceIds = normalizeSortedUniqueStrings(
      item.proof_surface_ids,
      "FREEZE_PROOF_REDUNDANCY_EXCEPTION_SURFACES_INVALID",
      `proof_surface_ids for exception at index ${index}`
    );

    if (proofSurfaceIds.length < 2) {
      fail(
        "FREEZE_PROOF_REDUNDANCY_EXCEPTION_TOO_SMALL",
        `Exception at index ${index} must reference at least two proof surfaces.`,
        { index }
      );
    }

    if (typeof item.invariant_id !== "string" || item.invariant_id.length === 0) {
      fail(
        "FREEZE_PROOF_REDUNDANCY_EXCEPTION_INVARIANT_INVALID",
        `Exception at index ${index} must include a non-empty invariant_id.`,
        { index }
      );
    }

    if (typeof item.reason !== "string" || item.reason.trim().length === 0) {
      fail(
        "FREEZE_PROOF_REDUNDANCY_EXCEPTION_REASON_MISSING",
        `Exception at index ${index} must include a non-empty reason.`,
        { index }
      );
    }

    return {
      proof_surface_ids: proofSurfaceIds,
      invariant_id: item.invariant_id,
      reason: item.reason.trim()
    };
  });
}

function buildScopeByProofSurface(bindings, proofSurfaceIds) {
  const scopeByProofSurface = new Map();
  for (const proofSurfaceId of proofSurfaceIds) {
    scopeByProofSurface.set(proofSurfaceId, []);
  }

  for (const binding of bindings) {
    if (!scopeByProofSurface.has(binding.proof_surface_id)) {
      continue;
    }
    scopeByProofSurface.get(binding.proof_surface_id).push(binding.governed_artefact_path);
  }

  for (const [proofSurfaceId, governedArtefacts] of scopeByProofSurface.entries()) {
    const unique = [...new Set(governedArtefacts)].sort((a, b) => a.localeCompare(b, "en"));
    scopeByProofSurface.set(proofSurfaceId, unique);
  }

  return scopeByProofSurface;
}

function makeExceptionKey(proofSurfaceIds, invariantId) {
  return `${proofSurfaceIds.join("||")}::${invariantId}`;
}

export function verifyFreezeProofRedundancy({
  repoRoot = process.cwd(),
  proofIndexPath = "docs/releases/V1_FREEZE_PROOF_SURFACE_INDEX.json",
  bindingsManifestPath = "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json",
  redundancyExceptionsPath = "docs/releases/V1_FREEZE_PROOF_REDUNDANCY_EXCEPTIONS.json"
} = {}) {
  const proofSurfaces = loadProofSurfaceIndex(repoRoot, proofIndexPath);
  const bindings = loadCoverageBindings(repoRoot, bindingsManifestPath);
  const exceptions = loadRedundancyExceptions(repoRoot, redundancyExceptionsPath);

  const proofSurfaceIds = [...proofSurfaces.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const scopeByProofSurface = buildScopeByProofSurface(bindings, proofSurfaceIds);
  const failures = [];
  const redundantPairs = [];

  for (const binding of bindings) {
    if (!proofSurfaces.has(binding.proof_surface_id)) {
      failures.push({
        code: "FREEZE_PROOF_REDUNDANCY_UNKNOWN_PROOF_SURFACE_IN_BINDINGS",
        message: `Bindings reference unknown proof surface '${binding.proof_surface_id}'.`,
        proof_surface_id: binding.proof_surface_id,
        governed_artefact_path: binding.governed_artefact_path
      });
    }
  }

  const exceptionMap = new Map();
  for (const exception of exceptions) {
    for (const proofSurfaceId of exception.proof_surface_ids) {
      if (!proofSurfaces.has(proofSurfaceId)) {
        failures.push({
          code: "FREEZE_PROOF_REDUNDANCY_EXCEPTION_UNKNOWN_PROOF_SURFACE",
          message: `Redundancy exception references unknown proof surface '${proofSurfaceId}'.`,
          proof_surface_id: proofSurfaceId,
          invariant_id: exception.invariant_id
        });
      }
    }

    const key = makeExceptionKey(exception.proof_surface_ids, exception.invariant_id);
    if (exceptionMap.has(key)) {
      failures.push({
        code: "FREEZE_PROOF_REDUNDANCY_EXCEPTION_DUPLICATE",
        message: `Duplicate redundancy exception '${key}'.`,
        invariant_id: exception.invariant_id,
        proof_surface_ids: exception.proof_surface_ids
      });
      continue;
    }

    exceptionMap.set(key, exception);
  }

  for (let i = 0; i < proofSurfaceIds.length; i += 1) {
    for (let j = i + 1; j < proofSurfaceIds.length; j += 1) {
      const aId = proofSurfaceIds[i];
      const bId = proofSurfaceIds[j];

      const a = proofSurfaces.get(aId);
      const b = proofSurfaces.get(bId);

      const aScope = scopeByProofSurface.get(aId) ?? [];
      const bScope = scopeByProofSurface.get(bId) ?? [];

      if (JSON.stringify(aScope) !== JSON.stringify(bScope)) {
        continue;
      }

      const aInvariants = new Set(a.asserted_invariant_ids);
      const sharedInvariants = b.asserted_invariant_ids.filter((item) => aInvariants.has(item));

      for (const invariantId of sharedInvariants) {
        const exceptionKey = makeExceptionKey([aId, bId], invariantId);
        const hasException = exceptionMap.has(exceptionKey);

        redundantPairs.push({
          invariant_id: invariantId,
          proof_surface_ids: [aId, bId],
          governed_scope: aScope,
          redundancy_exception_declared: hasException
        });

        if (!hasException) {
          failures.push({
            code: "FREEZE_PROOF_REDUNDANCY_UNSANCTIONED_DUPLICATE",
            message: `Proof surfaces '${aId}' and '${bId}' assert invariant '${invariantId}' over identical governed scope without an explicit redundancy exception.`,
            invariant_id: invariantId,
            proof_surface_ids: [aId, bId],
            governed_scope: aScope
          });
        }
      }
    }
  }

  for (const exception of exceptions) {
    const [aId, bId] = exception.proof_surface_ids;
    const a = proofSurfaces.get(aId);
    const b = proofSurfaces.get(bId);

    if (!a || !b) {
      continue;
    }

    const aScope = scopeByProofSurface.get(aId) ?? [];
    const bScope = scopeByProofSurface.get(bId) ?? [];

    if (JSON.stringify(aScope) !== JSON.stringify(bScope)) {
      failures.push({
        code: "FREEZE_PROOF_REDUNDANCY_EXCEPTION_NOT_REDUNDANT",
        message: `Redundancy exception for '${aId}' and '${bId}' is invalid because the governed scope differs.`,
        invariant_id: exception.invariant_id,
        proof_surface_ids: exception.proof_surface_ids
      });
      continue;
    }

    const aInvariants = new Set(a.asserted_invariant_ids);
    const bInvariants = new Set(b.asserted_invariant_ids);

    if (!aInvariants.has(exception.invariant_id) || !bInvariants.has(exception.invariant_id)) {
      failures.push({
        code: "FREEZE_PROOF_REDUNDANCY_EXCEPTION_NOT_REDUNDANT",
        message: `Redundancy exception for '${aId}' and '${bId}' is invalid because invariant '${exception.invariant_id}' is not shared by both proof surfaces.`,
        invariant_id: exception.invariant_id,
        proof_surface_ids: exception.proof_surface_ids
      });
    }
  }

  return {
    ok: failures.length === 0,
    schema_version: "kolosseum.freeze.proof_redundancy_report.v1",
    proof_surface_count: proofSurfaceIds.length,
    binding_count: bindings.length,
    redundancy_exception_count: exceptions.length,
    scope_by_proof_surface: proofSurfaceIds.map((proof_surface_id) => ({
      proof_surface_id,
      governed_scope: scopeByProofSurface.get(proof_surface_id) ?? []
    })),
    redundant_pairs: redundantPairs,
    failures
  };
}

function main() {
  const proofIndexPath = process.argv[2] ?? "docs/releases/V1_FREEZE_PROOF_SURFACE_INDEX.json";
  const bindingsManifestPath = process.argv[3] ?? "docs/releases/V1_FREEZE_SURFACE_TO_PROOF_BINDINGS.json";
  const redundancyExceptionsPath = process.argv[4] ?? "docs/releases/V1_FREEZE_PROOF_REDUNDANCY_EXCEPTIONS.json";
  const outputPath = process.argv[5] ?? null;

  let report;
  try {
    report = verifyFreezeProofRedundancy({
      repoRoot: process.cwd(),
      proofIndexPath,
      bindingsManifestPath,
      redundancyExceptionsPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_redundancy_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_REDUNDANCY_FATAL",
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