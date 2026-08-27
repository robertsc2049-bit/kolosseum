
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import fs from "node:fs";
import type { ExerciseSignature } from "../substitution/types.js";

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function canonicalStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v) || !v.every((item) => typeof item === "string")) return undefined;
  return [...v];
}

function projectCanonicalExerciseSignature(value: unknown, fallbackId?: string): ExerciseSignature | null {
  if (!isRecord(value)) return null;

  const exerciseId = typeof value.exercise_id === "string" && value.exercise_id.trim()
    ? value.exercise_id.trim()
    : String(fallbackId ?? "").trim();
  if (!exerciseId) return null;

  const movementPatternId = typeof value.movement_pattern_id === "string" && value.movement_pattern_id.trim()
    ? value.movement_pattern_id.trim()
    : undefined;
  const stimulusIntent = typeof value.stimulus_intent === "string" && value.stimulus_intent.trim()
    ? value.stimulus_intent.trim()
    : undefined;
  const equipmentRequirements = canonicalStringArray(value.equipment_requirements);
  const jointStressTags = canonicalStringArray(value.joint_stress_tags);

  // Registry vocabulary remains canonical. Phase 4/5 consumes an internal
  // ExerciseSignature projection, so translate once at the loader boundary
  // rather than reintroducing legacy registry fields or dual-reading them.
  return {
    ...value,
    exercise_id: exerciseId,
    ...(movementPatternId ? { pattern: movementPatternId } : {}),
    ...(stimulusIntent ? { stimulus: stimulusIntent } : {}),
    ...(equipmentRequirements ? { equipment_ids: equipmentRequirements } : {}),
    ...(jointStressTags ? { joint_stress_tags: jointStressTags } : {})
  } as ExerciseSignature;
}

/**
 * DEV NOTE: Exercise registry entry loader boundary.
 * Purpose: convert the exercise registry file into the id-keyed shape consumed by
 * Phase 4 and substitution scoring.
 * Boundary: this loader reads registry data only; it does not create exercises,
 * alter constraints, or read UI/copy/payment/coach-note surfaces.
 * Determinism: accepted legacy shapes are converted by explicit ids and preserve
 * the registry-provided exercise records.
 * Failure: unsupported shapes return an empty map so Phase 4 registry guards emit
 * the stable missing-id failure path.
 */
export function loadExerciseEntriesFromPath(p: string): Record<string, ExerciseSignature> {
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  const parsed = JSON.parse(raw);

  // Preferred shape: { entries: { id: ExerciseSignature } }
  if (isRecord(parsed) && isRecord((parsed as any).entries)) {
    const out: Record<string, ExerciseSignature> = {};
    for (const [k, v] of Object.entries((parsed as any).entries)) {
      const projected = projectCanonicalExerciseSignature(v, k);
      if (projected) out[k] = projected;
    }
    return out;
  }

  // Legacy accepted shape: { exercises: ExerciseSignature[] }
  if (isRecord(parsed) && Array.isArray((parsed as any).exercises)) {
    const out: Record<string, ExerciseSignature> = {};
    for (const ex of (parsed as any).exercises) {
      const id = String(ex?.exercise_id ?? "").trim();
      if (id) out[id] = ex as ExerciseSignature;
    }
    return out;
  }

  // Legacy accepted shape: ExerciseSignature[]
  if (Array.isArray(parsed)) {
    const out: Record<string, ExerciseSignature> = {};
    for (const ex of parsed) {
      const id = String((ex as any)?.exercise_id ?? "").trim();
      if (id) out[id] = ex as ExerciseSignature;
    }
    return out;
  }

  return {};
}

export default loadExerciseEntriesFromPath;
