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
 * Runtime JSON snapshot (V3) is canonical:
 * - remaining_ids/completed_ids/skipped_ids always present
 * - split is represented by split_active + remaining_at_split_ids
 *
 * Back-compat: we ALSO accept/emit the older nested rt.split shape.
 *
 * @typedef {{
 *  remaining_ids: string[],
 *  completed_ids: string[],
 *  skipped_ids: string[],
 *  split_active?: boolean,
 *  remaining_at_split_ids?: string[],
 *  split?: { active: boolean, remaining_at_split: string[] }
 * }} RuntimeStateJson
 */

function readSplitActive(rt) {
  if (!rt || typeof rt !== "object") return false;
  if (typeof rt.split_active === "boolean") return rt.split_active === true;
  if (rt.split && typeof rt.split === "object") return rt.split.active === true;
  return false;
}

function readRemainingAtSplitIds(rt) {
  if (!rt || typeof rt !== "object") return [];
  if (Array.isArray(rt.remaining_at_split_ids)) return uniqStable(rt.remaining_at_split_ids);
  if (rt.split && typeof rt.split === "object" && Array.isArray(rt.split.remaining_at_split)) {
    return uniqStable(rt.split.remaining_at_split);
  }
  return [];
}

function splitJsonFrom(rt) {
  const active = readSplitActive(rt);
  const remaining_at_split = readRemainingAtSplitIds(rt);
  return active || remaining_at_split.length > 0 ? { active, remaining_at_split } : undefined;
}

export function fromEngineState(state) {
  const remaining_ids = Array.isArray(state.remaining_ids) ? [...state.remaining_ids] : [];
  const completed_ids = uniqStable(Array.from(state.completed_ids ?? []));
  const skipped_ids = uniqStable(Array.from(state.skipped_ids ?? state.dropped_ids ?? []));

  const split_active =
    typeof state.split_active === "boolean"
      ? state.split_active === true
      : state.split && typeof state.split === "object"
        ? state.split.active === true
        : false;

  const remaining_at_split_ids =
    Array.isArray(state.remaining_at_split_ids)
      ? uniqStable(state.remaining_at_split_ids)
      : state.split && typeof state.split === "object" && Array.isArray(state.split.remaining_at_split)
        ? uniqStable(state.split.remaining_at_split)
        : [];

  /** @type {RuntimeStateJson} */
  const rt = {
    remaining_ids,
    completed_ids,
    skipped_ids,
    split_active,
    remaining_at_split_ids
  };

  // Back-compat emission for older consumers.
  const split = splitJsonFrom(rt);
  if (split) rt.split = split;

  return rt;
}

export function scopeRuntimeJsonToPlan(planned_ids, rt) {
  const allowed = new Set(planned_ids);

  const remaining_ids = uniqStable(rt?.remaining_ids).filter((id) => allowed.has(id));
  const completed_ids = uniqStable(rt?.completed_ids).filter((id) => allowed.has(id));
  const skipped_ids = uniqStable(rt?.skipped_ids).filter((id) => allowed.has(id));

  const split_active = readSplitActive(rt);
  const remaining_at_split_ids = readRemainingAtSplitIds(rt).filter((id) => allowed.has(id));

  /** @type {RuntimeStateJson} */
  const out = { remaining_ids, completed_ids, skipped_ids, split_active, remaining_at_split_ids };

  // Back-compat split shape (accepted + emitted).
  const split = splitJsonFrom(out);
  if (split) out.split = split;

  return out;
}

/**
 * Build an Engine runtime state from a V3 JSON snapshot.
 * - Base state always comes from plan (stable ordering)
 * - Terminals are restored through reducer to guarantee invariants
 * - Split shape is restored as data after terminals are rebuilt
 */
export function engineStateFromV3Snapshot(planned_ids, raw) {
  const base = makeRuntimeState(planned_ids);

  /** @type {RuntimeStateJson} */
  const rtRaw = isRecord(raw)
    ? {
        remaining_ids: uniqStable(raw.remaining_ids),
        completed_ids: uniqStable(raw.completed_ids),
        skipped_ids: uniqStable(raw.skipped_ids),
        split_active: readSplitActive(raw),
        remaining_at_split_ids: readRemainingAtSplitIds(raw),
        split: isRecord(raw.split)
          ? {
              active: raw.split.active === true,
              remaining_at_split: uniqStable(raw.split.remaining_at_split)
            }
          : undefined
      }
    : {
        remaining_ids: [],
        completed_ids: [],
        skipped_ids: [],
        split_active: false,
        remaining_at_split_ids: [],
        split: undefined
      };

  const scoped = scopeRuntimeJsonToPlan(planned_ids, rtRaw);

  let st = base;
  for (const id of scoped.completed_ids) st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: id });
  for (const id of scoped.skipped_ids) st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: id });

  // Restore split as data (no implied semantics beyond persisted snapshot).
  // Invariant: if split is inactive, remaining_at_split_ids must be empty.
  const split_active = scoped.split_active === true;
  const remaining_at_split_ids = split_active
    ? Array.isArray(scoped.remaining_at_split_ids)
      ? [...scoped.remaining_at_split_ids]
      : []
    : [];

  st = {
    ...st,
    split_active,
    remaining_at_split_ids
  };

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

  // V2 split snapshot must be replayable: reconstruct via reducer (split_start),
  // not by injecting an ad-hoc nested split object.
  const splitV2 = legacy.split;
  if (splitV2 && typeof splitV2 === "object" && splitV2.active === true) {
    st = applyRuntimeEvent(st, { type: "split_start" });
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
 *
 * @returns {{ summary: SessionSummaryV3, needsUpgrade: boolean }}
 */
export function normalizeSummary(planned, raw) {
  if (isV3Summary(raw)) {
    const ids = plannedIds(planned);
    const last_seq = Number(raw.last_seq ?? 0);
    const started = raw.started === true;

    // Rebuild terminals through reducer.
    const st0 = engineStateFromV3Snapshot(ids, raw.runtime);

    // CRITICAL: Split snapshot is runtime truth and MUST be persisted until
    // RETURN_CONTINUE/RETURN_SKIP clears it. Do NOT clear split_active or
    // remaining_at_split_ids during normalization/persist.
    const st = { ...st0 };
    // (Split semantics are preserved as stored data; reducer owns when it clears.)

    const runtime = fromEngineState(st);

    // Split back-compat emission rules:

    // Back-compat suppression is keyed off *valid* raw shapes only.
    // Rule: Raw fields suppress back-compat emission only when structurally valid;
    // invalid shapes (and invalid element types) are treated as absent.
    function rawHasArrayOfStrings(obj, prop){
      if (!obj || typeof obj !== 'object') return false;
      if (!Object.prototype.hasOwnProperty.call(obj, prop)) return false;
      const v = obj[prop];
      if (!Array.isArray(v)) return false;
      for (const x of v) { if (typeof x !== 'string') return false; }
      return true;
    }
    // - Do NOT introduce runtime.split when modern split snapshot is already canonical (prevents upgrade loops).
    // - DO emit runtime.split for legacy readers when split is active but raw did NOT explicitly carry remaining_at_split_ids.
    const rawHadSplit = !!(raw && raw.runtime && typeof raw.runtime === 'object' && raw.runtime !== null &&
      Object.prototype.hasOwnProperty.call(raw.runtime, 'split'));
    // Treat raw remaining_at_split_ids as explicitly carried ONLY if it is structurally valid (array).
    // Garbage types must not suppress legacy split emission.
        const rawHadRemainingAtSplitIdsValid = rawHasArrayOfStrings(raw && raw.runtime && typeof raw.runtime === 'object' ? raw.runtime : null, 'remaining_at_split_ids');
    const splitActive = readSplitActive(runtime);
    const remAtSplit = readRemainingAtSplitIds(runtime);
    if (!rawHadSplit) {
      // Avoid upgrade loops: if we already have canonical modern split data, do not add nested split.
      // Back-compat exception: only emit nested split when split is active, remAtSplit is empty, AND raw did not explicitly carry remaining_at_split_ids.
      if (splitActive && remAtSplit.length === 0 && !rawHadRemainingAtSplitIdsValid) {
        runtime.split = { active: true, remaining_at_split: [] };
      } else {
        if (runtime && typeof runtime === 'object' && runtime !== null &&
          Object.prototype.hasOwnProperty.call(runtime, 'split')) delete runtime.split;
      }
    } else {
      // Raw already had nested split: keep it only when meaningful.
      // Invariant: inactive split with empty remaining_at_split must not emit nested runtime.split.
      const s = splitJsonFrom(runtime);
      if (s) {
        runtime.split = s;
      } else {
        if (runtime && typeof runtime === 'object' && runtime !== null &&
          Object.prototype.hasOwnProperty.call(runtime, 'split')) delete runtime.split;
      }
    }
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

  const split_active = readSplitActive(rt);
  const remaining_at_split_ids = readRemainingAtSplitIds(rt);

  return {
    started: summary.started === true,
    remaining_ids: uniqStable(rt.remaining_ids),
    completed_ids: uniqStable(rt.completed_ids),
    dropped_ids: uniqStable(rt.skipped_ids),
    split_active,
    remaining_at_split_ids
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
