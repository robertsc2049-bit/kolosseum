import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadCoachOrgMemberships,
  loadTeamAthleteRoster,
  overrideTeamAthletePosition
} from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: slice 3 of the sport-declaration redesign - a coach who is an
// ACTIVE member of a shared-visibility ("team") org can directly override
// a teammate athlete's position, no athlete confirmation needed (unlike
// the plain 1:1 propose/confirm tier in useAthleteRelationshipDetail.ts).
// Mirrors useAccountOrgContext.ts's own shape (org list -> per-org roster
// fetch), but the roster here is athletes, not fellow coaches, and only
// active-shared orgs are ever fetched (an invited-only or individual-mode
// org shows no roster - the route itself is the authority on that
// boundary, this is purely display).
export type TeamOrgEntry = { orgId: string; orgName: string; roster: JsonRecord[] };

export type TeamRosterState = {
  loading: boolean;
  error: string | null;
  orgs: TeamOrgEntry[];
  overridingKey: string | null;
  overrideError: string | null;
};

const initialState: TeamRosterState = {
  loading: true,
  error: null,
  orgs: [],
  overridingKey: null,
  overrideError: null
};

export function useTeamRoster() {
  const [state, setState] = useState<TeamRosterState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const memberships = await loadCoachOrgMemberships();
      const activeSharedOrgs = memberships.filter(
        (membership) => membership.visibility_mode === "shared" && membership.membership_status === "active"
      );

      const orgs: TeamOrgEntry[] = await Promise.all(
        activeSharedOrgs.map(async (membership) => {
          const orgId = String(membership.org_id ?? "");
          const roster = await loadTeamAthleteRoster(orgId).catch(() => []);
          return { orgId, orgName: String(membership.org_name ?? ""), roster };
        })
      );
      setState((current) => ({ ...current, loading: false, orgs }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Team roster records could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  const overridePosition = useCallback(async (orgId: string, athleteUserId: string, position: string) => {
    const key = `${orgId}:${athleteUserId}`;
    setState((current) => ({ ...current, overridingKey: key, overrideError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await overrideTeamAthletePosition(orgId, athleteUserId, position, csrfToken);
      setState((current) => ({ ...current, overridingKey: null }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({
        ...current,
        overridingKey: null,
        overrideError: "The position could not be updated."
      }));
      return false;
    }
  }, [refresh]);

  return { ...state, overridePosition };
}
