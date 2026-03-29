import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  POPULATION_SOURCE_UNPARSEABLE: "population_source_unparseable",
  POPULATION_INVALID_DECLARATION: "population_invalid_declaration",
  POPULATION_REQUIRED_SURFACE_MISSING: "population_required_surface_missing",
  POPULATION_DUPLICATE_REQUIRED_ENTRY: "population_duplicate_required_entry",
  POPULATION_DUPLICATE_DECLARED_ENTRY: "population_duplicate_declared_entry",
  POPULATION_MISSING_LANE: "population_missing_lane",
  POPULATION_BELOW_MINIMUM: "population_below_minimum",
  POPULATION_INVALID_EXERCISE_ID: "population_invalid_exercise_id"
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

function createFailure(token, filePath, details, populationKey = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(populationKey ? { population_key: populationKey } : {})
  };
}

function resolveRepoPath(repoRoot, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");
  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw)
  };
}

function laneKey(item) {
  return `${item.movementClass}::${item.movementPattern}`;
}

function validateRequiredEntry(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`mvp_required_population[${index}] must be an object.`);
  }

  if (typeof item.movement_class !== "string" || item.movement_class.trim().length === 0) {
    throw new Error(`mvp_required_population[${index}].movement_class must be a non-empty string.`);
  }

  if (typeof item.movement_pattern !== "string" || item.movement_pattern.trim().length === 0) {
    throw new Error(`mvp_required_population[${index}].movement_pattern must be a non-empty string.`);
  }

  if (!Number.isInteger(item.minimum_exercise_count) || item.minimum_exercise_count < 1) {
    throw new Error(`mvp_required_population[${index}].minimum_exercise_count must be an integer >= 1.`);
  }

  return {
    movementClass: item.movement_class.trim(),
    movementPattern: item.movement_pattern.trim(),
    minimumExerciseCount: item.minimum_exercise_count
  };
}

function validateDeclaredEntry(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`declared_population[${index}] must be an object.`);
  }

  if (typeof item.movement_class !== "string" || item.movement_class.trim().length === 0) {
    throw new Error(`declared_population[${index}].movement_class must be a non-empty string.`);
  }

  if (typeof item.movement_pattern !== "string" || item.movement_pattern.trim().length === 0) {
    throw new Error(`declared_population[${index}].movement_pattern must be a non-empty string.`);
  }

  if (!Array.isArray(item.exercise_ids)) {
    throw new Error(`declared_population[${index}].exercise_ids must be an array.`);
  }

  return {
    movementClass: item.movement_class.trim(),
    movementPattern: item.movement_pattern.trim(),
    exerciseIds: item.exercise_ids.map((value, exerciseIndex) => {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`declared_population[${index}].exercise_ids[${exerciseIndex}] must be a non-empty string.`);
      }
      return value.trim();
    })
  };
}

function loadPopulationDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Exercise registry population declaration must be a JSON object.");
  }

  if (typeof declarationJson.population_map_id !== "string" || declarationJson.population_map_id.trim().length === 0) {
    throw new Error("Exercise registry population declaration must declare a non-empty population_map_id.");
  }

  if (!Array.isArray(declarationJson.required_surfaces)) {
    throw new Error("Exercise registry population declaration must contain a required_surfaces array.");
  }

  if (!Array.isArray(declarationJson.mvp_required_population)) {
    throw new Error("Exercise registry population declaration must contain an mvp_required_population array.");
  }

  if (!Array.isArray(declarationJson.declared_population)) {
    throw new Error("Exercise registry population declaration must contain a declared_population array.");
  }

  return {
    populationMapId: declarationJson.population_map_id.trim(),
    requiredSurfaces: declarationJson.required_surfaces.map((item, index) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new Error(`required_surfaces[${index}] must be a non-empty string.`);
      }
      return resolveRepoPath(repoRoot, item.trim());
    }),
    requiredPopulation: declarationJson.mvp_required_population.map((item, index) => validateRequiredEntry(item, index)),
    declaredPopulation: declarationJson.declared_population.map((item, index) => validateDeclaredEntry(item, index))
  };
}

function verifyPopulationGate({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadPopulationDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.POPULATION_SOURCE_UNPARSEABLE,
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
          FAILURE.POPULATION_INVALID_DECLARATION,
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
          FAILURE.POPULATION_REQUIRED_SURFACE_MISSING,
          surface.repoRelative,
          `Required exercise registry population surface '${surface.repoRelative}' is missing.`
        )
      );
    }
  }

  const requiredMap = new Map();
  for (const item of declaration.requiredPopulation) {
    const key = laneKey(item);
    if (requiredMap.has(key)) {
      failures.push(
        createFailure(
          FAILURE.POPULATION_DUPLICATE_REQUIRED_ENTRY,
          declarationRepoRelative,
          `Duplicate required MVP population entry '${key}' is not permitted.`,
          key
        )
      );
      continue;
    }
    requiredMap.set(key, item);
  }

  const declaredMap = new Map();
  for (const item of declaration.declaredPopulation) {
    const key = laneKey(item);
    if (declaredMap.has(key)) {
      failures.push(
        createFailure(
          FAILURE.POPULATION_DUPLICATE_DECLARED_ENTRY,
          declarationRepoRelative,
          `Duplicate declared MVP population entry '${key}' is not permitted.`,
          key
        )
      );
      continue;
    }
    declaredMap.set(key, item);

    for (const exerciseId of item.exerciseIds) {
      if (!/^ex_[a-z0-9_]+$/.test(exerciseId)) {
        failures.push(
          createFailure(
            FAILURE.POPULATION_INVALID_EXERCISE_ID,
            declarationRepoRelative,
            `Declared exercise id '${exerciseId}' is not in canonical exercise id form.`,
            key
          )
        );
      }
    }
  }

  for (const [key, required] of requiredMap.entries()) {
    if (!declaredMap.has(key)) {
      failures.push(
        createFailure(
          FAILURE.POPULATION_MISSING_LANE,
          declarationRepoRelative,
          `Required MVP population lane '${key}' is missing from declared_population.`,
          key
        )
      );
      continue;
    }

    const declared = declaredMap.get(key);
    if (declared.exerciseIds.length < required.minimumExerciseCount) {
      failures.push(
        createFailure(
          FAILURE.POPULATION_BELOW_MINIMUM,
          declarationRepoRelative,
          `Declared MVP population lane '${key}' has ${declared.exerciseIds.length} exercise ids but requires at least ${required.minimumExerciseCount}.`,
          key
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    population_map_id: declaration.populationMapId,
    verified_surfaces: declaration.requiredSurfaces.map((item) => item.repoRelative),
    verified_population_lanes: declaration.requiredPopulation.map((item) => ({
      movement_class: item.movementClass,
      movement_pattern: item.movementPattern,
      minimum_exercise_count: item.minimumExerciseCount
    })),
    failures
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_EXERCISE_REGISTRY_POPULATION_MAP.json";
  const report = verifyPopulationGate({ repoRoot, declarationPath });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

main();