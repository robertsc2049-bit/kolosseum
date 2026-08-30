import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadMyAttendanceOccurrences, submitAttendanceRsvp } from "../../api/attendanceEventsClient";
import { type JsonRecord } from "../../api/transport";

const CHANGED_EVENT = "kolosseum:attendance-events-changed";

export function useAthleteAttendanceEvents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<JsonRecord[]>([]);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadMyAttendanceOccurrences();
      setOccurrences(loaded);
      setLoading(false);
    }
    catch (error_) {
      setLoading(false);
      setError(error_ instanceof Error ? error_.message : "Your events could not be loaded. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => document.removeEventListener(CHANGED_EVENT, refresh);
  }, [refresh]);

  const rsvp = useCallback(async (occurrenceId: string, rsvpState: "attending" | "maybe" | "not_attending") => {
    setRsvpError(null);
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await submitAttendanceRsvp(occurrenceId, rsvpState, csrfToken);
      await refresh();
      return true;
    }
    catch (error_) {
      setRsvpError(error_ instanceof Error ? error_.message : "Your RSVP could not be saved.");
      return false;
    }
  }, [refresh]);

  return { loading, error, occurrences, retry: refresh, rsvp, rsvpError };
}
