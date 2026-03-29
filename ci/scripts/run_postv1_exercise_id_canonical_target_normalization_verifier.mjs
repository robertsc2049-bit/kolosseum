import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FAILURE = {
  EXERCISE_ID_CANONICAL_TARGET_SOURCE_UNPARSEABLE: "exercise_id_canonical_target_source_unparseable",
  EXERCISE_ID_CANONICAL_TARGET_INVALID_DECLARATION: "exercise_id_canonical_target_invalid_declaration",
  EXERCISE_ID_CANONICAL_TARGET_MALFORMED: "exercise_id_canonical_target_malformed",
  EXERCISE_ID_CANONICAL_TARGET_DUPLICATED_EQUIPMENT_TERM: "exercise_id_canonical_target_duplicated_equipment_term",
  EXERCISE_ID_CANONICAL_TARGET_PLURAL_DRIFT: "exercise_id_canonical_target_plural_drift"
};

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

const CANONICAL_EQUIPMENT_ALLOWLIST = new Set([
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "bodyweight",
  "pullup_bar"
]);

const CANONICAL_EQUIPMENT_TOKENS = [
  "pullup_bar",
  "bodyweight",
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine"
];

const CANONICAL_ID_REGEX = /^ex_[a-z0-9]+(?:_[a-z0-9]+)+$/;

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createFailure(token, filePath, details, currentExerciseId = null, canonicalExerciseId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(currentExerciseId ? { current_exercise_id: currentExerciseId } : {}),
    ...(canonicalExerciseId ? { canonical_exercise_id: canonicalExerciseId } : {})
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
        tailStartIndex: 1 + equipmentParts.length,
        rawEquipmentToken: candidate
      };
    }
  }

  return {
    equipmentToken: canonicalizeEquipmentToken(parts[1] ?? ""),
    tailStartIndex: 2,
    rawEquipmentToken: parts[1] ?? ""
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

function verifyExerciseIdCanonicalTargetNormalization({ repoRoot, declarationPath }) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declarationJson;
  try {
    declarationJson = readJson(declarationAbs);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_INVALID_DECLARATION,
          declarationRepoRelative,
          "Exercise ID canonicalization map must be a JSON object."
        )
      ]
    };
  }

  if (!Array.isArray(declarationJson.entries)) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_INVALID_DECLARATION,
          declarationRepoRelative,
          "entries must be an array."
        )
      ]
    };
  }

  const failures = [];
  const convergence = new Map();
  const verifiedEntries = [];

  for (const [index, entry] of declarationJson.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_INVALID_DECLARATION,
          declarationRepoRelative,
          `entries[${index}] must be an object.`
        )
      );
      continue;
    }

    const currentExerciseId = isNonEmptyString(entry.current_exercise_id) ? entry.current_exercise_id.trim() : "";
    const canonicalExerciseId = isNonEmptyString(entry.canonical_exercise_id) ? entry.canonical_exercise_id.trim() : "";

    if (!currentExerciseId || !canonicalExerciseId) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_INVALID_DECLARATION,
          declarationRepoRelative,
          `entries[${index}] must declare non-empty current_exercise_id and canonical_exercise_id.`
        )
      );
      continue;
    }

    if (!CANONICAL_ID_REGEX.test(canonicalExerciseId)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_MALFORMED,
          declarationRepoRelative,
          `canonical_exercise_id '${canonicalExerciseId}' does not match ex_<equipment>_<movement>_<variant?>.`,
          currentExerciseId,
          canonicalExerciseId
        )
      );
      continue;
    }

    const parts = canonicalExerciseId.split("_").filter(Boolean);
    const { equipmentToken, tailStartIndex, rawEquipmentToken } = detectEquipmentPrefix(parts);

    if (!CANONICAL_EQUIPMENT_ALLOWLIST.has(equipmentToken) || rawEquipmentToken !== equipmentToken) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_PLURAL_DRIFT,
          declarationRepoRelative,
          `canonical_exercise_id '${canonicalExerciseId}' uses non-canonical equipment token '${rawEquipmentToken}'.`,
          currentExerciseId,
          canonicalExerciseId
        )
      );
    }

    const tailTokens = parts.slice(tailStartIndex).map((token) => canonicalizeEquipmentToken(token));
    if (tailTokens.includes(equipmentToken)) {
      failures.push(
        createFailure(
          FAILURE.EXERCISE_ID_CANONICAL_TARGET_DUPLICATED_EQUIPMENT_TERM,
          declarationRepoRelative,
          `canonical_exercise_id '${canonicalExerciseId}' repeats equipment token '${equipmentToken}' in the movement tail.`,
          currentExerciseId,
          canonicalExerciseId
        )
      );
    }

    const normalizedCanonicalExerciseId = normalizeCanonicalExerciseId(canonicalExerciseId);
    if (normalizedCanonicalExerciseId !== canonicalExerciseId) {
      if (rawEquipmentToken !== equipmentToken) {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_CANONICAL_TARGET_PLURAL_DRIFT,
            declarationRepoRelative,
            `canonical_exercise_id '${canonicalExerciseId}' normalizes to '${normalizedCanonicalExerciseId}' due to equipment token drift.`,
            currentExerciseId,
            canonicalExerciseId
          )
        );
      } else {
        failures.push(
          createFailure(
            FAILURE.EXERCISE_ID_CANONICAL_TARGET_DUPLICATED_EQUIPMENT_TERM,
            declarationRepoRelative,
            `canonical_exercise_id '${canonicalExerciseId}' normalizes to '${normalizedCanonicalExerciseId}' because duplicated equipment terms were found in the movement tail.`,
            currentExerciseId,
            canonicalExerciseId
          )
        );
      }
    }

    const existing = convergence.get(canonicalExerciseId) || [];
    existing.push(currentExerciseId);
    convergence.set(canonicalExerciseId, existing);

    verifiedEntries.push({
      current_exercise_id: currentExerciseId,
      canonical_exercise_id: canonicalExerciseId
    });
  }

  const collapseCandidates = Array.from(convergence.entries())
    .filter(([, currentExerciseIds]) => currentExerciseIds.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([canonicalExerciseId, currentExerciseIds]) => ({
      canonical_exercise_id: canonicalExerciseId,
      converged_current_exercise_ids: [...currentExerciseIds].sort((a, b) => a.localeCompare(b))
    }));

  return {
    ok: failures.length === 0,
    verified_count: verifiedEntries.length,
    verified_entries: verifiedEntries,
    collapse_candidate_count: collapseCandidates.length,
    collapse_candidates: collapseCandidates,
    failures
  };
}

const repoRoot = process.cwd();
const declarationPath = process.argv[2] || "docs/releases/V1_EXERCISE_ID_CANONICALIZATION_MAP.json";
const report = verifyExerciseIdCanonicalTargetNormalization({ repoRoot, declarationPath });

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);