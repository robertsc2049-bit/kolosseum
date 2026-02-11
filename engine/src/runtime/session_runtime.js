function isRecord(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
}
function isIterable(x) {
    return !!x && (typeof x === "object" || typeof x === "function") && Symbol.iterator in x;
}
function die(msg) {
    throw new Error(String(msg));
}
function dieUnknownEvent(t) {
    throw new Error(`PHASE6_RUNTIME_UNKNOWN_EVENT: ${t}`);
}
function normalizeType(t) {
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
function validateEvent(ev) {
    if (!isRecord(ev))
        die("PHASE6_RUNTIME_INVALID_EVENT: event must be an object");
    if (typeof ev.type !== "string" || ev.type.length === 0)
        die("PHASE6_RUNTIME_INVALID_EVENT: missing string type");
    const t = normalizeType(ev.type);
    switch (t) {
        case "COMPLETE_EXERCISE":
        case "SKIP_EXERCISE": {
            const id = ev.exercise_id;
            if (typeof id !== "string" || id.length === 0)
                die(`PHASE6_RUNTIME_INVALID_EVENT: ${t} missing exercise_id`);
            return;
        }
        case "SPLIT_SESSION":
        case "RETURN_CONTINUE":
        case "RETURN_SKIP":
            return;
    }
}
function toExerciseId(x) {
    if (typeof x === "string" && x.length > 0)
        return x;
    if (isRecord(x) && typeof x.exercise_id === "string" && x.exercise_id.length > 0)
        return x.exercise_id;
    return null;
}
function uniqStableIds(list) {
    const out = [];
    const seen = new Set();
    for (const it of list) {
        const id = toExerciseId(it);
        if (!id)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
function collectUnknownList(x) {
    if (Array.isArray(x))
        return x;
    if (isRecord(x)) {
        const maybeIds = x.ids;
        const maybePlanned = x.planned_ids;
        const maybeExerciseIds = x.exercise_ids;
        if (Array.isArray(maybeIds))
            return maybeIds;
        if (Array.isArray(maybePlanned))
            return maybePlanned;
        if (Array.isArray(maybeExerciseIds))
            return maybeExerciseIds;
    }
    if (isIterable(x)) {
        try {
            return Array.from(x);
        }
        catch {
            return null;
        }
    }
    return null;
}
function deepFindCandidateLists(root, maxDepth) {
    if (!isRecord(root))
        return [];
    const q = [{ v: root, depth: 0 }];
    const seen = new Set();
    const found = [];
    function keyScore(k) {
        const key = k.toLowerCase();
        if (key.includes("planned_items"))
            return 100;
        if (key.includes("planned_exercise"))
            return 95;
        if (key === "planned_ids" || key.includes("planned_ids"))
            return 90;
        if (key === "exercises" || key.includes("session_exercises"))
            return 85;
        if (key.includes("remaining_exercises") || key.includes("remaining_ids"))
            return 70;
        if (key.includes("exercise_ids"))
            return 65;
        if (key.includes("plan"))
            return 60;
        if (key.includes("items"))
            return 20;
        if (key.includes("ids"))
            return 10;
        return 0;
    }
    while (q.length) {
        const cur = q.shift();
        if (seen.has(cur.v))
            continue;
        seen.add(cur.v);
        for (const [k, v] of Object.entries(cur.v)) {
            const score = keyScore(k);
            const list = collectUnknownList(v);
            if (list && list.length > 0) {
                const ids = uniqStableIds(list);
                if (ids.length > 0)
                    found.push({ score, list });
            }
            if (cur.depth < maxDepth && isRecord(v))
                q.push({ v, depth: cur.depth + 1 });
        }
    }
    found.sort((a, b) => b.score - a.score);
    return found.map((x) => x.list);
}
function extractPlannedIds(sessionLike) {
    // 0) raw list/iterable
    {
        const list = collectUnknownList(sessionLike);
        if (list && list.length > 0) {
            const ids = uniqStableIds(list);
            if (ids.length > 0)
                return ids;
        }
    }
    if (!isRecord(sessionLike)) {
        die("PHASE6_RUNTIME_BAD_SESSION: expected session-like object or iterable of exercise ids");
    }
    const s = sessionLike;
    // 1) common keys
    const candidates = [
        s.planned_items,
        s.planned_exercise_ids,
        s.planned_ids,
        s.session_exercises,
        s.exercises,
        s.remaining_exercises,
        s.remaining_ids,
    ];
    for (const c of candidates) {
        const list = collectUnknownList(c);
        if (list && list.length > 0) {
            const ids = uniqStableIds(list);
            if (ids.length > 0)
                return ids;
        }
    }
    // 2) wrappers
    const wrappers = [
        s.session,
        s.plan,
        s.program,
        s.phase6,
        s.summary,
        s.session_state,
        s.state,
    ];
    for (const w of wrappers) {
        if (isRecord(w)) {
            try {
                const ids = extractPlannedIds(w);
                if (ids.length > 0)
                    return ids;
            }
            catch {
                // keep going
            }
        }
    }
    // 3) deep scan
    const deepLists = deepFindCandidateLists(s, 3);
    for (const dl of deepLists) {
        const ids = uniqStableIds(dl);
        if (ids.length > 0)
            return ids;
    }
    die("PHASE6_RUNTIME_BAD_SESSION: could not extract planned exercise ids");
}
function normalizePriority(x) {
    if (x === "required" || x === "core" || x === "accessory")
        return x;
    return null;
}
function extractPriorityById(sessionLike) {
    const out = {};
    if (!isRecord(sessionLike))
        return out;
    const exs = Array.isArray(sessionLike.exercises) ? sessionLike.exercises : [];
    for (const exAny of exs) {
        if (!isRecord(exAny))
            continue;
        const id = typeof exAny.exercise_id === "string" ? String(exAny.exercise_id) : "";
        if (!id)
            continue;
        const p = normalizePriority(exAny.priority) ?? "core";
        out[id] = p;
    }
    return out;
}
function setFromUnknownList(x) {
    if (!x)
        return new Set();
    if (x instanceof Set) {
        const out = new Set();
        for (const v of x)
            if (typeof v === "string" && v.length > 0)
                out.add(v);
        return out;
    }
    if (Array.isArray(x)) {
        const out = new Set();
        for (const v of x)
            if (typeof v === "string" && v.length > 0)
                out.add(v);
        return out;
    }
    return new Set();
}
function idsToRefs(ids) {
    return ids.map((exercise_id) => ({ exercise_id }));
}
function setToRefsStable(s) {
    return Array.from(s.values()).sort().map((exercise_id) => ({ exercise_id }));
}
function removeId(list, id) {
    return list.filter((x) => x !== id);
}
function syncDerived(st) {
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
function autoCloseSplitIfDone(st) {
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
function ensureStateShape(state, plannedFallback, priorityFallback) {
    if (!isRecord(state)) {
        const st = {
            started: true,
            remaining_ids: plannedFallback.slice(),
            completed_ids: new Set(),
            skipped_ids: new Set(),
            dropped_ids: new Set(),
            split_active: false,
            remaining_at_split_ids: [],
            priority_by_id: { ...priorityFallback },
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
    const s = state;
    const started = typeof s.started === "boolean" ? s.started : true;
    const remaining_ids_raw = Array.isArray(s.remaining_ids) ? uniqStableIds(s.remaining_ids) : plannedFallback.slice();
    const completed_ids = setFromUnknownList(s.completed_ids);
    // accept BOTH names as input; unify to skipped_ids
    const skipped_ids = (() => {
        const a = setFromUnknownList(s.skipped_ids);
        const b = setFromUnknownList(s.dropped_ids);
        if (a.size === 0 && b.size > 0)
            return b;
        if (a.size > 0 && b.size === 0)
            return a;
        if (a.size === 0 && b.size === 0)
            return new Set();
        // merge deterministically if both exist
        const out = new Set();
        for (const v of Array.from(a.values()).sort())
            out.add(v);
        for (const v of Array.from(b.values()).sort())
            out.add(v);
        return out;
    })();
    const split_active = typeof s.split_active === "boolean" ? s.split_active : false;
    const remaining_at_split_ids = Array.isArray(s.remaining_at_split_ids) ? uniqStableIds(s.remaining_at_split_ids) : [];
    const priority_by_id = (() => {
        const raw = s.priority_by_id;
        if (isRecord(raw)) {
            const out = { ...priorityFallback };
            for (const [k, v] of Object.entries(raw)) {
                const p = normalizePriority(v);
                if (p)
                    out[k] = p;
            }
            return out;
        }
        return { ...priorityFallback };
    })();
    const st = {
        started,
        remaining_ids: remaining_ids_raw,
        completed_ids,
        skipped_ids,
        dropped_ids: skipped_ids,
        split_active,
        remaining_at_split_ids,
        priority_by_id,
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
export function makeRuntimeState(session) {
    const planned = extractPlannedIds(session);
    const priority_by_id = extractPriorityById(session);
    const st = {
        started: true,
        remaining_ids: planned,
        completed_ids: new Set(),
        skipped_ids: new Set(),
        dropped_ids: new Set(),
        split_active: false,
        remaining_at_split_ids: [],
        priority_by_id,
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
export function applyRuntimeEvent(state, event) {
    validateEvent(event);
    const plannedFallback = Array.isArray(state?.remaining_ids) ? uniqStableIds(state.remaining_ids) : [];
    const priorityFallback = isRecord(state?.priority_by_id) ? state.priority_by_id : {};
    const st = ensureStateShape(state, plannedFallback, priorityFallback);
    const t = normalizeType(event.type);
    switch (t) {
        case "COMPLETE_EXERCISE": {
            const id = event.exercise_id;
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
            const id = event.exercise_id;
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
            // Policy-based skip:
            // - Drop accessories only (low-priority work).
            // - Preserve core/required remaining work.
            //
            // Authoritative snapshot is remaining_at_split_ids, with remaining_ids union as hardening fallback.
            const candidates = new Set();
            for (const id of st.remaining_at_split_ids)
                candidates.add(id);
            for (const id of st.remaining_ids)
                candidates.add(id);
            const toDrop = [];
            for (const id of Array.from(candidates.values()).sort()) {
                const p = st.priority_by_id[id] ?? "core";
                if (p === "accessory")
                    toDrop.push(id);
            }
            if (toDrop.length > 0) {
                const dropSet = new Set(toDrop);
                st.remaining_ids = st.remaining_ids.filter((id) => !dropSet.has(id));
                for (const id of toDrop) {
                    if (!st.completed_ids.has(id))
                        st.skipped_ids.add(id);
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
