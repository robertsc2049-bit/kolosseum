import { useCallback, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { inviteAthleteByEmail as inviteAthleteByEmailRequest } from "../../api/coachWorkspaceClient";

// DEV NOTE: FULL-UI-24 lawful invitation - ported from app.js's (removed)
// inviteAthleteByEmail(). Unlike the manual "Add athlete" form
// (useConnectAthlete.ts), sending an invitation doesn't itself create a
// visible relationship record yet (the athlete has to accept it from
// their own account first - see accountRelationshipsClient.ts's
// acceptRelationshipInvitation), so this doesn't dispatch
// kolosseum:coach-relationship-mutated.
export function useInviteAthleteByEmail() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invite = useCallback(async (athleteEmail: string) => {
    const trimmed = athleteEmail.trim();
    if (!trimmed) return false;

    setSubmitting(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await inviteAthleteByEmailRequest(trimmed, csrfToken);
      setSubmitting(false);
      setNotice(`Invitation sent to ${trimmed}.`);
      return true;
    }
    catch {
      setSubmitting(false);
      setError("The invitation could not be sent.");
      return false;
    }
  }, []);

  return { submitting, error, notice, invite };
}
