import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FAILURE = {
  EXERCISE_ID_CANONICALIZATION_SOURCE_UNPARSEABLE: "exercise_id_canonicalization_source_unparseable",
  EXERCISE_ID_CANONICALIZATION_INVALID_DECLARATION: "exercise_id_canonicalization_invalid_declaration",
  EXERCISE_ID_CANONICALIZATION_MISSING_EXERCISE: "exercise_id_canonicalization_missing_exercise",
  EXERCISE_ID_CANONICALIZATION_MISSING_MAPPING: "exercise_id_canonicalization_missing_mapping",
  EXERCISE_ID_CANONICALIZATION_DUPLICATE_SOURCE_ID: "exercise_id_canonicalization_duplicate_source_id",
  EXERCISE_ID_CANONICALIZATION_DUPLICATE_CANONICAL_ID: "exercise_id_canonicalization_duplicate_canonical_id",
  EXERCISE_ID_CANONICALIZATION_INVALID_CANONICAL_ID: "exercise_id_canonicalization_invalid_canonical_id",
  EXERCISE_ID_CANONICALIZATION_UNUSED_MAPPING: "exercise_id_canonicalization_unused_mapping"
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createFailure(token, filePath, details, sourceExerciseId = null, canonicalExerciseId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(sourceExerciseId ? { current_exercise_id: sourceExerciseId } : {}),
    ...(canonicalExerciseId ? { canonical_exercise_id: canonicalExerciseId } : {})
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw)
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const CANONICAL_ID_REGEX = /^ex_[a-z0-9]+(?:_[a-z0-9]+)+$/;

function loadDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Exercise ID canonicalization map must be a JSON object.");
  }

  if (!isNonEmptyString(declarationJson.exercise_id_canonicalization_map_id)) {
    throw new Error("exercise_id_canonicalization_map_id must be a non-empty string.");
  }

  if (!isNonEmptyString(declarationJson.source_registry_path)) {
    throw new Error("source_registry_path must be a non-empty string.");
  }

  if (!isNonEmptyString(declarationJson.canonical_pattern)) {
    throw new Error("canonical_pattern must be a non-empty string.");
  }

  if (!Array.isArray(declarationJson.entries)) {
    throw new Error("entries must be an array.");
  }

  const entries = declarationJson.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`entries[${index}] must be an object.`);
    }

    if (!isNonEmptyString(entry.current_exercise_id)) {
      throw new Error(`entries[${index}].current_exercise_id must be a non-empty string.`);
    }

    if (!isNonEmptyString(entry.canonical_exercise_id)) {
      throw new Error(`entries[${index}].canonical_exercise_id must be a non-empty string.`);
    }

    if (!isNonEmptyString(entry.status)) {
      throw new Error(`entries[${index}].status must be a non-empty string.`);
    }

    return {
      currentExerciseId: entry.current_exercise_id.trim(),
      canonicalExerciseId: entry.canonical_exercise_id.trim(),
      status: entry.status.trim()
    };
  });

  return {
    mapId: declarationJson.exercise_id_canonicalization_map_id.trim(),
    sourceRegistry: resolveRepoPath(repoRoot, declarationJson.source_registry_path.trim()),
    canonicalPattern: declarationJson.canonical_pattern.trim(),
    entries
  };
}

function loadExerciseRegistry(registryAbs, registryRel) {
  const registryJson = readJson(registryAbs);

  if (!registryJson || typeof registryJson !== "object" || Array.isArray(registryJson)) {
    throw new Error("Exercise registry must be a JSON object.");
  }

  if (!registryJson.entries || typeof registryJson.entries !== "object" || Array.isArray(registryJson.entries)) {
    throw new Error("Exercise registry must expose entries as an object map.");
  }

  return {
    repoRelative: registryRel,
    entries: registryJson.entries
  };
}

function verifyExerciseIdCanonicalizationMap({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_CANONICALIZATION_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  const failures = [];

  let exerciseRegistry;
  try {
    exerciseRegistry = loadExerciseRegistry(declaration.sourceRegistry.absolute, declaration.sourceRegistry.repoRelative);
  } catch (error) {
    failures.push(
      createFailure(
        FAILURE.EXERCISE_ID_CANONICALIZATION_SOURCE_UNPARSEABLE,
        declaration.sourceRegistry.repoRelative,
        error instanceof Error ? error.message : String(error)
      )
    );
  }

  const seenSourceIds = new Set();
  const seenCanonicalIds = new Set();
  const mappingBySourceId = new Map();
  const verifiedEntries = [];

  for (const entry of declaration.entries) {
    if (seenSourceIds.has(entry.currentExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICALIZATION_DUPLICATE_SOURCE_ID,
          declarationRepoRelative,
          `Duplicate current_exercise_id '${entry.currentExerciseId}' is not permitted.`,
          entry.currentExerciseId,
          entry.canonicalExerciseId
        )
      );
      continue;
    }
    seenSourceIds.add(entry.currentExerciseId);

    if (seenCanonicalIds.has(entry.canonicalExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICALIZATION_DUPLICATE_CANONICAL_ID,
          declarationRepoRelative,
          `Duplicate canonical_exercise_id '${entry.canonicalExerciseId}' is not permitted.`,
          entry.currentExerciseId,
          entry.canonicalExerciseId
        )
      );
      continue;
    }
    seenCanonicalIds.add(entry.canonicalExerciseId);

    if (!CANONICAL_ID_REGEX.test(entry.canonicalExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICALIZATION_INVALID_CANONICAL_ID,
          declarationRepoRelative,
          `canonical_exercise_id '${entry.canonicalExerciseId}' does not match required pattern ex_<equipment>_<movement>_<variant?>.`,
          entry.currentExerciseId,
          entry.canonicalExerciseId
        )
      );
    }

    mappingBySourceId.set(entry.currentExerciseId, entry);
    verifiedEntries.push({
      current_exercise_id: entry.currentExerciseId,
      canonical_exercise_id: entry.canonicalExerciseId,
      status: entry.status
    });
  }

  if (exerciseRegistry) {
    const liveExerciseIds = Object.keys(exerciseRegistry.entries).sort((a, b) => a.localeCompare(b));

    for (const liveExerciseId of liveExerciseIds) {
      if (!mappingBySourceId.has(liveExerciseId)) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_CANONICALIZATION_MISSING_MAPPING,
            declarationRepoRelative,
            `Exercise '${liveExerciseId}' is present in the registry but missing from the canonicalization map.`,
            liveExerciseId
          )
        );
      }
    }

    for (const mappedSourceId of mappingBySourceId.keys()) {
      if (!Object.prototype.hasOwnProperty.call(exerciseRegistry.entries, mappedSourceId)) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_CANONICALIZATION_UNUSED_MAPPING,
            declarationRepoRelative,
            `Mapping entry '${mappedSourceId}' does not exist in the live exercise registry.`,
            mappedSourceId
          )
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    exercise_id_canonicalization_map_id: declaration.mapId,
    source_registry_path: declaration.sourceRegistry.repoRelative,
    canonical_pattern: declaration.canonicalPattern,
    registry_count: exerciseRegistry ? Object.keys(exerciseRegistry.entries).length : 0,
    mapped_count: declaration.entries.length,
    verified_entries: verifiedEntries,
    failures
  };
}

const repoRoot = process.cwd();
const declarationPath = process.argv[2] || "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json";
const report = verifyExerciseIdCanonicalizationMap({ repoRoot, declarationPath });

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);