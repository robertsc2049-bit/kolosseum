export type NeutralSessionSummaryStatus =
  | "ready"
  | "in_progress"
  | "partial"
  | "completed";

export type NeutralSessionSummary = {
  session_id: string;
  run_id: string;
  status: NeutralSessionSummaryStatus;
  prescribed_items_total: number;
  prescribed_items_completed: number;
  prescribed_items_skipped: number;
  prescribed_items_remaining: number;
  extra_work_event_count: number;
  split_event_count: number;
  return_continue_count: number;
  return_skip_count: number;
  runtime_event_count: number;
  started_at_utc: string | null;
  completed_at_utc: string | null;
};

type RuntimeEventLike = {
  event_type?: string;
  timestamp_utc?: string | null;
  at_utc?: string | null;
  occurred_at_utc?: string | null;
};

type SessionStateLike = {
  session_id: string;
  run_id: string;
  execution_status?: string;
  trace?: {
    remaining_ids?: string[];
    completed_ids?: string[];
    dropped_ids?: string[];
    event_count?: number;
  };
  planned_work_item_ids?: string[];
  work_item_ids?: string[];
  started_at_utc?: string | null;
  completed_at_utc?: string | null;
};

const ALLOWED_KEYS = [
  "session_id",
  "run_id",
  "status",
  "prescribed_items_total",
  "prescribed_items_completed",
  "prescribed_items_skipped",
  "prescribed_items_remaining",
  "extra_work_event_count",
  "split_event_count",
  "return_continue_count",
  "return_skip_count",
  "runtime_event_count",
  "started_at_utc",
  "completed_at_utc",
] as const;

const BANNED_SEMANTIC_KEYS = [
  "score",
  "quality",
  "adherence",
  "compliance",
  "performance",
  "trend",
  "insight",
  "recommendation",
  "next_action",
  "warning",
  "risk",
  "readiness",
  "fatigue",
  "improvement",
  "regression",
  "summary_text",
  "interpretation",
  "reason",
  "explanation",
] as const;

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

function firstTimestamp(events: RuntimeEventLike[]): string | null {
  for (const event of events) {
    const ts = event.timestamp_utc ?? event.at_utc ?? event.occurred_at_utc ?? null;
    if (typeof ts === "string" && ts.length > 0) {
      return ts;
    }
  }
  return null;
}

function deriveStatus(raw: unknown): NeutralSessionSummaryStatus {
  if (raw === "completed") return "completed";
  if (raw === "partial") return "partial";
  if (raw === "in_progress") return "in_progress";
  return "ready";
}

function countEvents(events: RuntimeEventLike[], acceptedTypes: ReadonlySet<string>): number {
  let count = 0;
  for (const event of events) {
    const eventType = typeof event.event_type === "string" ? event.event_type : "";
    if (acceptedTypes.has(eventType)) {
      count += 1;
    }
  }
  return count;
}

function enforceContractShape(summary: NeutralSessionSummary): NeutralSessionSummary {
  const summaryKeys = Object.keys(summary).sort();
  const allowedKeys = [...ALLOWED_KEYS].sort();

  if (summaryKeys.length !== allowedKeys.length) {
    throw new Error("neutral_session_summary_contract_key_count_mismatch");
  }

  for (let i = 0; i < allowedKeys.length; i += 1) {
    if (summaryKeys[i] !== allowedKeys[i]) {
      throw new Error(`neutral_session_summary_contract_key_mismatch:${summaryKeys[i] ?? "missing"}:${allowedKeys[i]}`);
    }
  }

  for (const banned of BANNED_SEMANTIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(summary, banned)) {
      throw new Error(`neutral_session_summary_banned_semantic_key:${banned}`);
    }
  }

  return summary;
}

export function getNeutralSessionSummaryAllowedKeys(): readonly string[] {
  return ALLOWED_KEYS;
}

export function getNeutralSessionSummaryBannedSemanticKeys(): readonly string[] {
  return BANNED_SEMANTIC_KEYS;
}

export function buildNeutralSessionSummary(
  sessionState: SessionStateLike,
  runtimeEvents: RuntimeEventLike[],
): NeutralSessionSummary {
  const completedIds = toArray(sessionState.trace?.completed_ids);
  const droppedIds = toArray(sessionState.trace?.dropped_ids);
  const remainingIds = toArray(sessionState.trace?.remaining_ids);
  const plannedIds = toArray(sessionState.planned_work_item_ids);
  const workItemIds = toArray(sessionState.work_item_ids);

  const prescribedItemsTotal =
    plannedIds.length > 0
      ? plannedIds.length
      : workItemIds.length > 0
        ? workItemIds.length
        : completedIds.length + droppedIds.length + remainingIds.length;

  const prescribedItemsCompleted = completedIds.length;
  const prescribedItemsSkipped = droppedIds.length;
  const prescribedItemsRemaining =
    prescribedItemsTotal - prescribedItemsCompleted - prescribedItemsSkipped;

  const summary: NeutralSessionSummary = {
    session_id: sessionState.session_id,
    run_id: sessionState.run_id,
    status: deriveStatus(sessionState.execution_status),
    prescribed_items_total: prescribedItemsTotal,
    prescribed_items_completed: prescribedItemsCompleted,
    prescribed_items_skipped: prescribedItemsSkipped,
    prescribed_items_remaining: prescribedItemsRemaining < 0 ? 0 : prescribedItemsRemaining,
    extra_work_event_count: countEvents(runtimeEvents, new Set(["EXTRA_WORK", "ADD_EXTRA_WORK", "EXTRA_WORK_RECORDED"])),
    split_event_count: countEvents(runtimeEvents, new Set(["SPLIT_SESSION"])),
    return_continue_count: countEvents(runtimeEvents, new Set(["RETURN_CONTINUE"])),
    return_skip_count: countEvents(runtimeEvents, new Set(["RETURN_SKIP"])),
    runtime_event_count:
      typeof sessionState.trace?.event_count === "number"
        ? sessionState.trace.event_count
        : runtimeEvents.length,
    started_at_utc: sessionState.started_at_utc ?? firstTimestamp(runtimeEvents) ?? null,
    completed_at_utc: sessionState.completed_at_utc ?? null,
  };

  return enforceContractShape(summary);
}