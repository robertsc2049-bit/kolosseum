type AnyRecord = Record<string, unknown>;

function isRecord(x: unknown): x is AnyRecord {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function isIterable(x: unknown): x is Iterable<unknown> {
  return !!x && (typeof x === "object" || typeof x === "function") && Symbol.iterator in (x as any);
}

function die(msg: string): never {
  throw new Error(String(msg));
}

function dieUnknownEvent(t: string): never {
  throw new Error(`PHASE6_RUNTIME_UNKNOWN_EVENT: ${t}`);
}

// Engine-internal (wire) variants — MUST match engine/src/runtime/types.ts
type LowerRuntimeEvent =
  | { type: "complete_exercise"; exercise_id: string }
  | { type: "skip_exercise"; exercise_id: string }
  | { type: "split_start" }
  | { type: "split_return_continue" }
  | { type: "split_return_skip" };

// E2E canonical variants (used by runtime truth tests / wrapper)
type UpperRuntimeEvent =
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" };

export type RuntimeEvent = LowerRuntimeEvent | UpperRuntimeEvent;

export type RuntimeExerciseRef = { exercise_id: string };

/**
 * Canonical Phase6 runtime reducer state:
 * - *_ids are Sets (tests call .has)
 * - remaining_ids is ordered array (deterministic)
 * - split_active + remaining_at_split_ids capture split semantics
 * - arrays exist for E2E callers that do .map/.length
 *
 * Compatibility aliases included:
 * - dropped_* aliases for skipped_* (many tests/upgrade paths use dropped_ids naming)
 * - remaining/completed/dropped array aliases (some wrappers use shorter names)
 */
export type RuntimeState = {
  started: boolean;

  remaining_ids: string[];

  completed_ids: Set<string>;
  skipped_ids: Set<string>; // canonical internal name
  dropped_ids: Set<string>; // alias (kept in sync)

  split_active: boolean;
  remaining_at_split_ids: string[];

  remaining_exercises: RuntimeExerciseRef[];
  completed_exercises: RuntimeExerciseRef[];
  skipped_exercises: RuntimeExerciseRef[];
  dropped_exercises: RuntimeExerciseRef[]; // alias (kept in sync)

  // short aliases (kept in sync)
  remaining: RuntimeExerciseRef[];
  completed: RuntimeExerciseRef[];
  skipped: RuntimeExerciseRef[];
  dropped: RuntimeExerciseRef[];
};

function normalizeType(t: string): UpperRuntimeEvent["type"] {
  switch (t) {
    // engine internal -> canonical
    case "complete_exercise": return "COMPLETE_EXERCISE";
    case "skip_exercise": return "SKIP_EXERCISE";
    case "split_start": return "SPLIT_SESSION";
    case "split_return_continue": return "RETURN_CONTINUE";
    case "split_return_skip": return "RETURN_SKIP";

    // already canonical
    case "COMPLETE_EXERCISE":
    case "SKIP_EXERCISE":
    case "SPLIT_SESSION":
    case "RETURN_CONTINUE":
    case "RETURN_SKIP":
      return t;

    default:
      dieUnknownEvent(t);
  }
}

function validateEvent(ev: unknown): asserts ev is RuntimeEvent {
  if (!isRecord(ev)) die("PHASE6_RUNTIME_INVALID_EVENT: event must be an object");
  if (typeof ev.type !== "string" || ev.type.length === 0) die("PHASE6_RUNTIME_INVALID_EVENT: missing string type");

  const t = normalizeType(ev.type);

  switch (t) {
    case "COMPLETE_EXERCISE":
    case "SKIP_EXERCISE": {
      const id = (ev as AnyRecord).exercise_id;
      if (typeof id !== "string" || id.length === 0) die(`PHASE6_RUNTIME_INVALID_EVENT: ${t} missing exercise_id`);
      return;
    }
    case "SPLIT_SESSION":
    case "RETURN_CONTINUE":
    case "RETURN_SKIP":
      return;
  }
}

function toExerciseId(x: unknown): string | null {
  if (typeof x === "string" && x.length > 0) return x;
  if (isRecord(x) && typeof x.exercise_id === "string" && x.exercise_id.length > 0) return x.exercise_id;
  return null;
}

function uniqStableIds(list: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of list) {
    const id = toExerciseId(it);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function collectUnknownList(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;

  if (isRecord(x)) {
    const maybeIds = (x as AnyRecord).ids;
    const maybePlanned = (x as AnyRecord).planned_ids;
    const maybeExerciseIds = (x as AnyRecord).exercise_ids;

    if (Array.isArray(maybeIds)) return maybeIds;
    if (Array.isArray(maybePlanned)) return maybePlanned;
    if (Array.isArray(maybeExerciseIds)) return maybeExerciseIds;
  }

  if (isIterable(x)) {
    try {
      return Array.from(x as Iterable<unknown>);
    } catch {
      return null;
    }
  }

  return null;
}

function deepFindCandidateLists(root: unknown, maxDepth: number): unknown[][] {
  if (!isRecord(root)) return [];

  type Node = { v: AnyRecord; depth: number };
  const q: Node[] = [{ v: root, depth: 0 }];
  const seen = new Set<AnyRecord>();

  const found: { score: number; list: unknown[] }[] = [];

  function keyScore(k: string): number {
    const key = k.toLowerCase();

    if (key.includes("planned_items")) return 100;
    if (key.includes("planned_exercise")) return 95;
    if (key === "planned_ids" || key.includes("planned_ids")) return 90;
    if (key === "exercises" || key.includes("session_exercises")) return 85;

    if (key.includes("remaining_exercises") || key.includes("remaining_ids")) return 70;
    if (key.includes("exercise_ids")) return 65;
    if (key.includes("plan")) return 60;

    if (key.includes("items")) return 20;
    if (key.includes("ids")) return 10;

    return 0;
  }

  while (q.length) {
    const cur = q.shift()!;
    if (seen.has(cur.v)) continue;
    seen.add(cur.v);

    for (const [k, v] of Object.entries(cur.v)) {
      const score = keyScore(k);
      const list = collectUnknownList(v);

      if (list && list.length > 0) {
        const ids = uniqStableIds(list);
        if (ids.length > 0) found.push({ score, list });
      }

      if (cur.depth < maxDepth && isRecord(v)) q.push({ v, depth: cur.depth + 1 });
    }
  }

  found.sort((a, b) => b.score - a.score);
  return found.map((x) => x.list);
}

function extractPlannedIds(sessionLike: unknown): string[] {
  // 0) raw list/iterable
  {
    const list = collectUnknownList(sessionLike);
    if (list && list.length > 0) {
      const ids = uniqStableIds(list);
      if (ids.length > 0) return ids;
    }
  }

  if (!isRecord(sessionLike)) {
    die("PHASE6_RUNTIME_BAD_SESSION: expected session-like object or iterable of exercise ids");
  }

  const s = sessionLike;

  // 1) common keys
  const candidates: unknown[] = [
    (s as AnyRecord).planned_items,
    (s as AnyRecord).planned_exercise_ids,
    (s as AnyRecord).planned_ids,
    (s as AnyRecord).session_exercises,
    (s as AnyRecord).exercises,
    (s as AnyRecord).remaining_exercises,
    (s as AnyRecord).remaining_ids,
  ];

  for (const c of candidates) {
    const list = collectUnknownList(c);
    if (list && list.length > 0) {
      const ids = uniqStableIds(list);
      if (ids.length > 0) return ids;
    }
  }

  // 2) wrappers
  const wrappers: unknown[] = [
    (s as AnyRecord).session,
    (s as AnyRecord).plan,
    (s as AnyRecord).program,
    (s as AnyRecord).phase6,
    (s as AnyRecord).summary,
    (s as AnyRecord).session_state,
    (s as AnyRecord).state,
  ];

  for (const w of wrappers) {
    if (isRecord(w)) {
      try {
        const ids = extractPlannedIds(w);
        if (ids.length > 0) return ids;
      } catch {
        // keep going
      }
    }
  }

  // 3) deep scan
  const deepLists = deepFindCandidateLists(s, 3);
  for (const dl of deepLists) {
    const ids = uniqStableIds(dl);
    if (ids.length > 0) return ids;
  }

  die("PHASE6_RUNTIME_BAD_SESSION: could not extract planned exercise ids");
}

function setFromUnknownList(x: unknown): Set<string> {
  if (!x) return new Set<string>();
  if (x instanceof Set) {
    const out = new Set<string>();
    for (const v of x) if (typeof v === "string" && v.length > 0) out.add(v);
    return out;
  }
  if (Array.isArray(x)) {
    const out = new Set<string>();
    for (const v of x) if (typeof v === "string" && v.length > 0) out.add(v);
    return out;
  }
  return new Set<string>();
}

function idsToRefs(ids: string[]): RuntimeExerciseRef[] {
  return ids.map((exercise_id) => ({ exercise_id }));
}

function setToRefsStable(s: Set<string>): RuntimeExerciseRef[] {
  return Array.from(s.values()).sort().map((exercise_id) => ({ exercise_id }));
}

function removeId(list: string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

function syncDerived(st: RuntimeState): void {
  // keep alias sets in sync
  st.dropped_ids = st.skipped_ids;

  st.remaining_exercises = idsToRefs(st.remaining_ids);
  st.completed_exercises = setToRefsStable(st.completed_ids);
  st.skipped_exercises = setToRefsStable(st.skipped_ids);
  st.dropped_exercises = st.skipped_exercises;

  // short aliases
  st.remaining = st.remaining_exercises;
  st.completed = st.completed_exercises;
  st.skipped = st.skipped_exercises;
  st.dropped = st.dropped_exercises;
}

function autoCloseSplitIfDone(st: RuntimeState): void {
  if (st.remaining_ids.length === 0) {
    st.split_active = false;
    st.remaining_at_split_ids = [];
  }
}

/**
 * Hardening rules:
 * - Ensure all expected fields exist
 * - Accept legacy 'dropped_ids' naming
 * - If split_active=true and remaining_at_split_ids is present, it is authoritative for what was remaining at split time.
 */
function ensureStateShape(state: unknown, plannedFallback: string[]): RuntimeState {
  if (!isRecord(state)) {
    const st: RuntimeState = {
      started: true,
      remaining_ids: plannedFallback.slice(),
      completed_ids: new Set<string>(),
      skipped_ids: new Set<string>(),
      dropped_ids: new Set<string>(),

      split_active: false,
      remaining_at_split_ids: [],

      remaining_exercises: [],
      completed_exercises: [],
      skipped_exercises: [],
      dropped_exercises: [],

      remaining: [],
      completed: [],
      skipped: [],
      dropped: [],
    };
    autoCloseSplitIfDone(st);
    syncDerived(st);
    return st;
  }

  const s = state as AnyRecord;

  const started = typeof s.started === "boolean" ? s.started : true;

  const remaining_ids_raw =
    Array.isArray(s.remaining_ids) ? uniqStableIds(s.remaining_ids) : plannedFallback.slice();

  const completed_ids = setFromUnknownList((s as AnyRecord).completed_ids);

  // accept BOTH names as input; unify to skipped_ids
  const skipped_ids = (() => {
    const a = setFromUnknownList((s as AnyRecord).skipped_ids);
    const b = setFromUnknownList((s as AnyRecord).dropped_ids);
    if (a.size === 0 && b.size > 0) return b;
    if (a.size > 0 && b.size === 0) return a;
    if (a.size === 0 && b.size === 0) return new Set<string>();
    // merge deterministically if both exist
    const out = new Set<string>();
    for (const v of Array.from(a.values()).sort()) out.add(v);
    for (const v of Array.from(b.values()).sort()) out.add(v);
    return out;
  })();

  const split_active = typeof s.split_active === "boolean" ? s.split_active : false;
  const remaining_at_split_ids =
    Array.isArray(s.remaining_at_split_ids) ? uniqStableIds(s.remaining_at_split_ids) : [];

  const st: RuntimeState = {
    started,
    remaining_ids: remaining_ids_raw,

    completed_ids,
    skipped_ids,
    dropped_ids: skipped_ids,

    split_active,
    remaining_at_split_ids,

    remaining_exercises: [],
    completed_exercises: [],
    skipped_exercises: [],
    dropped_exercises: [],

    remaining: [],
    completed: [],
    skipped: [],
    dropped: [],
  };

  autoCloseSplitIfDone(st);
  syncDerived(st);
  return st;
}

export function makeRuntimeState(session: unknown): RuntimeState {
  const planned = extractPlannedIds(session);

  const st: RuntimeState = {
    started: true,
    remaining_ids: planned,
    completed_ids: new Set<string>(),
    skipped_ids: new Set<string>(),
    dropped_ids: new Set<string>(),

    split_active: false,
    remaining_at_split_ids: [],

    remaining_exercises: [],
    completed_exercises: [],
    skipped_exercises: [],
    dropped_exercises: [],

    remaining: [],
    completed: [],
    skipped: [],
    dropped: [],
  };

  autoCloseSplitIfDone(st);
  syncDerived(st);
  return st;
}

export function applyRuntimeEvent(state: RuntimeState, event: RuntimeEvent): RuntimeState {
  validateEvent(event);

  const plannedFallback: string[] =
    Array.isArray((state as any)?.remaining_ids) ? uniqStableIds((state as any).remaining_ids) : [];

  const st = ensureStateShape(state as unknown, plannedFallback);
  const t = normalizeType(event.type);

  switch (t) {
    case "COMPLETE_EXERCISE": {
      const id = (event as any).exercise_id as string;

      st.started = true;

      // no-op if terminal already recorded
      if (st.completed_ids.has(id) || st.skipped_ids.has(id)) {
        autoCloseSplitIfDone(st);
        syncDerived(st);
        return st;
      }

      st.remaining_ids = removeId(st.remaining_ids, id);
      st.completed_ids.add(id);

      autoCloseSplitIfDone(st);
      syncDerived(st);
      return st;
    }

    case "SKIP_EXERCISE": {
      const id = (event as any).exercise_id as string;

      st.started = true;

      if (st.skipped_ids.has(id) || st.completed_ids.has(id)) {
        autoCloseSplitIfDone(st);
        syncDerived(st);
        return st;
      }

      st.remaining_ids = removeId(st.remaining_ids, id);
      st.skipped_ids.add(id);

      autoCloseSplitIfDone(st);
      syncDerived(st);
      return st;
    }

    case "SPLIT_SESSION": {
      st.started = true;

      st.split_active = true;
      // authoritative capture of what was remaining at split time
      st.remaining_at_split_ids = st.remaining_ids.slice();

      autoCloseSplitIfDone(st);
      syncDerived(st);
      return st;
    }

    case "RETURN_CONTINUE": {
      st.started = true;

      // explicit decision: resume without dropping
      st.split_active = false;
      st.remaining_at_split_ids = [];

      autoCloseSplitIfDone(st);
      syncDerived(st);
      return st;
    }

    case "RETURN_SKIP": {
      st.started = true;

      // Explicit decision: drop all remaining work.
      // Primary authoritative set is remaining_at_split_ids (what existed when they split),
      // but we also union with current remaining_ids as a hardening fallback.
      const toDrop = new Set<string>();

      for (const id of st.remaining_at_split_ids) toDrop.add(id);
      for (const id of st.remaining_ids) toDrop.add(id);

      if (toDrop.size > 0) {
        st.remaining_ids = st.remaining_ids.filter((id) => !toDrop.has(id));
        for (const id of toDrop) {
          if (!st.completed_ids.has(id)) st.skipped_ids.add(id);
        }
      }

      st.split_active = false;
      st.remaining_at_split_ids = [];

      autoCloseSplitIfDone(st);
      syncDerived(st);
      return st;
    }
  }
}
