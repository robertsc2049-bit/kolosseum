/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/session_state_read_model.ts
import { sessionStateCache } from "./session_state_cache.js";

export type PlannedExercise = {
  exercise_id: string;
  source: "program";
};

export type PlannedSession = {
  exercises: PlannedExercise[];
  notes?: unknown[];
};

const SESSION_STATE_CACHE_TTL_MS = 2000;

export function readCachedSessionState(session_id: string) {
  return sessionStateCache.get(session_id);
}

export function writeCachedSessionState(session_id: string, payload: unknown): void {
  sessionStateCache.set(session_id, payload, SESSION_STATE_CACHE_TTL_MS);
}

export function invalidateSessionStateCache(session_id: string): void {
  sessionStateCache.del(session_id);
}

export async function loadSessionStateRow(client: any, session_id: string) {
  const r = await client.query(
    `SELECT session_id, planned_session, session_state_summary
     FROM sessions
     WHERE session_id = $1`,
    [session_id]
  );
  return (r.rowCount ?? 0) > 0 ? r.rows[0] : null;
}

export function uniqStable(ids: unknown): string[] {
  const arr = Array.isArray(ids) ? ids : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const s = typeof v === "string" ? v : String(v ?? "");
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function toPlannedExercisesFromIds(planned: PlannedSession, ids: string[]): PlannedExercise[] {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const byId = new Map<string, PlannedExercise>();

  for (const ex of exs) {
    if (ex && typeof ex.exercise_id === "string" && ex.exercise_id.length > 0) {
      byId.set(ex.exercise_id, ex);
    }
  }

  const out: PlannedExercise[] = [];
  for (const id of ids) {
    const ex = byId.get(id);
    if (ex) out.push(ex);
  }
  return out;
}

/**
 * Contract upgrade:
 * Legacy carrier (engine/internal): runtime.split_active (boolean) and/or trace.split_active (boolean)
 * New (persisted + API): runtime.return_decision_required (boolean)
 *                    runtime.return_decision_options  ("RETURN_CONTINUE" | "RETURN_SKIP")[]
 *
 * Hard rules:
 * - split_active must NEVER escape the API surface.
 * - BUT: do NOT delete runtime.split_active while the engine may still rely on it as the state carrier.
 *   Keep it as internal persisted state until the engine fully migrates.
 * - Server upgrades missing explicit fields here; API emits only explicit fields.
 */
export function ensureReturnDecisionContract(
  summary: any,
  deriveTraceFn: (summary: any) => any
): { summary: any; changed: boolean } {
  const rt: any = summary?.runtime;
  if (!rt || typeof rt !== "object") return { summary, changed: false };

  const hasRequired = typeof rt.return_decision_required === "boolean";
  const hasOptions = Array.isArray(rt.return_decision_options);

  let changed = false;

  // Prefer persisted legacy carrier; otherwise allow upgrade from derived legacy trace.
  const runtimeSplitActivePresent = typeof rt.split_active === "boolean";
  const runtimeSplitActive = runtimeSplitActivePresent ? rt.split_active : undefined;

  let derivedSplitActive: boolean | undefined = undefined;
  if (typeof runtimeSplitActive !== "boolean") {
    try {
      const t: any = deriveTraceFn(summary as any) as any;
      const coerceLegacyBool = (v: unknown): boolean | undefined => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") {
          if (v === 1) return true;
          if (v === 0) return false;
        }
        if (typeof v === "string") {
          if (v === "true") return true;
          if (v === "false") return false;
          if (v === "1") return true;
          if (v === "0") return false;
        }
        return undefined;
      };

      const rg = coerceLegacyBool(t?.return_gate_required);
      const sa = coerceLegacyBool(t?.split_active);
      if (typeof rg === "boolean") derivedSplitActive = rg;
      else if (typeof sa === "boolean") derivedSplitActive = sa;
    } catch {
      // deriveTrace should be stable, but never let upgrade crash the API.
      derivedSplitActive = undefined;
    }
  }

  const splitActive: boolean =
    typeof runtimeSplitActive === "boolean"
      ? runtimeSplitActive
      : (typeof derivedSplitActive === "boolean" ? derivedSplitActive : false);

  if (!hasRequired) {
    rt.return_decision_required = splitActive === true;
    changed = true;
  }

  if (!hasOptions) {
    rt.return_decision_options = rt.return_decision_required === true ? ["RETURN_CONTINUE", "RETURN_SKIP"] : [];
    changed = true;
  } else {
    rt.return_decision_options = (rt.return_decision_options as any[])
      .map((x) => String(x))
      .filter((x) => x === "RETURN_CONTINUE" || x === "RETURN_SKIP");
  }

  // IMPORTANT: do NOT delete rt.split_active here.
  return { summary, changed };
}

export function projectSessionStatePayload(
  session_id: string,
  planned: PlannedSession,
  summary: any,
  derivedTrace: any
) {
  const rt: any = summary?.runtime ?? {};

  const return_decision_required: boolean =
    typeof rt?.return_decision_required === "boolean" ? rt.return_decision_required : false;

  const return_decision_options: Array<"RETURN_CONTINUE" | "RETURN_SKIP"> =
    Array.isArray(rt?.return_decision_options)
      ? rt.return_decision_options
          .map((x: any) => String(x))
          .filter((x: string) => x === "RETURN_CONTINUE" || x === "RETURN_SKIP")
      : [];

  const {
    split_active: _legacySplitActive,
    remaining_at_split_ids: _legacyRemainingAtSplitIds,
    return_gate_required: _legacyReturnGateRequired,
    return_decision_required: _derivedReturnDecisionRequired,
    return_decision_options: _derivedReturnDecisionOptions,
    ...traceBase
  } = (derivedTrace && typeof derivedTrace === "object" ? derivedTrace : {}) as Record<string, any>;

  const trace: Record<string, any> = {
    ...traceBase,
    return_decision_required,
    return_decision_options
  };

  const remaining_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.remaining_ids));
  const completed_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.completed_ids));
  const dropped_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.dropped_ids));

  const current_step =
    return_decision_required === true
      ? { type: "RETURN_DECISION", options: return_decision_options }
      : (remaining_exercises.length > 0 ? { type: "EXERCISE", exercise: remaining_exercises[0] } : null);

  return {
    session_id,
    started: trace.started,
    current_step,
    remaining_exercises,
    completed_exercises,
    dropped_exercises,
    trace,
    event_log: []
  };
}