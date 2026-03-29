import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FAILURE = {
  EXERCISE_ID_ALIAS_COLLAPSE_SOURCE_UNPARSEABLE: "exercise_id_alias_collapse_source_unparseable",
  EXERCISE_ID_ALIAS_COLLAPSE_INVALID_DECLARATION: "exercise_id_alias_collapse_invalid_declaration",
  EXERCISE_ID_ALIAS_COLLAPSE_MISSING_DECLARATION: "exercise_id_alias_collapse_missing_declaration",
  EXERCISE_ID_ALIAS_COLLAPSE_UNUSED_DECLARATION: "exercise_id_alias_collapse_unused_declaration",
  EXERCISE_ID_ALIAS_COLLAPSE_DUPLICATE_COLLAPSE_ID: "exercise_id_alias_collapse_duplicate_collapse_id",
  EXERCISE_ID_ALIAS_COLLAPSE_DUPLICATE_CANONICAL_TARGET: "exercise_id_alias_collapse_duplicate_canonical_target",
  EXERCISE_ID_ALIAS_COLLAPSE_INVALID_PRIMARY_REFERENCE: "exercise_id_alias_collapse_invalid_primary_reference",
  EXERCISE_ID_ALIAS_COLLAPSE_INVALID_ALIAS_REFERENCE: "exercise_id_alias_collapse_invalid_alias_reference",
  EXERCISE_ID_ALIAS_COLLAPSE_ALIAS_OVERLAP: "exercise_id_alias_collapse_alias_overlap",
  EXERCISE_ID_ALIAS_COLLAPSE_ALIAS_SET_MISMATCH: "exercise_id_alias_collapse_alias_set_mismatch"
};

const ALLOWED_STRATEGIES = new Set(["retire_aliases_to_primary"]);

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createFailure(token, filePath, details, canonicalExerciseId = null, collapseId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(canonicalExerciseId ? { canonical_exercise_id: canonicalExerciseId } : {}),
    ...(collapseId ? { collapse_id: collapseId } : {})
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStringArray(values, fieldName, index) {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} for entries[${index}] must be an array.`);
  }

  return values.map((value, valueIndex) => {
    if (!isNonEmptyString(value)) {
      throw new Error(`${fieldName}[${valueIndex}] for entries[${index}] must be a non-empty string.`);
    }
    return value.trim();
  });
}

function loadMap(repoRoot, mapPath) {
  const mapAbs = path.resolve(repoRoot, mapPath);
  const mapJson = readJson(mapAbs);

  if (!mapJson || typeof mapJson !== "object" || Array.isArray(mapJson)) {
    throw new Error("Exercise ID canonicalization map must be a JSON object.");
  }
  if (!Array.isArray(mapJson.entries)) {
    throw new Error("Exercise ID canonicalization map must expose entries as an array.");
  }

  const convergence = new Map();

  for (const [index, entry] of mapJson.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Canonicalization map entries[${index}] must be an object.`);
    }

    const currentExerciseId = isNonEmptyString(entry.current_exercise_id) ? entry.current_exercise_id.trim() : "";
    const canonicalExerciseId = isNonEmptyString(entry.canonical_exercise_id) ? entry.canonical_exercise_id.trim() : "";

    if (!currentExerciseId || !canonicalExerciseId) {
      throw new Error(`Canonicalization map entries[${index}] must declare non-empty current_exercise_id and canonical_exercise_id.`);
    }

    const currentList = convergence.get(canonicalExerciseId) || [];
    currentList.push(currentExerciseId);
    convergence.set(canonicalExerciseId, currentList);
  }

  const duplicatedConvergence = new Map();
  for (const [canonicalExerciseId, currentExerciseIds] of convergence.entries()) {
    if (currentExerciseIds.length > 1) {
      duplicatedConvergence.set(
        canonicalExerciseId,
        [...currentExerciseIds].sort((a, b) => a.localeCompare(b))
      );
    }
  }

  return {
    duplicatedConvergence,
    repoRelative: normalizeRelativePath(path.relative(repoRoot, mapAbs))
  };
}

function loadCollapseDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Exercise ID alias collapse declaration must be a JSON object.");
  }

  if (!isNonEmptyString(declarationJson.exercise_id_alias_collapse_id)) {
    throw new Error("exercise_id_alias_collapse_id must be a non-empty string.");
  }

  if (!isNonEmptyString(declarationJson.source_map_path)) {
    throw new Error("source_map_path must be a non-empty string.");
  }

  if (!Array.isArray(declarationJson.entries)) {
    throw new Error("entries must be an array.");
  }

  const entries = declarationJson.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`entries[${index}] must be an object.`);
    }

    if (!isNonEmptyString(entry.collapse_id)) {
      throw new Error(`entries[${index}].collapse_id must be a non-empty string.`);
    }

    if (!isNonEmptyString(entry.canonical_exercise_id)) {
      throw new Error(`entries[${index}].canonical_exercise_id must be a non-empty string.`);
    }

    if (!isNonEmptyString(entry.primary_current_exercise_id)) {
      throw new Error(`entries[${index}].primary_current_exercise_id must be a non-empty string.`);
    }

    const aliasCurrentExerciseIds = normalizeStringArray(entry.alias_current_exercise_ids, "alias_current_exercise_ids", index);

    if (!isNonEmptyString(entry.collapse_strategy) || !ALLOWED_STRATEGIES.has(entry.collapse_strategy.trim())) {
      throw new Error(`entries[${index}].collapse_strategy must be one of: retire_aliases_to_primary.`);
    }

    return {
      collapseId: entry.collapse_id.trim(),
      canonicalExerciseId: entry.canonical_exercise_id.trim(),
      primaryCurrentExerciseId: entry.primary_current_exercise_id.trim(),
      aliasCurrentExerciseIds,
      collapseStrategy: entry.collapse_strategy.trim()
    };
  });

  return {
    collapseId: declarationJson.exercise_id_alias_collapse_id.trim(),
    sourceMapPath: declarationJson.source_map_path.trim(),
    entries
  };
}

function verifyExerciseIdAliasCollapse({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadCollapseDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  let map;
  try {
    map = loadMap(repoRoot, declaration.sourceMapPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_SOURCE_UNPARSEABLE,
          declaration.sourceMapPath,
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  const failures = [];
  const seenCollapseIds = new Set();
  const seenCanonicalTargets = new Set();
  const declaredByCanonicalTarget = new Map();
  const aliasSeenGlobally = new Set();
  const verifiedEntries = [];

  for (const entry of declaration.entries) {
    if (seenCollapseIds.has(entry.collapseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_DUPLICATE_COLLAPSE_ID,
          declarationRepoRelative,
          `Duplicate collapse_id '${entry.collapseId}' is not permitted.`,
          entry.canonicalExerciseId,
          entry.collapseId
        )
      );
      continue;
    }
    seenCollapseIds.add(entry.collapseId);

    if (seenCanonicalTargets.has(entry.canonicalExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_DUPLICATE_CANONICAL_TARGET,
          declarationRepoRelative,
          `Duplicate canonical target '${entry.canonicalExerciseId}' is not permitted in alias collapse declaration.`,
          entry.canonicalExerciseId,
          entry.collapseId
        )
      );
      continue;
    }
    seenCanonicalTargets.add(entry.canonicalExerciseId);

    const convergedSourceIds = map.duplicatedConvergence.get(entry.canonicalExerciseId);
    if (!convergedSourceIds) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_UNUSED_DECLARATION,
          declarationRepoRelative,
          `Canonical target '${entry.canonicalExerciseId}' does not require alias collapse declaration from the current map.`,
          entry.canonicalExerciseId,
          entry.collapseId
        )
      );
      continue;
    }

    if (!convergedSourceIds.includes(entry.primaryCurrentExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_INVALID_PRIMARY_REFERENCE,
          declarationRepoRelative,
          `Primary current exercise ID '${entry.primaryCurrentExerciseId}' is not part of the converged source set for '${entry.canonicalExerciseId}'.`,
          entry.canonicalExerciseId,
          entry.collapseId
        )
      );
    }

    for (const aliasCurrentExerciseId of entry.aliasCurrentExerciseIds) {
      if (aliasCurrentExerciseId === entry.primaryCurrentExerciseId) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_INVALID_ALIAS_REFERENCE,
            declarationRepoRelative,
            `Alias current exercise ID '${aliasCurrentExerciseId}' must not equal the primary current exercise ID.`,
            entry.canonicalExerciseId,
            entry.collapseId
          )
        );
      }

      if (!convergedSourceIds.includes(aliasCurrentExerciseId)) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_INVALID_ALIAS_REFERENCE,
            declarationRepoRelative,
            `Alias current exercise ID '${aliasCurrentExerciseId}' is not part of the converged source set for '${entry.canonicalExerciseId}'.`,
            entry.canonicalExerciseId,
            entry.collapseId
          )
        );
      }

      if (aliasSeenGlobally.has(aliasCurrentExerciseId)) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_ALIAS_OVERLAP,
            declarationRepoRelative,
            `Alias current exercise ID '${aliasCurrentExerciseId}' is declared in more than one collapse entry.`,
            entry.canonicalExerciseId,
            entry.collapseId
          )
        );
      }
      aliasSeenGlobally.add(aliasCurrentExerciseId);
    }

    const expectedAliasSet = convergedSourceIds.filter((value) => value !== entry.primaryCurrentExerciseId).sort((a, b) => a.localeCompare(b));
    const actualAliasSet = [...entry.aliasCurrentExerciseIds].sort((a, b) => a.localeCompare(b));

    if (
      expectedAliasSet.length !== actualAliasSet.length ||
      expectedAliasSet.some((value, index) => value !== actualAliasSet[index])
    ) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_ALIAS_SET_MISMATCH,
          declarationRepoRelative,
          `Alias declaration for '${entry.canonicalExerciseId}' does not exactly match the converged legacy source set. Expected aliases: ${JSON.stringify(expectedAliasSet)}.`,
          entry.canonicalExerciseId,
          entry.collapseId
        )
      );
    }

    declaredByCanonicalTarget.set(entry.canonicalExerciseId, entry);
    verifiedEntries.push({
      collapse_id: entry.collapseId,
      canonical_exercise_id: entry.canonicalExerciseId,
      primary_current_exercise_id: entry.primaryCurrentExerciseId,
      alias_current_exercise_ids: entry.aliasCurrentExerciseIds,
      collapse_strategy: entry.collapseStrategy
    });
  }

  for (const canonicalExerciseId of map.duplicatedConvergence.keys()) {
    if (!declaredByCanonicalTarget.has(canonicalExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_ALIAS_COLLAPSE_MISSING_DECLARATION,
          declarationRepoRelative,
          `Canonical target '${canonicalExerciseId}' has multiple converged legacy source IDs and requires explicit alias collapse declaration.`,
          canonicalExerciseId
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    source_map_path: declaration.sourceMapPath,
    collapse_count: declaration.entries.length,
    required_collapse_count: map.duplicatedConvergence.size,
    verified_entries: verifiedEntries,
    failures
  };
}

const repoRoot = process.cwd();
const declarationPath = process.argv[2] || "docs/releases/V1_EXERCISE_ID_ALIAS_COLLAPSE.json";
const report = verifyExerciseIdAliasCollapse({ repoRoot, declarationPath });

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);