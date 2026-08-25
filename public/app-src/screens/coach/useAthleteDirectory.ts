import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadCoachAssignments,
  loadCoachMessageUnreadCounts,
  loadCoachRelationships,
  loadCoachTemplates
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: whole-workspace read (not scoped to one athlete, unlike
// every coach_athlete_detail sub-panel), so there's no
// coach-athlete-profile-opened/closed bridge here. Instead this refetches
// on mount and whenever legacy dispatches
// kolosseum:athlete-directory-changed - see app.js's (gutted)
// renderCoachAthleteDirectory(), which still runs after every relationship
// mutation, assignment change and message-unread refresh exactly as
// before, just to notify this hook instead of writing innerHTML itself.
const CHANGED_EVENT = "kolosseum:athlete-directory-changed";

export type AthleteDirectoryState = {
  loading: boolean;
  error: string | null;
  relationships: JsonRecord[];
  assignments: JsonRecord[];
  templates: JsonRecord[];
  unreadByAthlete: Record<string, number>;
};

const initialState: AthleteDirectoryState = {
  loading: true,
  error: null,
  relationships: [],
  assignments: [],
  templates: [],
  unreadByAthlete: {}
};

export function useAthleteDirectory() {
  const [state, setState] = useState<AthleteDirectoryState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [relationships, assignments, templates, unreadByAthlete] = await Promise.all([
        loadCoachRelationships(coachUserId),
        loadCoachAssignments(coachUserId),
        loadCoachTemplates(coachUserId),
        loadCoachMessageUnreadCounts()
      ]);
      setState({ loading: false, error: null, relationships, assignments, templates, unreadByAthlete });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The athlete directory could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}
