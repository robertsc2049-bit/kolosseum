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
function dieAwaitReturnDecision(t) {
    throw new Error(`PHASE6_RUNTIME_AWAIT_RETURN_DECISION: ${t}`);
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
    st.dropped_ids = st.dropped_ids.size > 0 ? new Set(st.dropped_ids) : new Set(st.skipped_ids);
    st.remaining_exercises = idsToRefs(st.remaining_ids);
    st.completed_exercises = setToRefsStable(st.completed_ids);
    st.skipped_exercises = setToRefsStable(st.skipped_ids);
    st.dropped_exercises = st.skipped_exercises;
    st.return_decision_required = !!st.split_active;
    st.return_decision_options = st.return_decision_required ? ["RETURN_CONTINUE", "RETURN_SKIP"] : [];
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
function ensureStateShape(state, plannedFallback) {
    if (!isRecord(state)) {
        const st = {
            started: true,
            remaining_ids: plannedFallback.slice(),
            completed_ids: new Set(),
            skipped_ids: new Set(),
            dropped_ids: new Set(),
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
            return_decision_required: false,
            return_decision_options: [],
        };
        autoCloseSplitIfDone(st);
        syncDerived(st);
        return st;
    }
    const s = state;
    const started = typeof s.started === "boolean" ? s.started : true;
    const remaining_ids_raw = Array.isArray(s.remaining_ids)
        ? uniqStableIds(s.remaining_ids)
        : plannedFallback.slice();
    const completed_ids = setFromUnknownList(s.completed_ids);
    const skipped_ids = (() => {
        const a = setFromUnknownList(s.skipped_ids);
        const b = setFromUnknownList(s.dropped_ids);
        if (a.size === 0 && b.size > 0)
            return b;
        if (a.size > 0 && b.size === 0)
            return a;
        if (a.size === 0 && b.size === 0)
            return new Set();
        const out = new Set();
        for (const v of Array.from(a.values()).sort())
            out.add(v);
        for (const v of Array.from(b.values()).sort())
            out.add(v);
        return out;
    })();
    const dropped_ids = (() => {
        const explicit = Array.isArray(s.dropped_ids)
            ? uniqStableIds(s.dropped_ids)
            : [];
        if (explicit.length > 0)
            return new Set(explicit);
        return new Set(skipped_ids);
    })();
    const split_active = typeof s.split_active === "boolean" ? s.split_active : false;
    const remaining_at_split_ids = Array.isArray(s.remaining_at_split_ids) ? uniqStableIds(s.remaining_at_split_ids) : [];
    const st = {
        started,
        remaining_ids: remaining_ids_raw,
        completed_ids,
        skipped_ids,
        dropped_ids,
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
        return_decision_required: false,
        return_decision_options: [],
    };
    autoCloseSplitIfDone(st);
    syncDerived(st);
    return st;
}
export function makeRuntimeState(session) {
    const planned = extractPlannedIds(session);
    const st = {
        started: true,
        remaining_ids: planned,
        completed_ids: new Set(),
        skipped_ids: new Set(),
        dropped_ids: new Set(),
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
        return_decision_required: false,
        return_decision_options: [],
    };
    autoCloseSplitIfDone(st);
    syncDerived(st);
    return st;
}
export function applyRuntimeEvent(state, event) {
    validateEvent(event);
    const plannedFallback = Array.isArray(state?.remaining_ids) ? uniqStableIds(state.remaining_ids) : [];
    const st = ensureStateShape(state, plannedFallback);
    const t = normalizeType(event.type);
    // RETURN decision gate
    if (st.split_active && (t === "COMPLETE_EXERCISE" || t === "SKIP_EXERCISE")) {
        dieAwaitReturnDecision(t);
    }
    switch (t) {
        case "COMPLETE_EXERCISE": {
            const id = event.exercise_id;
            st.started = true;
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
            st.dropped_ids.add(id);
            autoCloseSplitIfDone(st);
            syncDerived(st);
            return st;
        }
        case "SPLIT_SESSION": {
            st.started = true;
            st.split_active = true;
            st.remaining_at_split_ids = st.remaining_ids.slice();
            autoCloseSplitIfDone(st);
            syncDerived(st);
            return st;
        }
        case "RETURN_CONTINUE": {
            st.started = true;
            st.split_active = false;
            st.remaining_at_split_ids = [];
            autoCloseSplitIfDone(st);
            syncDerived(st);
            return st;
        }
        case "RETURN_SKIP": {
            st.started = true;
            const orderedToDrop = uniqStableIds([
                ...st.remaining_at_split_ids,
                ...st.remaining_ids
            ]);
            const toDrop = new Set(orderedToDrop);
            if (toDrop.size > 0) {
                st.remaining_ids = st.remaining_ids.filter((id) => !toDrop.has(id));
                for (const id of orderedToDrop) {
                    if (!st.completed_ids.has(id)) {
                        st.skipped_ids.add(id);
                        st.dropped_ids.add(id);
                    }
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
