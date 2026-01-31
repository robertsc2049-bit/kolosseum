// engine/src/runtime/session_runtime.ts
import type { RuntimeEvent, RuntimeState } from "./types.js";

function assertNonEmptyString(v: unknown, label: string): asserts v is string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`PHASE6_RUNTIME_INVALID_EVENT: ${label} must be non-empty string`);
  }
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

export function makeRuntimeState(planned_ids: string[]): RuntimeState {
  const remaining_ids = dedupeStable(planned_ids.map(String).filter(Boolean));
  return {
    remaining_ids,
    completed_ids: new Set<string>(),
    skipped_ids: new Set<string>(),
    split: undefined
  };
}

function removeOne(arr: string[], id: string): string[] {
  return arr.filter((x) => x !== id);
}

export function applyRuntimeEvent(state: RuntimeState, event: RuntimeEvent): RuntimeState {
  // Pure function: do not mutate input state
  const next: RuntimeState = {
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
      if (next.split?.active) return next;

      next.split = {
        active: true,
        remaining_at_split: [...next.remaining_ids]
      };
      return next;
    }

    case "split_return_continue": {
      // Continue: preserve current remaining_ids
      if (!next.split?.active) return next;

      // On continue, we just end split; no plan reset.
      next.split.active = false;
      return next;
    }

    case "split_return_skip": {
      // Skip: drop anything that was remaining at split time that is still remaining now.
      // This matches existing semantics: you come back and choose to skip remaining work.
      if (!next.split?.active) return next;

      const toDrop = new Set(next.split.remaining_at_split);
      next.remaining_ids = next.remaining_ids.filter((id) => !toDrop.has(id));
      next.split.active = false;
      return next;
    }

    default: {
      // Exhaustiveness
      const _exhaustive: never = event;
      throw new Error(`PHASE6_RUNTIME_UNKNOWN_EVENT: ${(event as any)?.type}`);
    }
  }
}
