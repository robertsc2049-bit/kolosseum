function assertNonEmptyString(v, label) {
    if (typeof v !== "string" || v.trim().length === 0) {
        throw new Error(`PHASE6_RUNTIME_INVALID_EVENT: ${label} must be non-empty string`);
    }
}
function dedupeStable(ids) {
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (!id)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
export function makeRuntimeState(planned_ids) {
    const remaining_ids = dedupeStable(planned_ids.map(String).filter(Boolean));
    return {
        remaining_ids,
        completed_ids: new Set(),
        skipped_ids: new Set(),
        split: undefined
    };
}
function removeOne(arr, id) {
    return arr.filter((x) => x !== id);
}
function dropIds(next, idsToDrop) {
    // Drop = mark skipped + remove from remaining (idempotent)
    if (idsToDrop.size === 0)
        return;
    // Only drop things that are currently remaining (no resurrection)
    const remainingSet = new Set(next.remaining_ids);
    for (const id of idsToDrop) {
        if (!id)
            continue;
        if (!remainingSet.has(id))
            continue;
        if (next.completed_ids.has(id))
            continue; // cannot become skipped after complete
        next.skipped_ids.add(id);
    }
    next.remaining_ids = next.remaining_ids.filter((id) => !idsToDrop.has(id));
}
export function applyRuntimeEvent(state, event) {
    // Pure function: do not mutate input state
    const next = {
        remaining_ids: [...state.remaining_ids],
        completed_ids: new Set(state.completed_ids),
        skipped_ids: new Set(state.skipped_ids),
        split: state.split
            ? { active: state.split.active, remaining_at_split: [...state.split.remaining_at_split] }
            : undefined
    };
    switch (event.type) {
        case "complete_exercise": {
            assertNonEmptyString(event.exercise_id, "exercise_id");
            const id = event.exercise_id;
            if (next.completed_ids.has(id) || next.skipped_ids.has(id)) {
                // idempotent: no resurrection, no change
                next.remaining_ids = removeOne(next.remaining_ids, id);
                return next;
            }
            next.completed_ids.add(id);
            next.remaining_ids = removeOne(next.remaining_ids, id);
            return next;
        }
        case "skip_exercise": {
            assertNonEmptyString(event.exercise_id, "exercise_id");
            const id = event.exercise_id;
            if (next.completed_ids.has(id) || next.skipped_ids.has(id)) {
                // idempotent
                next.remaining_ids = removeOne(next.remaining_ids, id);
                return next;
            }
            next.skipped_ids.add(id);
            next.remaining_ids = removeOne(next.remaining_ids, id);
            return next;
        }
        case "split_start": {
            // If already split, keep first snapshot (idempotent)
            if (next.split?.active)
                return next;
            next.split = {
                active: true,
                remaining_at_split: [...next.remaining_ids]
            };
            return next;
        }
        case "split_return_continue": {
            // Continue: preserve current remaining_ids
            if (!next.split?.active)
                return next;
            // On continue, we just end split; no plan reset.
            next.split.active = false;
            return next;
        }
        case "split_return_skip": {
            // Product semantics:
            // - If split active: drop anything that was remaining at split time AND is still remaining now.
            // - If split not active: drop everything remaining (safe + deterministic).
            if (next.split?.active) {
                const toDrop = new Set(next.split.remaining_at_split);
                dropIds(next, toDrop);
                next.split.active = false;
                return next;
            }
            // No active split -> drop all remaining
            dropIds(next, new Set(next.remaining_ids));
            return next;
        }
        default: {
            // Exhaustiveness
            const _exhaustive = event;
            throw new Error(`PHASE6_RUNTIME_UNKNOWN_EVENT: ${event?.type}`);
        }
    }
}
