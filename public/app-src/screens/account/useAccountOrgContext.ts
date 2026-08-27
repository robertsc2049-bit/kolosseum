import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachOrgMemberships, loadCoachOrgRoster, resolveCoachOrgMembershipAction } from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: Part O.7 - coach-side org/team context, the mirror of O.6's
// athlete-side panel (AccountOrgMessagesPanel.tsx). Read-only besides the
// accept/leave membership actions - which org(s) a coach belongs to, and,
// only for shared (team) orgs, who else coaches there. Individual (gym)
// orgs render org name/badge only; the roster route itself is the
// authority on that boundary (empty roster for individual mode), this is
// purely display. Ported from app.js's refreshCoachOrgContext()/
// renderCoachOrgContext()/resolveOrgMembershipAction().
export type CoachOrgContextEntry = { membership: JsonRecord; roster: JsonRecord[] };

export type AccountOrgContextState = {
  loading: boolean;
  error: string | null;
  entries: CoachOrgContextEntry[];
  actingId: string | null;
  actionError: string | null;
};

const initialState: AccountOrgContextState = {
  loading: true,
  error: null,
  entries: [],
  actingId: null,
  actionError: null
};

export function useAccountOrgContext() {
  const [state, setState] = useState<AccountOrgContextState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const memberships = await loadCoachOrgMemberships();
      const activeMemberships = memberships.filter((membership) => membership.membership_status !== "removed");

      const entries: CoachOrgContextEntry[] = await Promise.all(
        activeMemberships.map(async (membership) => {
          // The fellow-roster route requires an active membership - an
          // invited-but-not-yet-accepted membership in a shared org would
          // otherwise 403 here, before the coach ever sees the invitation
          // they're supposed to accept.
          if (membership.visibility_mode !== "shared" || membership.membership_status !== "active") {
            return { membership, roster: [] };
          }
          const roster = await loadCoachOrgRoster(String(membership.org_id));
          return { membership, roster };
        })
      );
      setState((current) => ({ ...current, loading: false, entries }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Organisation records could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // A same-tab sign-in/register never fires "storage", so the panel's
    // role gate can flip coach-on without this hook ever re-fetching -
    // see utils/role.ts's useRole().
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  const resolveAction = useCallback(async (membershipId: string, action: "accept" | "leave") => {
    setState((current) => ({ ...current, actingId: membershipId, actionError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await resolveCoachOrgMembershipAction(membershipId, action, csrfToken);
      setState((current) => ({ ...current, actingId: null }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({
        ...current,
        actingId: null,
        actionError: action === "accept" ? "Could not accept the invitation." : "Could not leave the organisation."
      }));
      return false;
    }
  }, [refresh]);

  return {
    ...state,
    accept: (membershipId: string) => resolveAction(membershipId, "accept"),
    leave: (membershipId: string) => resolveAction(membershipId, "leave")
  };
}
