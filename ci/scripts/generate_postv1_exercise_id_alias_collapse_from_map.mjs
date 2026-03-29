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

const repoRoot = process.cwd();
const mapPath = path.resolve(repoRoot, "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json");
const outputPath = path.resolve(repoRoot, "docs/releases/V1_EXERCISE_ID_ALIAS_COLLAPSE.json");

const mapDoc = readJson(mapPath);
if (!mapDoc || typeof mapDoc !== "object" || Array.isArray(mapDoc)) {
  throw new Error("Exercise ID canonicalization map must be a JSON object.");
}
if (!Array.isArray(mapDoc.entries)) {
  throw new Error("Exercise ID canonicalization map must expose entries as an array.");
}

const groups = new Map();

for (const entry of mapDoc.entries) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Each canonicalization map entry must be an object.");
  }

  const currentExerciseId = String(entry.current_exercise_id ?? "").trim();
  const canonicalExerciseId = String(entry.canonical_exercise_id ?? "").trim();

  if (!currentExerciseId || !canonicalExerciseId) {
    throw new Error("Each canonicalization map entry must declare current_exercise_id and canonical_exercise_id.");
  }

  const key = canonicalExerciseId;
  const currentList = groups.get(key) || [];
  currentList.push(currentExerciseId);
  groups.set(key, currentList);
}

const collapseEntries = Array.from(groups.entries())
  .filter(([, currentExerciseIds]) => currentExerciseIds.length > 1)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([canonicalExerciseId, currentExerciseIds]) => {
    const orderedCurrentIds = [...currentExerciseIds].sort((a, b) => a.localeCompare(b));
    const primaryCurrentExerciseId = orderedCurrentIds[0];
    const aliasCurrentExerciseIds = orderedCurrentIds.slice(1);

    return {
      collapse_id: `collapse__${toToken(canonicalExerciseId)}`,
      canonical_exercise_id: canonicalExerciseId,
      primary_current_exercise_id: primaryCurrentExerciseId,
      alias_current_exercise_ids: aliasCurrentExerciseIds,
      collapse_strategy: "retire_aliases_to_primary"
    };
  });

const outputDoc = {
  exercise_id_alias_collapse_id: "v1_exercise_id_alias_collapse",
  source_map_path: "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json",
  collapse_strategy_enum: ["retire_aliases_to_primary"],
  entries: collapseEntries
};

writeJson(outputPath, outputDoc);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      output_path: normalizeRelativePath(path.relative(repoRoot, outputPath)),
      collapse_count: collapseEntries.length
    },
    null,
    2
  )}\n`
);