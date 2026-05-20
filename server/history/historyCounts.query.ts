import {
  HISTORY_COUNTS_SCHEMA_VERSION,
  assertHistoryResponseClosedWorld,
  type HistoryCounts,
  type HistoryCountsResponse,
  type HistorySession
} from "./historyCounts.contract";

export type HistorySessionRecord = {
  session_id: string;
  athlete_user_id: string;
  status: HistorySession["status"];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type HistoryRuntimeItemRecord = {
  runtime_item_id: string;
  session_id: string;
  athlete_user_id: string;
  status: "completed" | "skipped" | "partial";
  recorded_at: string;
};

export type HistoryExtraWorkEventRecord = {
  extra_work_event_id: string;
  session_id: string;
  athlete_user_id: string;
  recorded_at: string;
};

export type BuildHistoryCountsInput = {
  athlete_user_id: string;
  viewer_type: "athlete" | "linked_coach";
  sessions: HistorySessionRecord[];
  runtime_items: HistoryRuntimeItemRecord[];
  extra_work_events?: HistoryExtraWorkEventRecord[];
  s36_active: boolean;
  limit?: number;
  offset?: number;
};

export const HISTORY_COUNTS_SQL = {
  summary: [
    "select",
    "  count(distinct s.session_id)::integer as session_count,",
    "  count(ri.runtime_item_id) filter (where ri.status = 'completed')::integer as completed_item_count,",
    "  count(ri.runtime_item_id) filter (where ri.status = 'skipped')::integer as skipped_item_count,",
    "  count(ri.runtime_item_id) filter (where ri.status = 'partial')::integer as partial_item_count,",
    "  min(s.started_at) as first_session_at,",
    "  max(coalesce(s.completed_at, s.started_at, s.created_at)) as latest_session_at",
    "from sessions s",
    "left join session_runtime_items ri",
    "  on ri.session_id = s.session_id",
    "where s.athlete_user_id = :athlete_user_id;"
  ].join("\n"),
  extraWork: [
    "select",
    "  count(extra_work_event_id)::integer as extra_work_event_count",
    "from extra_work_events",
    "where athlete_user_id = :athlete_user_id;"
  ].join("\n"),
  sessions: [
    "select",
    "  session_id,",
    "  status,",
    "  started_at,",
    "  completed_at,",
    "  created_at",
    "from sessions",
    "where athlete_user_id = :athlete_user_id",
    "order by coalesce(started_at, created_at) desc, session_id asc",
    "limit :limit",
    "offset :offset;"
  ].join("\n"),
  coachLink: [
    "select",
    "  link_id,",
    "  status,",
    "  scope,",
    "  accepted_at,",
    "  revoked_at,",
    "  expires_at",
    "from coach_athlete_links",
    "where coach_user_id = :coach_user_id",
    "  and athlete_user_id = :athlete_user_id",
    "  and status = 'accepted'",
    "  and accepted_at is not null",
    "  and revoked_at is null",
    "  and (expires_at is null or expires_at > now())",
    "limit 1;"
  ].join("\n")
} as const;

function latestDateForSession(session: HistorySessionRecord): string {
  return session.completed_at ?? session.started_at ?? session.created_at;
}

function firstDateForSession(session: HistorySessionRecord): string {
  return session.started_at ?? session.created_at;
}

function clampPagination(limit: number | undefined, offset: number | undefined): { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(limit ?? 25, 0), 100),
    offset: Math.max(offset ?? 0, 0)
  };
}

export function buildHistoryCountsResponse(input: BuildHistoryCountsInput): HistoryCountsResponse {
  const scopedSessions = input.sessions.filter(session => session.athlete_user_id === input.athlete_user_id);
  const sessionIds = new Set(scopedSessions.map(session => session.session_id));

  const scopedItems = input.runtime_items.filter(
    item => item.athlete_user_id === input.athlete_user_id && sessionIds.has(item.session_id)
  );

  const sortedSessions = [...scopedSessions].sort((a, b) => {
    const dateComparison = latestDateForSession(b).localeCompare(latestDateForSession(a));
    if (dateComparison !== 0) return dateComparison;
    return a.session_id.localeCompare(b.session_id);
  });

  const firstSession = scopedSessions.length
    ? [...scopedSessions].sort((a, b) => firstDateForSession(a).localeCompare(firstDateForSession(b)))[0]
    : null;

  const latestSession = scopedSessions.length
    ? [...scopedSessions].sort((a, b) => latestDateForSession(b).localeCompare(latestDateForSession(a)))[0]
    : null;

  const counts: HistoryCounts = {
    session_count: scopedSessions.length,
    completed_item_count: scopedItems.filter(item => item.status === "completed").length,
    skipped_item_count: scopedItems.filter(item => item.status === "skipped").length,
    partial_item_count: scopedItems.filter(item => item.status === "partial").length,
    first_session_at: firstSession ? firstDateForSession(firstSession) : null,
    latest_session_at: latestSession ? latestDateForSession(latestSession) : null
  };

  if (input.s36_active) {
    counts.extra_work_event_count = (input.extra_work_events ?? []).filter(
      event => event.athlete_user_id === input.athlete_user_id && sessionIds.has(event.session_id)
    ).length;
  }

  const pagination = clampPagination(input.limit, input.offset);

  const response: HistoryCountsResponse = {
    schema_version: HISTORY_COUNTS_SCHEMA_VERSION,
    athlete_user_id: input.athlete_user_id,
    viewer_type: input.viewer_type,
    counts,
    sessions: sortedSessions.slice(pagination.offset, pagination.offset + pagination.limit).map(session => ({
      session_id: session.session_id,
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at,
      created_at: session.created_at
    }))
  };

  assertHistoryResponseClosedWorld(response);
  return response;
}