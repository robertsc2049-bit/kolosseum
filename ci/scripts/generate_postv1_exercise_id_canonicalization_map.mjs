import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toToken(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function pickPrimaryEquipment(entry) {
  if (Array.isArray(entry?.equipment)) {
    const first = entry.equipment.find((item) => typeof item === "string" && item.trim().length > 0);
    if (first) return toToken(first);
  }

  return "bodyweight";
}

function deriveCanonicalExerciseId(currentExerciseId, entry) {
  const normalizedCurrent = toToken(currentExerciseId);
  if (normalizedCurrent.startsWith("ex_")) {
    return normalizedCurrent;
  }

  const equipment = pickPrimaryEquipment(entry);
  return `ex_${equipment}_${normalizedCurrent}`;
}

const repoRoot = process.cwd();
const registryPath = path.resolve(repoRoot, "registries/exercise/exercise.registry.json");
const outputPath = path.resolve(repoRoot, "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json");

const registry = readJson(registryPath);
if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
  throw new Error("Exercise registry must be a JSON object.");
}
if (!registry.entries || typeof registry.entries !== "object" || Array.isArray(registry.entries)) {
  throw new Error("Exercise registry must expose entries as an object map.");
}

const exerciseIds = Object.keys(registry.entries).sort((a, b) => a.localeCompare(b));

const entries = exerciseIds.map((currentExerciseId) => {
  const entry = registry.entries[currentExerciseId];
  const canonicalExerciseId = deriveCanonicalExerciseId(currentExerciseId, entry);

  return {
    current_exercise_id: currentExerciseId,
    canonical_exercise_id: canonicalExerciseId,
    status: currentExerciseId === canonicalExerciseId ? "already_canonical" : "pending_migration"
  };
});

const document = {
  exercise_id_canonicalization_map_id: "v1_exercise_id_canonicalization_map",
  source_registry_path: "registries/exercise/exercise.registry.json",
  canonical_pattern: "ex_<equipment>_<movement>_<variant?>",
  generated_by: "ci/scripts/generate_postv1_exercise_id_canonicalization_map.mjs",
  entries
};

writeJson(outputPath, document);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      output_path: normalizeRelativePath(path.relative(repoRoot, outputPath)),
      mapped_count: entries.length
    },
    null,
    2
  )}\n`
);