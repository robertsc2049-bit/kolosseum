import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EQUIPMENT_SYNONYM_TO_CANONICAL = new Map([
  ["barbell", "barbell"],
  ["barbells", "barbell"],
  ["dumbbell", "dumbbell"],
  ["dumbbells", "dumbbell"],
  ["kettlebell", "kettlebell"],
  ["kettlebells", "kettlebell"],
  ["machine", "machine"],
  ["machines", "machine"],
  ["bodyweight", "bodyweight"],
  ["body_weight", "bodyweight"],
  ["pullup_bar", "pullup_bar"],
  ["pullup_bars", "pullup_bar"],
  ["pull_up_bar", "pullup_bar"],
  ["pull_up_bars", "pullup_bar"]
]);

const CANONICAL_EQUIPMENT_TOKENS = [
  "pullup_bar",
  "bodyweight",
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine"
];

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

function canonicalizeEquipmentToken(value) {
  const token = toToken(value);
  return EQUIPMENT_SYNONYM_TO_CANONICAL.get(token) || token;
}

function detectEquipmentPrefix(parts) {
  for (const equipmentToken of CANONICAL_EQUIPMENT_TOKENS) {
    const equipmentParts = equipmentToken.split("_");
    const candidate = parts.slice(1, 1 + equipmentParts.length).join("_");
    if (candidate === equipmentToken) {
      return {
        equipmentToken,
        tailStartIndex: 1 + equipmentParts.length
      };
    }
  }

  return {
    equipmentToken: canonicalizeEquipmentToken(parts[1] ?? ""),
    tailStartIndex: 2
  };
}

function normalizeCanonicalExerciseId(rawCanonicalExerciseId) {
  const token = toToken(rawCanonicalExerciseId);
  const parts = token.split("_").filter(Boolean);

  if (parts.length < 3 || parts[0] !== "ex") {
    return token;
  }

  const { equipmentToken, tailStartIndex } = detectEquipmentPrefix(parts);
  const tailTokens = parts
    .slice(tailStartIndex)
    .map((item) => canonicalizeEquipmentToken(item))
    .filter((item) => item !== equipmentToken);

  if (tailTokens.length === 0) {
    return `ex_${equipmentToken}`;
  }

  return `ex_${equipmentToken}_${tailTokens.join("_")}`;
}

const repoRoot = process.cwd();
const mapPath = path.resolve(repoRoot, "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json");
const document = readJson(mapPath);

if (!document || typeof document !== "object" || Array.isArray(document)) {
  throw new Error("Exercise ID canonicalization map must be a JSON object.");
}
if (!Array.isArray(document.entries)) {
  throw new Error("Exercise ID canonicalization map must expose entries as an array.");
}

const normalizedEntries = document.entries.map((entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Each canonicalization entry must be an object.");
  }

  const currentExerciseId = String(entry.current_exercise_id ?? "").trim();
  const canonicalExerciseId = String(entry.canonical_exercise_id ?? "").trim();
  const status = String(entry.status ?? "").trim();

  if (!currentExerciseId || !canonicalExerciseId || !status) {
    throw new Error("Each canonicalization entry must declare current_exercise_id, canonical_exercise_id, and status.");
  }

  return {
    current_exercise_id: currentExerciseId,
    canonical_exercise_id: normalizeCanonicalExerciseId(canonicalExerciseId),
    status
  };
});

const normalizedDocument = {
  ...document,
  normalized_by: "ci/scripts/normalize_postv1_exercise_id_canonical_targets.mjs",
  entries: normalizedEntries
};

delete normalizedDocument.manual_target_overrides;

writeJson(mapPath, normalizedDocument);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      output_path: normalizeRelativePath(path.relative(repoRoot, mapPath)),
      normalized_count: normalizedEntries.length
    },
    null,
    2
  )}\n`
);