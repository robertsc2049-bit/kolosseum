import { buildNeutralSessionSummary } from "./session_summary_read_model";

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

type SessionStateStore = {
  getSessionStateBySessionId(sessionId: string): Promise<SessionStateLike | null>;
};

type SessionEventsStore = {
  listRuntimeEventsBySessionId(sessionId: string): Promise<RuntimeEventLike[]>;
};

type ReqLike = {
  params?: Record<string, string | undefined>;
};

type ResLike = {
  status(code: number): ResLike;
  json(payload: unknown): void;
};

export function createGetNeutralSessionSummaryHandler(deps: {
  sessionStateStore: SessionStateStore;
  sessionEventsStore: SessionEventsStore;
}) {
  return async function getNeutralSessionSummary(req: ReqLike, res: ResLike): Promise<void> {
    const sessionId = req.params?.sessionId;

    if (!sessionId) {
      res.status(400).json({ error: "missing_session_id" });
      return;
    }

    const sessionState = await deps.sessionStateStore.getSessionStateBySessionId(sessionId);

    if (!sessionState) {
      res.status(404).json({ error: "session_not_found" });
      return;
    }

    const runtimeEvents = await deps.sessionEventsStore.listRuntimeEventsBySessionId(sessionId);
    const summary = buildNeutralSessionSummary(sessionState, runtimeEvents);

    res.status(200).json(summary);
  };
}