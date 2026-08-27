import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  acceptRelationshipInvitation,
  declineRelationshipInvitation,
  loadPendingRelationshipInvitations
} from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's refreshPendingRelationshipInvitations()/
// renderPendingRelationshipInvitations() - one of five panels legacy used
// to splice into #view-account via insertAdjacentElement (see
// AccountCoachRelationshipPanel.tsx/AccountOrgContextPanel.tsx/
// AccountOrgMessagesPanel.tsx/AccountCoachCodePanel.tsx for the others).
// Legacy's own refreshPendingRelationshipInvitations() is kept (trimmed to
// fetch+cache only) since notificationCoachName() in app.js's notification
// bell still reads state.pendingRelationshipInvitations directly to
// resolve a coach's display name for a notification card - this hook's
// own mutations dispatch RELATIONSHIP_CHANGED_EVENT so that trimmed
// refresher (and the sibling relationships panel) stay in sync.
export const RELATIONSHIP_CHANGED_EVENT = "kolosseum:athlete-relationship-changed";

export type AccountCoachInvitationsState = {
  loading: boolean;
  error: string | null;
  invitations: JsonRecord[];
  actingId: string | null;
  actionError: string | null;
};

const initialState: AccountCoachInvitationsState = {
  loading: true,
  error: null,
  invitations: [],
  actingId: null,
  actionError: null
};

export function useAccountCoachInvitations() {
  const [state, setState] = useState<AccountCoachInvitationsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const invitations = await loadPendingRelationshipInvitations();
      setState((current) => ({ ...current, loading: false, invitations }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Coach invitations could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // A same-tab sign-in/register never fires "storage", so the panel's
    // role gate can flip athlete-on without this hook ever re-fetching -
    // its very first mount-time fetch (likely under the wrong or no role
    // yet) would otherwise be cached as a permanent error state. See
    // utils/role.ts's useRole().
    document.addEventListener(RELATIONSHIP_CHANGED_EVENT, refresh);
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => {
      document.removeEventListener(RELATIONSHIP_CHANGED_EVENT, refresh);
      document.removeEventListener("kolosseum:account-role-known", refresh);
    };
  }, [refresh]);

  const respond = useCallback(async (relationshipId: string, action: "accept" | "decline") => {
    setState((current) => ({ ...current, actingId: relationshipId, actionError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      if (action === "accept") await acceptRelationshipInvitation(relationshipId, csrfToken);
      else await declineRelationshipInvitation(relationshipId, csrfToken);

      setState((current) => ({ ...current, actingId: null }));
      await refresh();
      document.dispatchEvent(new CustomEvent(RELATIONSHIP_CHANGED_EVENT));
      return true;
    }
    catch {
      setState((current) => ({
        ...current,
        actingId: null,
        actionError: action === "accept" ? "The invitation could not be accepted." : "The invitation could not be declined."
      }));
      return false;
    }
  }, [refresh]);

  return { ...state, accept: (id: string) => respond(id, "accept"), decline: (id: string) => respond(id, "decline") };
}
