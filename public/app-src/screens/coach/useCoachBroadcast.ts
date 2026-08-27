import { useCallback, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadBroadcastReadStatus, loadCoachRelationships, sendCoachBroadcast } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's (removed) confirmSendCoachBroadcast()/
// broadcastAthleteName()/refreshBroadcastReadStatus()/
// renderBroadcastReadStatus(). Athlete display names for the read-status
// list are resolved via an independent loadCoachRelationships() fetch
// (same route the already-React AthleteDirectoryPanel.tsx and
// useAthleteRelationshipDetail.ts use), rather than reading legacy's
// state.coachAthletes.
export type BroadcastReadEntry = { athlete_user_id: string; read: boolean; display_name: string };

export type CoachBroadcastState = {
  submitting: boolean;
  sentSummary: string | null;
  readStatus: { sentCount: number; readCount: number; athletes: BroadcastReadEntry[] } | null;
};

const initialState: CoachBroadcastState = {
  submitting: false,
  sentSummary: null,
  readStatus: null
};

export function useCoachBroadcast() {
  const [state, setState] = useState<CoachBroadcastState>(initialState);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);

  const refreshReadStatus = useCallback(async (id: string) => {
    try {
      const [status, relationships] = await Promise.all([
        loadBroadcastReadStatus(id),
        // coach_user_id is resolved server-side from the session and the
        // query param is ignored - see getCoachAthleteRelationships.
        loadCoachRelationships("")
      ]);
      const nameByAthleteId = new Map(
        relationships.map((entry) => [String(entry.athlete_user_id ?? ""), String(entry.display_name ?? "")])
      );
      const athletes = Array.isArray(status.athletes)
        ? (status.athletes as JsonRecord[]).map((entry) => {
            const athleteUserId = String(entry.athlete_user_id ?? "");
            return {
              athlete_user_id: athleteUserId,
              read: entry.read === true,
              display_name: nameByAthleteId.get(athleteUserId) || athleteUserId
            };
          })
        : [];
      setState((current) => ({
        ...current,
        readStatus: { sentCount: Number(status.sent_count) || 0, readCount: Number(status.read_count) || 0, athletes }
      }));
    }
    catch {
      // Read-status is a secondary, refreshable detail - a failed refresh
      // leaves the prior state in place rather than surfacing a hard error.
    }
  }, []);

  const send = useCallback(async (bodyText: string) => {
    const trimmed = bodyText.trim();
    if (!trimmed) return false;

    setState((current) => ({ ...current, submitting: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await sendCoachBroadcast(trimmed, csrfToken);
      const sentCount = Number(result.sent_count) || 0;

      setState({
        submitting: false,
        sentSummary: sentCount > 0
          ? `Sent to ${sentCount} athlete${sentCount === 1 ? "" : "s"}.`
          : "No accepted athletes to send to yet.",
        readStatus: null
      });

      if (sentCount > 0) {
        const id = String(result.broadcast_id ?? "");
        setBroadcastId(id);
        if (id) await refreshReadStatus(id);
      }
      else {
        setBroadcastId(null);
      }

      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false }));
      return false;
    }
  }, [refreshReadStatus]);

  const refresh = useCallback(() => {
    if (broadcastId) return refreshReadStatus(broadcastId);
    return Promise.resolve();
  }, [broadcastId, refreshReadStatus]);

  return { ...state, send, refresh };
}
