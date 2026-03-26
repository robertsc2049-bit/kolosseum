/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/session_state_read_model.ts
import { sessionStateCache } from "./session_state_cache.js";

export type PlannedExercise = {
  exercise_id: string;
  source: "program";
  [k: string]: unknown;
};

export type PlannedSession = {
  exercises: PlannedExercise[];
  notes?: unknown[];
  [k: string]: unknown;
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

export function ensureReturnDecisionContract(
  summary: any,
  deriveTraceFn: (summary: any) => any
): { summary: any; changed: boolean } {
  const rt: any = summary?.runtime;
  if (!rt || typeof rt !== "object") return { summary, changed: false };

  const hasRequired = typeof rt.return_decision_required === "boolean";
  const hasOptions = Array.isArray(rt.return_decision_options);

  let changed = false;

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

  return { summary, changed };
}

function readSplitReturnDecision(
  summary: any,
  trace?: Record<string, any>
): "continue" | "skip" | null {
  const runtime = summary?.runtime ?? {};
  const raw =
    runtime?.split_return_decision ??
    runtime?.return_decision ??
    summary?.split_return_decision ??
    summary?.return_decision ??
    null;

  if (!(raw === null || typeof raw === "undefined")) {
    const s = String(raw).trim().toLowerCase();
    if (s.includes("continue")) return "continue";
    if (s.includes("skip")) return "skip";
  }

  const splitEntered =
    runtime?.split_entered === true ||
    summary?.split_entered === true ||
    (Array.isArray(runtime?.remaining_at_split_ids) && runtime.remaining_at_split_ids.length > 0) ||
    typeof runtime?.split_active === "boolean";

  if (!splitEntered) return null;

  const droppedIds = uniqStable(trace?.dropped_ids ?? runtime?.dropped_ids);
  const completedIds = uniqStable(trace?.completed_ids ?? runtime?.completed_ids);
  const returnDecisionRequired =
    typeof runtime?.return_decision_required === "boolean"
      ? runtime.return_decision_required
      : false;

  if (returnDecisionRequired === true) return null;
  if (droppedIds.length > 0) return "skip";
  if (completedIds.length > 0) return "continue";

  return null;
}

function readSplitEntered(summary: any): boolean {
  const runtime = summary?.runtime ?? {};
  if (runtime?.split_entered === true) return true;
  if (readSplitReturnDecision(summary) !== null) return true;
  if (typeof runtime?.split_active === "boolean") return true;
  if (Array.isArray(runtime?.remaining_at_split_ids) && runtime.remaining_at_split_ids.length > 0) return true;
  if (summary?.split_entered === true) return true;
  return false;
}

function deriveExecutionStatus(
  remainingIds: string[],
  completedIds: string[],
  droppedIds: string[],
  started: boolean
): "ready" | "in_progress" | "completed" | "partial" {
  const doneCount = completedIds.length;
  const droppedCount = droppedIds.length;
  const remainingCount = remainingIds.length;
  const total = doneCount + droppedCount + remainingCount;

  if (!started) return "ready";
  if (remainingCount > 0) return "in_progress";
  if (total > 0 && droppedCount === 0 && doneCount === total) return "completed";
  return "partial";
}

function buildSessionExecutionSummary(
  trace: Record<string, any>,
  executionStatus: "ready" | "in_progress" | "completed" | "partial",
  splitEntered: boolean,
  splitReturnDecision: "continue" | "skip" | null
) {
  const remainingIds = uniqStable(trace.remaining_ids);
  const completedIds = uniqStable(trace.completed_ids);
  const droppedIds = uniqStable(trace.dropped_ids);

  const work_items_done = completedIds.length;
  const work_items_total = completedIds.length + droppedIds.length + remainingIds.length;

  return [
    {
      session_ended: executionStatus === "completed" || executionStatus === "partial",
      work_items_done,
      work_items_total,
      split_entered: splitEntered,
      split_return_decision: splitReturnDecision,
      execution_status: executionStatus
    }
  ];
}

function buildBlockExecutionSummary(
  trace: Record<string, any>,
  executionStatus: "ready" | "in_progress" | "completed" | "partial"
) {
  const remainingIds = uniqStable(trace.remaining_ids);
  const completedIds = uniqStable(trace.completed_ids);
  const droppedIds = uniqStable(trace.dropped_ids);

  return [
    {
      sessions_total: 1,
      sessions_ended: executionStatus === "completed" || executionStatus === "partial" ? 1 : 0,
      work_items_done: completedIds.length,
      work_items_total: completedIds.length + droppedIds.length + remainingIds.length
    }
  ];
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

  const remainingIds = uniqStable(trace.remaining_ids);
  const completedIds = uniqStable(trace.completed_ids);
  const droppedIds = uniqStable(trace.dropped_ids);

  const remaining_exercises = toPlannedExercisesFromIds(planned, remainingIds);
  const completed_exercises = toPlannedExercisesFromIds(planned, completedIds);
  const dropped_exercises = toPlannedExercisesFromIds(planned, droppedIds);

  const current_step =
    return_decision_required === true
      ? { type: "RETURN_DECISION", options: return_decision_options }
      : (remaining_exercises.length > 0 ? { type: "EXERCISE", exercise: remaining_exercises[0] } : null);

  const execution_status = deriveExecutionStatus(
    remainingIds,
    completedIds,
    droppedIds,
    trace.started === true
  );

  const split_return_decision = readSplitReturnDecision(summary, trace);
  const split_entered = readSplitEntered(summary);

  const session_execution_summary = buildSessionExecutionSummary(
    trace,
    execution_status,
    split_entered,
    split_return_decision
  );

  const block_execution_summary = buildBlockExecutionSummary(
    trace,
    execution_status
  );

  return {
    session_id,
    started: trace.started,
    current_step,
    remaining_exercises,
    completed_exercises,
    dropped_exercises,
    trace,
    execution_status,
    session_execution_summary,
    block_execution_summary,
    event_log: []
  };
}

// ============================
// v1 TICKET-A PROJECTION BUILDER (RUN_ID HAPPY PATH)
// ============================

export type CoachSessionDecisionSummary = {
  schema: Record<string, unknown>
  identity: {
    run_id: string
  }
  currentness: {
    state: "current" | "stale" | "superseded" | "incomplete"
  }
  outcome: Record<string, unknown>
  drivers: unknown[]
  timeline: Record<string, unknown>
  audit: Record<string, unknown>
  issues: unknown[]
}

type NormalizedDecisionSummaryRun = {
  run_id: string
  created_at: unknown
  completed_at: unknown
  decision: unknown
  drivers: unknown[]
  issues: unknown[]
  is_stale: boolean
  is_superseded: boolean
  is_incomplete: boolean
}

function coerceBooleanFlag(value: unknown): boolean {
  return value === true;
}

function normalizeDecisionSummarySource(rawRun: any, runId: string): NormalizedDecisionSummaryRun {
  const output = rawRun?.output;

  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("invalid_source: engine_run output required");
  }

  const timeline =
    output.timeline && typeof output.timeline === "object" && !Array.isArray(output.timeline)
      ? output.timeline
      : {};

  return {
    run_id: runId,
    created_at: rawRun.created_at ?? timeline.created_at ?? null,
    completed_at: output.completed_at ?? timeline.completed_at ?? null,
    decision: output.decision ?? null,
    drivers: Array.isArray(output.drivers) ? output.drivers : [],
    issues: Array.isArray(output.issues) ? output.issues : [],
    is_stale: coerceBooleanFlag(output.is_stale ?? rawRun.is_stale),
    is_superseded: coerceBooleanFlag(output.is_superseded ?? rawRun.is_superseded),
    is_incomplete: coerceBooleanFlag(output.is_incomplete ?? rawRun.is_incomplete)
  };
}

export async function buildCoachSessionDecisionSummaryFromRunId(
  runId: string
): Promise<CoachSessionDecisionSummary> {
  if (!runId || runId.trim() === "") {
    throw new Error("invalid_input: run_id required")
  }

  const rawRun = await getEngineRunById(runId)

  if (!rawRun) {
    throw new Error("not_found: run_id")
  }

  const run = normalizeDecisionSummarySource(rawRun, runId)

  const isStale = Boolean(run.is_stale)
  const isSuperseded = Boolean(run.is_superseded)
  const isIncomplete = Boolean(run.is_incomplete)

  let currentness: "current" | "stale" | "superseded" | "incomplete" = "current"

  if (isIncomplete) {
    currentness = "incomplete"
  } else if (isSuperseded) {
    currentness = "superseded"
  } else if (isStale) {
    currentness = "stale"
  }

  return {
    schema: {
      version: "v1"
    },

    identity: {
      run_id: runId
    },

    currentness: {
      state: currentness
    },

    outcome: {
      decision: run.decision ?? null
    },

    drivers: run.drivers ?? [],

    timeline: {
      created_at: run.created_at ?? null,
      completed_at: run.completed_at ?? null
    },

    audit: {
      source: "engine_run",
      resolved_from: "run_id"
    },

    issues: run.issues ?? []
  }
}

async function getEngineRunById(runId: string): Promise<any> {
  const svc = await import("./engine_run_persistence_service")
  return svc.getEngineRunById
    ? svc.getEngineRunById(runId)
    : null
}