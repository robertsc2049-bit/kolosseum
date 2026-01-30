// engine/src/phases/phase6.ts
import { createHash } from "node:crypto";
import type { ExerciseSignature } from "../substitution/types.js";

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";

  // Rich fields only when driven by planned_items
  block_id?: string;
  item_id?: string;
  sets?: number;
  reps?: number;
  intensity?:
    | { type: "percent_1rm"; value: number }
    | { type: "rpe"; value: number }
    | { type: "load"; value: number };
  rest_seconds?: number;

  // Substitution trace
  substituted_from?: string;
};

export type Phase6SessionOutput = {
  session_id: string;
  status: "ready";
  exercises: Phase6SessionExercise[];
};

export type Phase6Result =
  | { ok: true; session: Phase6SessionOutput; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

type Phase5Like =
  | { ok: true; adjustments: any[]; notes?: string[] }
  | { ok: false; failure_token: string; details?: unknown }
  | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const sort = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
    return out;
  };
  return JSON.stringify(sort(value), null, 2) + "\n";
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function sessionIdFromFingerprint(fingerprint: unknown): string {
  const h = sha256Hex(stableStringify(fingerprint)).slice(0, 12);
  return `S_${h}`;
}

// Not currently used for emission, but kept for future validation/lookup.
function poolFromProgram(program: any): Record<string, ExerciseSignature> {
  if (program?.exercise_pool && isRecord(program.exercise_pool)) {
    return program.exercise_pool as Record<string, ExerciseSignature>;
  }
  const pool: Record<string, ExerciseSignature> = {};
  for (const ex of program?.exercises ?? []) {
    if (ex && typeof ex.exercise_id === "string") {
      pool[ex.exercise_id] = ex as ExerciseSignature;
    }
  }
  return pool;
}

/**
 * Authoritative plan:
 * 1) planned_items (rich)
 * 2) planned_exercise_ids (legacy)
 * 3) exercises[] (legacy fallback)
 */
function planMode(program: any): "planned_items" | "planned_exercise_ids" | "exercises" | "empty" {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) return "planned_items";
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) return "planned_exercise_ids";
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) return "exercises";
  return "empty";
}

function plannedIdsFromProgram(program: any): string[] {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) {
    return program.planned_items.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
  }
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) {
    return program.planned_exercise_ids.map((x: any) => String(x)).filter(Boolean);
  }
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) {
    return program.exercises.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
  }
  return [];
}

function applySubstitutions(
  plannedIds: string[],
  p5: Phase5Like
): { ids: string[]; substitutedFrom: Map<string, string>; applied: boolean } {
  const substitutedFrom = new Map<string, string>();
  if (!p5 || (p5 as any).ok !== true) return { ids: plannedIds, substitutedFrom, applied: false };

  const adjustments = Array.isArray((p5 as any).adjustments) ? (p5 as any).adjustments : [];
  let ids = [...plannedIds];

  for (const a of adjustments) {
    if (a?.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
    if (a?.applied !== true) continue;

    const target = String(a?.details?.target_exercise_id ?? "");
    const sub = String(a?.details?.substitute_exercise_id ?? "");
    if (!target || !sub) continue;

    ids = ids.map((x) => {
      if (x !== target) return x;
      substitutedFrom.set(sub, target);
      return sub;
    });
  }

  return { ids, substitutedFrom, applied: true };
}

function dedupeStable(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Pull a constraints envelope from whatever you pass as "canonicalInput".
 * We support:
 * - canonicalInput.constraints
 * - canonicalInput.phase3.constraints
 * - canonicalInput.phase1.constraints
 * - canonicalInput.phase2.constraints
 */
function extractConstraintsEnvelope(canonicalInput: unknown): unknown {
  if (!isRecord(canonicalInput)) return undefined;

  if ("constraints" in canonicalInput) return (canonicalInput as any).constraints;

  for (const k of ["phase3", "phase2", "phase1"]) {
    const v = (canonicalInput as any)[k];
    if (isRecord(v) && "constraints" in v) return (v as any).constraints;
  }

  return undefined;
}

function summarizeConstraints(c: any): Record<string, any> {
  const goal_id = typeof c?.goal_id === "string" ? c.goal_id : undefined;
  const days = typeof c?.schedule?.days_per_week === "number" ? c.schedule.days_per_week : undefined;
  const timebox = typeof c?.schedule?.session_timebox_minutes === "number" ? c.schedule.session_timebox_minutes : undefined;

  const avail = Array.isArray(c?.available_equipment) ? c.available_equipment.map(String).filter(Boolean).sort() : undefined;
  const banned = Array.isArray(c?.banned_equipment) ? c.banned_equipment.map(String).filter(Boolean).sort() : undefined;

  const cv = typeof c?.preferences?.consistency_variety === "string" ? c.preferences.consistency_variety : undefined;
  const vol = typeof c?.preferences?.volume_cap === "string" ? c.preferences.volume_cap : undefined;

  const hasPain = typeof c?.pain_probe_state?.has_active_pain === "boolean" ? c.pain_probe_state.has_active_pain : undefined;
  const painSites = Array.isArray(c?.pain_probe_state?.active_pain_sites)
    ? c.pain_probe_state.active_pain_sites.map(String).filter(Boolean).sort()
    : undefined;
  const probeConsent = typeof c?.pain_probe_state?.probe_consent === "boolean" ? c.pain_probe_state.probe_consent : undefined;

  return {
    goal_id,
    schedule: { days_per_week: days, session_timebox_minutes: timebox },
    preferences: { consistency_variety: cv, volume_cap: vol },
    pain_probe_state: { has_active_pain: hasPain, active_pain_sites: painSites, probe_consent: probeConsent },
    available_equipment: avail,
    banned_equipment: banned
  };
}

/**
 * Phase 6 (gating-ready)
 * - Supports empty plan
 * - BUT: session_id + notes become deterministic functions of Phase1 constraint envelope and top-level knobs
 * - This makes goldens meaningful even while exercise emission is not yet implemented.
 */
export function phase6ProduceSessionOutput(program: unknown, canonicalInput: unknown, p5?: Phase5Like): Phase6Result {
  const prog: any = program ?? {};
  const mode = planMode(prog);

  void poolFromProgram(prog);

  const plannedIds = plannedIdsFromProgram(prog);
  const { ids: substitutedIds, substitutedFrom, applied } = applySubstitutions(plannedIds, p5);
  const finalIds = dedupeStable(substitutedIds);

  const constraintsEnv = extractConstraintsEnvelope(canonicalInput) as any;
  const constraintsSummary = summarizeConstraints(constraintsEnv);

  const canon: any = isRecord(canonicalInput) ? canonicalInput : {};
  const fingerprint = {
    engine_version: typeof canon.engine_version === "string" ? canon.engine_version : undefined,
    enum_bundle_version: typeof canon.enum_bundle_version === "string" ? canon.enum_bundle_version : undefined,
    phase1_schema_version: typeof canon.phase1_schema_version === "string" ? canon.phase1_schema_version : undefined,
    activity_id: typeof canon.activity_id === "string" ? canon.activity_id : undefined,
    nd_mode: typeof canon.nd_mode === "boolean" ? canon.nd_mode : undefined,
    instruction_density: typeof canon.instruction_density === "string" ? canon.instruction_density : undefined,
    exposure_prompt_density: typeof canon.exposure_prompt_density === "string" ? canon.exposure_prompt_density : undefined,
    bias_mode: typeof canon.bias_mode === "string" ? canon.bias_mode : undefined,
    constraints: constraintsSummary,
    plan_mode: mode,
    planned_ids: finalIds
  };

  const session_id = sessionIdFromFingerprint(fingerprint);

  // Empty plan: deterministic empty shell, BUT NOT CONSTANT.
  if (finalIds.length === 0) {
    const goal = constraintsSummary?.goal_id ?? "unset";
    const tb = constraintsSummary?.schedule?.session_timebox_minutes ?? "unset";
    const availN = Array.isArray(constraintsSummary?.available_equipment) ? constraintsSummary.available_equipment.length : 0;
    const bannedN = Array.isArray(constraintsSummary?.banned_equipment) ? constraintsSummary.banned_equipment.length : 0;

    return {
      ok: true,
      session: {
        session_id,
        status: "ready",
        exercises: []
      },
      notes: [
        "PHASE_6: empty plan (no exercises emitted yet)",
        `gate: goal=${goal} timebox=${tb} avail=${availN} banned=${bannedN} nd=${String(fingerprint.nd_mode)} bias=${String(fingerprint.bias_mode)}`,
        `gate: session_id=${session_id}`
      ]
    };
  }

  // Rich path: planned_items
  if (mode === "planned_items") {
    const items: any[] = Array.isArray(prog?.planned_items) ? prog.planned_items : [];

    const exercises: Phase6SessionExercise[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const it = items[i] ?? {};
      const originalId = String(it.exercise_id ?? "");
      if (!originalId) continue;

      let finalId = originalId;
      for (const [subId, targetId] of substitutedFrom.entries()) {
        if (targetId === originalId) {
          finalId = subId;
          break;
        }
      }

      if (seen.has(finalId)) continue;
      seen.add(finalId);

      const ex: Phase6SessionExercise = {
        exercise_id: finalId,
        source: "program",
        block_id: typeof it.block_id === "string" ? it.block_id : "B0",
        item_id: typeof it.item_id === "string" ? it.item_id : `B0_I${i}`,
        sets: typeof it.sets === "number" ? it.sets : 0,
        reps: typeof it.reps === "number" ? it.reps : 0,
        intensity: it.intensity,
        rest_seconds: typeof it.rest_seconds === "number" ? it.rest_seconds : undefined
      };

      if (finalId !== originalId) ex.substituted_from = originalId;
      exercises.push(ex);
    }

    return {
      ok: true,
      session: {
        session_id,
        status: "ready",
        exercises
      },
      notes: [
        applied
          ? "PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"
          : "PHASE_6: emitted session from planned_items (deduped)",
        `gate: session_id=${session_id}`
      ]
    };
  }

  // Legacy paths
  const exercises: Phase6SessionExercise[] = finalIds.map((id) => {
    const ex: Phase6SessionExercise = { exercise_id: id, source: "program" };
    const from = substitutedFrom.get(id);
    if (from) ex.substituted_from = from;
    return ex;
  });

  return {
    ok: true,
    session: {
      session_id,
      status: "ready",
      exercises
    },
    notes: [
      applied
        ? "PHASE_6: emitted session from legacy plan with Phase5 substitutions (deduped)"
        : "PHASE_6: emitted session from legacy plan (deduped)",
      `gate: session_id=${session_id}`
    ]
  };
}