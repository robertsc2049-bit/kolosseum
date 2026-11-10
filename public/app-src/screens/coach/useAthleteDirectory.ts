import { useCallback, useEffect, useState } from "react";

import { loadPackageMembers } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import {
  loadCoachAssignments,
  loadCoachMessageUnreadCounts,
  loadCoachRelationships,
  loadCoachTemplates
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";
import { NOTIFICATIONS_ARRIVED_EVENT } from "../../utils/liveUpdates";

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
  // Each athlete's package with this coach, and whether payment is due
  // (package_membership_service.ts) - optional, so a failure never hides
  // the roster.
  packageByAthlete: Record<string, { name: string; payment_due: boolean; payment_claimed: boolean }>;
};

const initialState: AthleteDirectoryState = {
  loading: true,
  error: null,
  relationships: [],
  assignments: [],
  templates: [],
  unreadByAthlete: {},
  packageByAthlete: {}
};

export function useAthleteDirectory() {
  const [state, setState] = useState<AthleteDirectoryState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [relationships, assignments, templates, unreadByAthlete, members] = await Promise.all([
        loadCoachRelationships(coachUserId),
        loadCoachAssignments(coachUserId),
        loadCoachTemplates(coachUserId),
        loadCoachMessageUnreadCounts(),
        loadPackageMembers().then((payload) => (Array.isArray(payload.members) ? (payload.members as JsonRecord[]) : []), () => [] as JsonRecord[])
      ]);
      const packageByAthlete: AthleteDirectoryState["packageByAthlete"] = {};
      for (const member of members) {
        packageByAthlete[String(member.athlete_user_id)] = { name: String(((member.package ?? {}) as JsonRecord).name ?? ""), payment_due: member.payment_due === true, payment_claimed: !!member.payment_claim };
      }
      setState({ loading: false, error: null, relationships, assignments, templates, unreadByAthlete, packageByAthlete });
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
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    document.addEventListener(NOTIFICATIONS_ARRIVED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
      document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
      document.removeEventListener(NOTIFICATIONS_ARRIVED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}
