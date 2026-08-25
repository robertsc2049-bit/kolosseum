import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type AthleteHistoryFilters,
  loadAthleteHistoryDetail,
  loadAthleteHistoryList,
  loadVideoFeedbackSubmissions
} from "../../api/athleteHistoryClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-16C athlete training history (list, server-side filters,
// detail). Independently fetched - mirrors app.js's (now trimmed)
// refreshHistory(), which still runs unchanged for its other jobs
// (state.history for Today's recent-list preview, and refreshing the other
// still-legacy athlete self-service panels) and now dispatches
// kolosseum:history-changed so this hook knows to refetch too.
// kolosseum:history-detail-route is dispatched by route_bootstrap.js when
// the URL matches #/athlete/history/:session_id - this hook owns that
// listener now (legacy's openHistoryDetail() is gone). Opening a session
// from a click needs no manual pushState/replaceState here at all: the
// session card keeps its data-history-detail-id attribute, which
// route_bootstrap.js's installProductRouting() already delegates on via a
// genuinely global document click listener (not a per-render bind), so it
// updates the URL on its own for any element carrying that attribute,
// React-rendered or not.
const CHANGED_EVENT = "kolosseum:history-changed";
const DETAIL_ROUTE_EVENT = "kolosseum:history-detail-route";

export type TrainingHistoryState = {
  loading: boolean;
  error: string | null;
  sessions: JsonRecord[];
  unfilteredSessions: JsonRecord[];
  selectedSessionId: string | null;
  detail: JsonRecord | null;
  detailVideoSubmissions: JsonRecord[];
  detailLoading: boolean;
  detailError: string | null;
};

const initialState: TrainingHistoryState = {
  loading: true,
  error: null,
  sessions: [],
  unfilteredSessions: [],
  selectedSessionId: null,
  detail: null,
  detailVideoSubmissions: [],
  detailLoading: false,
  detailError: null
};

async function currentAthleteUserId(): Promise<string> {
  const account = await loadAccountDetail();
  return String((account.account as JsonRecord | undefined)?.user_id ?? "");
}

export function useTrainingHistory() {
  const [state, setState] = useState<TrainingHistoryState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const athleteUserId = await currentAthleteUserId();
      const response = await loadAthleteHistoryList(athleteUserId);
      const sessions = Array.isArray(response.sessions) ? (response.sessions as JsonRecord[]) : [];
      setState((current) => ({ ...current, loading: false, sessions, unfilteredSessions: sessions }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Training history could not be fetched. Check your connection and try again."
      }));
    }
  }, []);

  const applyFilters = useCallback(async (filters: Partial<AthleteHistoryFilters>) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const athleteUserId = await currentAthleteUserId();
      const response = await loadAthleteHistoryList(athleteUserId, filters);
      const sessions = Array.isArray(response.sessions) ? (response.sessions as JsonRecord[]) : [];
      setState((current) => ({ ...current, loading: false, sessions }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Training history could not be fetched. Check your connection and try again."
      }));
    }
  }, []);

  const clearFilters = useCallback(() => {
    setState((current) => ({ ...current, sessions: current.unfilteredSessions }));
  }, []);

  const openDetail = useCallback(async (sessionId: string) => {
    setState((current) => ({
      ...current,
      selectedSessionId: sessionId,
      detail: null,
      detailVideoSubmissions: [],
      detailLoading: true,
      detailError: null
    }));

    let detail: JsonRecord;
    let submissions: JsonRecord[];
    try {
      const athleteUserId = await currentAthleteUserId();
      [detail, submissions] = await Promise.all([
        loadAthleteHistoryDetail(athleteUserId, sessionId),
        loadVideoFeedbackSubmissions(sessionId).catch(() => [])
      ]);
    }
    catch {
      setState((current) => ({
        ...current,
        detailLoading: false,
        detailError: "The session record could not be fetched."
      }));
      return;
    }

    setState((current) => ({
      ...current,
      detail,
      detailVideoSubmissions: submissions,
      detailLoading: false
    }));
  }, []);

  const closeDetail = useCallback(() => {
    setState((current) => ({
      ...current,
      selectedSessionId: null,
      detail: null,
      detailVideoSubmissions: [],
      detailError: null
    }));
    if (window.location.hash.startsWith("#/athlete/history/")) {
      window.location.hash = "#/athlete/history";
    }
  }, []);

  useEffect(() => {
    refresh();

    function onChanged() {
      refresh();
    }

    function onDetailRoute(event: Event) {
      const sessionId = (event as CustomEvent<{ session_id?: string }>).detail?.session_id;
      if (sessionId) openDetail(sessionId);
    }

    document.addEventListener(CHANGED_EVENT, onChanged);
    document.addEventListener(DETAIL_ROUTE_EVENT, onDetailRoute);
    return () => {
      document.removeEventListener(CHANGED_EVENT, onChanged);
      document.removeEventListener(DETAIL_ROUTE_EVENT, onDetailRoute);
    };
  }, [refresh, openDetail]);

  return { ...state, refresh, applyFilters, clearFilters, openDetail, closeDetail };
}
