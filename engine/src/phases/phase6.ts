// engine/src/phases/phase6.ts
import type { ExerciseSignature } from "../substitution/types.js";

export type ExercisePriority = "required" | "core" | "accessory";

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";

  // Deterministic priority for runtime policy (e.g., RETURN_SKIP drops accessories only).
  // If omitted by legacy callers, runtime defaults to "core".
  priority?: ExercisePriority;

  // Runtime-only status (optional; default is "pending" when omitted)
  status?: "pending" | "completed" | "skipped";

  // Optional prescription fields
  block_id?: string;
  item_id?: string;
  sets?: number;
  reps?: number;
  intensity?:
    | { type: "percent_1rm"; value: number }
    | { type: "rpe"; value: number }
    | { type: "load"; value: number };
  rest_seconds?: number;

  // Substitution trace (ONLY if the substituted exercise is emitted)
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

type SubRule = { target: string; sub: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
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
 * Plan mode detection.
 * Contract (enforced):
 * - planned_items is the ONLY accepted non-empty plan source.
 * - planned_exercise_ids and exercises[] are legacy and MUST NOT be used for session emission.
 */
function planMode(program: any): "planned_items" | "planned_exercise_ids" | "exercises" | "empty" {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) return "planned_items";
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) return "planned_exercise_ids";
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) return "exercises";
  return "empty";
}

function extractSubRules(p5: Phase5Like): SubRule[] {
  if (!p5 || (p5 as any).ok !== true) return [];
  const adjustments = Array.isArray((p5 as any).adjustments) ? (p5 as any).adjustments : [];
  const rules: SubRule[] = [];

  for (const a of adjustments) {
    if (a?.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
    if (a?.applied !== true) continue;

    const target = String(a?.details?.target_exercise_id ?? "");
    const sub = String(a?.details?.substitute_exercise_id ?? "");
    if (!target || !sub) continue;
    if (target === sub) continue;

    rules.push({ target, sub });
  }

  return rules;
}

/**
 * Deterministic sequential substitution:
 * Applies rules in-order, allowing chaining (A->B then B->C => A->C).
 */
function applyRulesToId(originalId: string, rules: SubRule[]): { finalId: string; changed: boolean } {
  let cur = originalId;
  let changed = false;

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (cur === r.target) {
      cur = r.sub;
      changed = true;
    }
  }

  return { finalId: cur, changed };
}

function normalizePriority(x: unknown): ExercisePriority | undefined {
  if (x === "required" || x === "core" || x === "accessory") return x;
  return undefined;
}

/**
 * Deterministic v1 priority inference:
 * - If planned_item.priority is present and valid: use it.
 * - Else:
 *   - sets>=3 and reps<=6 => core
 *   - otherwise => accessory
 *
 * This is intentionally simple and deterministic. Registry-based semantics can upgrade later.
 */
function inferPriority(it: any): ExercisePriority {
  const p = normalizePriority(it?.priority);
  if (p) return p;

  const sets = typeof it?.sets === "number" ? it.sets : 0;
  const reps = typeof it?.reps === "number" ? it.reps : 0;

  if (sets >= 3 && reps > 0 && reps <= 6) return "core";
  return "accessory";
}

/**
 * Phase 6
 * Contract required by tests/goldens:
 * - If plan is empty: return deterministic empty shell with session_id=SESSION_STUB
 *   and notes exactly ["PHASE_6_STUB: deterministic empty session shell"].
 * - If plan is non-empty: session_id=SESSION_V1.
 * - Non-empty plans MUST use planned_items. Legacy sources are forbidden.
 *
 * CRITICAL RULE:
 * - Phase6 notes/trace MUST be a pure function of the EMITTED session.exercises[].
 *   If a substitution occurred but the substituted exercise was not emitted (e.g., dedup collision),
 *   Phase 6 MUST NOT claim substitutions.
 */
export function phase6ProduceSessionOutput(program: unknown, canonicalInput: unknown, p5?: Phase5Like): Phase6Result {
  const prog: any = program ?? {};
  const mode = planMode(prog);

  // Keep pool extraction for future validation even though it's not used today.
  void canonicalInput;
  void poolFromProgram(prog);

  // Empty plan -> constant stub contract
  if (mode === "empty") {
    return {
      ok: true,
      session: { session_id: "SESSION_STUB", status: "ready", exercises: [] },
      notes: ["PHASE_6_STUB: deterministic empty session shell"]
    };
  }

  // Hard gate: planned_items only
  if (mode !== "planned_items") {
    return {
      ok: false,
      failure_token: "phase6_requires_planned_items",
      details: { required: "planned_items", saw: mode }
    };
  }

  const rules = extractSubRules(p5);

  const session_id = "SESSION_V1";

  // Emit from planned_items, applying chained rules per item deterministically
  const items: any[] = Array.isArray(prog?.planned_items) ? prog.planned_items : [];
  const exercises: Phase6SessionExercise[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const it = items[i] ?? {};
    const originalId = String(it.exercise_id ?? "");
    if (!originalId) continue;

    const r = applyRulesToId(originalId, rules);
    const finalId = r.finalId;

    if (!finalId) continue;
    if (seen.has(finalId)) continue;
    seen.add(finalId);

    const ex: Phase6SessionExercise = {
      exercise_id: finalId,
      source: "program",
      priority: inferPriority(it),
      block_id: typeof it.block_id === "string" ? it.block_id : "B0",
      item_id: typeof it.item_id === "string" ? it.item_id : `B0_I${i}`,
      sets: typeof it.sets === "number" ? it.sets : 0,
      reps: typeof it.reps === "number" ? it.reps : 0,
      intensity: it.intensity,
      rest_seconds: typeof it.rest_seconds === "number" ? it.rest_seconds : undefined
    };

    // Trace only exists if the substituted exercise is actually emitted.
    if (finalId !== originalId) ex.substituted_from = originalId;

    exercises.push(ex);
  }

  // If nothing emitted, fall back to stub contract (deterministic)
  if (exercises.length === 0) {
    return {
      ok: true,
      session: { session_id: "SESSION_STUB", status: "ready", exercises: [] },
      notes: ["PHASE_6_STUB: deterministic empty session shell"]
    };
  }

  // Notes are STRICTLY a function of the emitted exercises array.
  const emittedHasSubstitution = exercises.some(
    (e) => typeof e.substituted_from === "string" && e.substituted_from.length > 0
  );

  return {
    ok: true,
    session: { session_id, status: "ready", exercises },
    notes: [
      emittedHasSubstitution
        ? "PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"
        : "PHASE_6: emitted session from planned_items (deduped)"
    ]
  };
}
