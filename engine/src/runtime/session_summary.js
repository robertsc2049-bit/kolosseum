// engine/src/runtime/session_summary.js
// Canonical session summary normalization utilities.
// - Semantics come from session_runtime reducer (applyRuntimeEvent/makeRuntimeState).
// - This module owns summary versions + plan scoping + deterministic normalization.
// - API should be a thin wrapper over these functions.

import { applyRuntimeEvent, makeRuntimeState } from "./session_runtime.js";

/**
 * @typedef {Record<string, unknown>} JsonRecord
 */

function isRecord(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v) {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Deterministic stable unique string list from unknown input.
 * - preserves first occurrence order
 * - drops empty
 */
export function uniqStable(ids) {
  const arr = Array.isArray(ids) ? ids : [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const s = typeof v === "string" ? v : String(v ?? "");
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * @typedef {{ exercise_id: string, source: "program" }} PlannedExercise
 * @typedef {{ exercises: PlannedExercise[], notes?: unknown[] }} PlannedSession
 */

export function plannedIds(planned) {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const seen = new Set();
  const out = [];
  for (const ex of exs) {
    const id = ex && typeof ex.exercise_id === "string" ? ex.exercise_id : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @typedef {{
 *  remaining_ids: string[],
 *  completed_ids: string[],
 *  skipped_ids: string[],
 *  split?: { active: boolean, remaining_at_split: string[] }
 * }} RuntimeStateJson
 */

export function fromEngineState(state) {
  return {
    remaining_ids: Array.isArray(state.remaining_ids) ? [...state.remaining_ids] : [],
    completed_ids: Array.from(state.completed_ids ?? []),
    skipped_ids: Array.from(state.skipped_ids ?? []),
    split: state.split
      ? { active: state.split.active === true, remaining_at_split: [...state.split.remaining_at_split] }
      : undefined
  };
}

export function scopeRuntimeJsonToPlan(planned_ids, rt) {
  const allowed = new Set(planned_ids);
  const remaining_ids = uniqStable(rt?.remaining_ids).filter((id) => allowed.has(id));
  const completed_ids = uniqStable(rt?.completed_ids).filter((id) => allowed.has(id));
  const skipped_ids = uniqStable(rt?.skipped_ids).filter((id) => allowed.has(id));

  const split =
    rt?.split && typeof rt.split === "object"
      ? {
          active: rt.split.active === true,
          remaining_at_split: uniqStable(rt.split.remaining_at_split).filter((id) => allowed.has(id))
        }
      : undefined;

  return { remaining_ids, completed_ids, skipped_ids, split };
}

/**
 * Build an Engine runtime state from a V3 JSON snapshot.
 * - Base state always comes from plan (stable ordering)
 * - Terminals are restored through reducer to guarantee invariants
 * - Split shape is restored as data (not semantics), after terminals are rebuilt
 */
export function engineStateFromV3Snapshot(planned_ids, raw) {
  const base = makeRuntimeState(planned_ids);

  /** @type {RuntimeStateJson} */
  const rtRaw = isRecord(raw)
    ? {
        remaining_ids: uniqStable(raw.remaining_ids),
        completed_ids: uniqStable(raw.completed_ids),
        skipped_ids: uniqStable(raw.skipped_ids),
        split: isRecord(raw.split)
          ? {
              active: raw.split.active === true,
              remaining_at_split: uniqStable(raw.split.remaining_at_split)
            }
          : undefined
      }
    : { remaining_ids: [], completed_ids: [], skipped_ids: [], split: undefined };

  const scoped = scopeRuntimeJsonToPlan(planned_ids, rtRaw);

  let st = base;
  for (const id of scoped.completed_ids) st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: id });
  for (const id of scoped.skipped_ids) st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: id });

  if (scoped.split) {
    st = {
      ...st,
      split: {
        active: scoped.split.active === true,
        remaining_at_split: [...scoped.split.remaining_at_split]
      }
    };
  }

  return st;
}

/**
 * Summary formats:
 * - V1: legacy ids lists (no split)
 * - V2: legacy lists of exercise objects + split snapshot
 * - V3: canonical engine runtime state JSON snapshot
 */

/**
 * @typedef {{ version: 3, started: boolean, runtime: RuntimeStateJson, last_seq: number }} SessionSummaryV3
 * @typedef {{ active: boolean, remaining_at_split_ids: string[] }} SplitSnapshotV2
 * @typedef {{
 *  version: 2,
 *  started: boolean,
 *  remaining_exercises: PlannedExercise[],
 *  completed_exercises: PlannedExercise[],
 *  dropped_exercises: PlannedExercise[],
 *  split?: SplitSnapshotV2,
 *  last_seq: number
 * }} SessionSummaryV2
 * @typedef {{ started: boolean, remaining_ids: string[], completed_ids: string[], dropped_ids: string[], last_seq: number }} LegacySessionSummaryV1
 */

export function isV3Summary(v) {
  if (!isRecord(v)) return false;
  if (v.version !== 3) return false;
  if (typeof v.started !== "boolean") return false;
  if (!isRecord(v.runtime)) return false;
  return typeof v.last_seq === "number" || typeof v.last_seq === "string";
}

export function isV2Summary(v) {
  if (!isRecord(v)) return false;
  return (
    v.version === 2 &&
    typeof v.started === "boolean" &&
    Array.isArray(v.remaining_exercises) &&
    Array.isArray(v.completed_exercises) &&
    Array.isArray(v.dropped_exercises)
  );
}

export function isV1Summary(v) {
  if (!isRecord(v)) return false;
  return (
    typeof v.started === "boolean" &&
    Array.isArray(v.remaining_ids) &&
    Array.isArray(v.completed_ids) &&
    Array.isArray(v.dropped_ids)
  );
}

export function summaryFromPlanned(planned) {
  const ids = plannedIds(planned);
  const runtime = fromEngineState(makeRuntimeState(ids));
  return { version: 3, started: false, runtime, last_seq: 0 };
}

export function summaryV3FromLegacy(planned, legacy) {
  const ids = plannedIds(planned);

  const completed_ids =
    "completed_ids" in legacy
      ? uniqStable(legacy.completed_ids)
      : uniqStable(legacy.completed_exercises?.map((e) => e?.exercise_id));

  const skipped_ids =
    "dropped_ids" in legacy
      ? uniqStable(legacy.dropped_ids)
      : uniqStable(legacy.dropped_exercises?.map((e) => e?.exercise_id));

  let st = makeRuntimeState(ids);
  for (const id of completed_ids) st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: id });
  for (const id of skipped_ids) st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: id });

  const splitV2 = legacy.split;
  if (splitV2 && typeof splitV2 === "object") {
    st = {
      ...st,
      split: {
        active: splitV2.active === true,
        remaining_at_split: uniqStable(splitV2.remaining_at_split_ids)
      }
    };
  }

  const last_seq = Number(legacy.last_seq ?? 0);
  return {
    version: 3,
    started: legacy.started === true,
    runtime: fromEngineState(st),
    last_seq
  };
}

/**
 * Normalize any stored summary (V1/V2/V3/unknown) into canonical V3.
 * - V3: scope to plan + rebuild terminals through reducer + normalize number fields
 * - V1/V2: upgrade by reducer reconstruction
 * - unknown: fresh V3 from plan
 *
 * @returns {{ summary: SessionSummaryV3, needsUpgrade: boolean }}
 */
export function normalizeSummary(planned, raw) {
  if (isV3Summary(raw)) {
    const ids = plannedIds(planned);
    const last_seq = Number(raw.last_seq ?? 0);
    const started = raw.started === true;

    const st = engineStateFromV3Snapshot(ids, raw.runtime);
    const runtime = fromEngineState(st);

    const needs =
      raw.version !== 3 ||
      Number(raw.last_seq ?? 0) !== last_seq ||
      JSON.stringify(raw.runtime) !== JSON.stringify(runtime);

    return { summary: { version: 3, started, runtime, last_seq }, needsUpgrade: needs };
  }

  if (isV2Summary(raw) || isV1Summary(raw)) {
    return { summary: summaryV3FromLegacy(planned, raw), needsUpgrade: true };
  }

  return { summary: summaryFromPlanned(planned), needsUpgrade: true };
}

export function deriveTrace(summary) {
  const rt = summary.runtime;
  return {
    started: summary.started === true,
    remaining_ids: uniqStable(rt.remaining_ids),
    completed_ids: uniqStable(rt.completed_ids),
    dropped_ids: uniqStable(rt.skipped_ids),
    split_active: rt.split?.active === true,
    remaining_at_split_ids: rt.split?.remaining_at_split ? uniqStable(rt.split.remaining_at_split) : []
  };
}

/**
 * @typedef {(
 *  | { type: "START_SESSION" }
 *  | { type: "COMPLETE_EXERCISE", exercise_id: string }
 *  | { type: "SKIP_EXERCISE", exercise_id: string }
 *  | { type: "SPLIT_SESSION" }
 *  | { type: "RETURN_CONTINUE" }
 *  | { type: "RETURN_SKIP" }
 *  | ({ type: string } & JsonRecord)
 * )} WireRuntimeEvent
 */

export function validateWireRuntimeEvent(v) {
  if (!isRecord(v)) return null;
  const t = asString(v.type);
  if (!t) return null;

  if (t === "COMPLETE_EXERCISE" || t === "SKIP_EXERCISE") {
    const exercise_id = asString(v.exercise_id);
    if (!exercise_id) return null;
    return { ...v, type: t, exercise_id };
  }

  if (t === "START_SESSION" || t === "SPLIT_SESSION" || t === "RETURN_CONTINUE" || t === "RETURN_SKIP") {
    return { ...v, type: t };
  }

  return { ...v, type: t };
}

export function toEngineEvent(w) {
  switch (w.type) {
    case "COMPLETE_EXERCISE":
      return { type: "complete_exercise", exercise_id: w.exercise_id };
    case "SKIP_EXERCISE":
      return { type: "skip_exercise", exercise_id: w.exercise_id };
    case "SPLIT_SESSION":
      return { type: "split_start" };
    case "RETURN_CONTINUE":
      return { type: "split_return_continue" };
    case "RETURN_SKIP":
      return { type: "split_return_skip" };
    default:
      return null;
  }
}

export function applyWireEvent(summary, ev, planned) {
  if (ev.type === "START_SESSION") {
    const ids = plannedIds(planned);
    const st = makeRuntimeState(ids);
    return { ...summary, started: true, runtime: fromEngineState(st) };
  }

  const engineEv = toEngineEvent(ev);
  if (!engineEv) return summary;

  const ids = plannedIds(planned);
  const st = engineStateFromV3Snapshot(ids, summary.runtime);
  const next = applyRuntimeEvent(st, engineEv);
  return { ...summary, runtime: fromEngineState(next) };
}