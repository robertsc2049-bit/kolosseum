import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  cancelAttendanceEvent,
  loadCoachAttendanceEventDetail,
  loadCoachAttendanceEvents
} from "../../api/attendanceEventsClient";
import { type JsonRecord } from "../../api/transport";

const CHANGED_EVENT = "kolosseum:attendance-events-changed";

export function useAttendanceEventDetail() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<JsonRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadCoachAttendanceEvents();
      setEvents(loaded);
      setLoading(false);
    }
    catch (error_) {
      setLoading(false);
      setError(error_ instanceof Error ? error_.message : "Events could not be loaded. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    refreshList();
    document.addEventListener(CHANGED_EVENT, refreshList);
    return () => document.removeEventListener(CHANGED_EVENT, refreshList);
  }, [refreshList]);

  const refreshDetail = useCallback(async (eventId: string) => {
    setDetailError(null);
    try {
      const loaded = await loadCoachAttendanceEventDetail(eventId);
      setDetail(loaded);
    }
    catch (error_) {
      setDetailError(error_ instanceof Error ? error_.message : "Event detail could not be loaded.");
    }
  }, []);

  const selectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setDetail(null);
    refreshDetail(eventId);
  }, [refreshDetail]);

  const closeDetail = useCallback(() => {
    setSelectedEventId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const cancel = useCallback(async (eventId: string) => {
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await cancelAttendanceEvent(eventId, csrfToken);
      await refreshList();
      await refreshDetail(eventId);
      return true;
    }
    catch (error_) {
      setDetailError(error_ instanceof Error ? error_.message : "The event could not be cancelled.");
      return false;
    }
  }, [refreshList, refreshDetail]);

  return {
    loading,
    error,
    events,
    retry: refreshList,
    selectedEventId,
    detail,
    detailError,
    selectEvent,
    closeDetail,
    cancel
  };
}
