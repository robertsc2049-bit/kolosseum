import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FAILURE = {
  CANONICAL_COMPOUND_SOURCE_UNPARSEABLE: "canonical_compound_source_unparseable",
  CANONICAL_COMPOUND_INVALID_DECLARATION: "canonical_compound_invalid_declaration",
  CANONICAL_COMPOUND_REQUIRED_SURFACE_MISSING: "canonical_compound_required_surface_missing",
  CANONICAL_COMPOUND_DUPLICATE_LOCKED_ENTRY: "canonical_compound_duplicate_locked_entry",
  CANONICAL_COMPOUND_EXERCISE_MISSING: "canonical_compound_exercise_missing",
  CANONICAL_COMPOUND_PATTERN_MISMATCH: "canonical_compound_pattern_mismatch"
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

function createFailure(token, filePath, details, compoundKey = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(compoundKey ? { compound_key: compoundKey } : {})
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw)
  };
}

function compoundKey(movementClass, exerciseId) {
  return `${movementClass}::${exerciseId}`;
}

function validateLockedCompound(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`locked_compounds[${index}] must be an object.`);
  }

  if (typeof item.movement_class !== "string" || item.movement_class.trim().length === 0) {
    throw new Error(`locked_compounds[${index}].movement_class must be a non-empty string.`);
  }

  if (!Array.isArray(item.exercise_ids) || item.exercise_ids.length < 1) {
    throw new Error(`locked_compounds[${index}].exercise_ids must be a non-empty array.`);
  }

  const movementClass = item.movement_class.trim();
  const exerciseIds = item.exercise_ids.map((value, exerciseIndex) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`locked_compounds[${index}].exercise_ids[${exerciseIndex}] must be a non-empty string.`);
    }
    return value.trim();
  });

  return {
    movementClass,
    exerciseIds
  };
}

function loadDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Canonical compound set declaration must be a JSON object.");
  }

  if (
    typeof declarationJson.canonical_compound_set_id !== "string" ||
    declarationJson.canonical_compound_set_id.trim().length === 0
  ) {
    throw new Error("Canonical compound set declaration must declare a non-empty canonical_compound_set_id.");
  }

  if (!Array.isArray(declarationJson.required_surfaces)) {
    throw new Error("Canonical compound set declaration must contain a required_surfaces array.");
  }

  if (!Array.isArray(declarationJson.locked_compounds)) {
    throw new Error("Canonical compound set declaration must contain a locked_compounds array.");
  }

  return {
    canonicalCompoundSetId: declarationJson.canonical_compound_set_id.trim(),
    requiredSurfaces: declarationJson.required_surfaces.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_surfaces[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    lockedCompounds: declarationJson.locked_compounds.map((item, index) => validateLockedCompound(item, index))
  };
}

function loadExerciseRegistry(repoRoot) {
  const exerciseRegistryRel = "registries/exercise/exercise.registry.json";
  const exerciseRegistryAbs = path.resolve(repoRoot, exerciseRegistryRel);
  const exerciseRegistryJson = readJson(exerciseRegistryAbs);

  if (!exerciseRegistryJson || typeof exerciseRegistryJson !== "object" || Array.isArray(exerciseRegistryJson)) {
    throw new Error("Exercise registry must be a JSON object.");
  }

  if (!exerciseRegistryJson.entries || typeof exerciseRegistryJson.entries !== "object" || Array.isArray(exerciseRegistryJson.entries)) {
    throw new Error("Exercise registry must expose entries as an object map.");
  }

  return {
    repoRelative: exerciseRegistryRel,
    absolute: exerciseRegistryAbs,
    entries: exerciseRegistryJson.entries
  };
}

function verifyCanonicalCompoundSet({ repoRoot, declarationPath }) {
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
          FAILURE.CANONICAL_COMPOUND_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  const failures = [];

  const seenSurfacePaths = new Set();
  for (const surface of declaration.requiredSurfaces) {
    if (seenSurfacePaths.has(surface.repoRelative)) {
      failures.push(
        createFailure(
          FAILURE.CANONICAL_COMPOUND_INVALID_DECLARATION,
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
          FAILURE.CANONICAL_COMPOUND_REQUIRED_SURFACE_MISSING,
          surface.repoRelative,
          `Required canonical compound surface '${surface.repoRelative}' is missing.`
        )
      );
    }
  }

  let exerciseRegistry;
  try {
    exerciseRegistry = loadExerciseRegistry(repoRoot);
  } catch (error) {
    failures.push(
      createFailure(
        FAILURE.CANONICAL_COMPOUND_SOURCE_UNPARSEABLE,
        "registries/exercise/exercise.registry.json",
        error instanceof Error ? error.message : String(error)
      )
    );
  }

  const seenLockedEntries = new Set();
  const verifiedLockedCompounds = [];

  for (const item of declaration.lockedCompounds) {
    for (const exerciseId of item.exerciseIds) {
      const key = compoundKey(item.movementClass, exerciseId);

      if (seenLockedEntries.has(key)) {
        failures.push(
          createFailure(
            FAILURE.CANONICAL_COMPOUND_DUPLICATE_LOCKED_ENTRY,
            declarationRepoRelative,
            `Duplicate locked compound entry '${key}' is not permitted.`,
            key
          )
        );
        continue;
      }
      seenLockedEntries.add(key);

      verifiedLockedCompounds.push({
        movement_class: item.movementClass,
        exercise_id: exerciseId
      });

      if (!exerciseRegistry) continue;

      const entry = exerciseRegistry.entries[exerciseId];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        failures.push(
          createFailure(
            FAILURE.CANONICAL_COMPOUND_EXERCISE_MISSING,
            exerciseRegistry.repoRelative,
            `Locked compound '${exerciseId}' for movement_class '${item.movementClass}' is missing from exercise registry.`,
            key
          )
        );
        continue;
      }

      if (typeof entry.pattern !== "string" || entry.pattern.trim().length === 0) {
        failures.push(
          createFailure(
            FAILURE.CANONICAL_COMPOUND_PATTERN_MISMATCH,
            exerciseRegistry.repoRelative,
            `Locked compound '${exerciseId}' has missing/invalid pattern and cannot satisfy movement_class '${item.movementClass}'.`,
            key
          )
        );
        continue;
      }

      if (entry.pattern.trim() !== item.movementClass) {
        failures.push(
          createFailure(
            FAILURE.CANONICAL_COMPOUND_PATTERN_MISMATCH,
            exerciseRegistry.repoRelative,
            `Locked compound '${exerciseId}' pattern='${entry.pattern}' does not match required movement_class '${item.movementClass}'.`,
            key
          )
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    canonical_compound_set_id: declaration.canonicalCompoundSetId,
    verified_surfaces: declaration.requiredSurfaces.map((surface) => surface.repoRelative),
    verified_locked_compounds: verifiedLockedCompounds,
    failures
  };
}

const repoRoot = process.cwd();
const declarationPath = process.argv[2] || "docs/releases/V1_CANONICAL_COMPOUND_SET.json";
const report = verifyCanonicalCompoundSet({ repoRoot, declarationPath });

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);