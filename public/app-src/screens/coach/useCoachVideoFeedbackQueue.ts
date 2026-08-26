import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachVideoFeedbackQueue, submitCoachVideoFeedback } from "../../api/coachVideoFeedbackClient";
import { loadCoachRelationships } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-32 coach video-feedback queue - a self-contained
// sub-panel of the still-legacy Review view (reviewList/coachNoteForm
// stay legacy). Fetches on mount only, same as useCoachEventsLibrary.ts -
// no coach-athlete-profile-opened/closed bridge, since this isn't scoped
// to one athlete profile. Also independently loads relationships (not the
// full useAthleteDirectory.ts bundle) purely to resolve a submission's
// athlete display name, mirroring legacy's state.coachAthletes lookup.
export type CoachVideoFeedbackQueueState = {
  loading: boolean;
  error: string | null;
  submissions: JsonRecord[];
  athleteNamesById: Record<string, string>;
  submitting: boolean;
  submitError: string | null;
};

const initialState: CoachVideoFeedbackQueueState = {
  loading: true,
  error: null,
  submissions: [],
  athleteNamesById: {},
  submitting: false,
  submitError: null
};

export function useCoachVideoFeedbackQueue() {
  const [state, setState] = useState<CoachVideoFeedbackQueueState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [submissions, relationships] = await Promise.all([
        loadCoachVideoFeedbackQueue(),
        loadCoachRelationships(coachUserId)
      ]);
      const athleteNamesById: Record<string, string> = {};
      for (const relationship of relationships) {
        const athleteUserId = String(relationship.athlete_user_id ?? "");
        if (athleteUserId) athleteNamesById[athleteUserId] = String(relationship.display_name ?? athleteUserId);
      }
      setState((current) => ({ ...current, loading: false, submissions, athleteNamesById }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Video feedback queue could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const submitFeedback = useCallback(async (submissionId: string, feedbackText: string): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await submitCoachVideoFeedback(submissionId, feedbackText, csrfToken);
      setState((current) => ({
        ...current,
        submitting: false,
        submissions: current.submissions.filter((submission) => String(submission.submission_id) !== submissionId)
      }));
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Feedback could not be sent." }));
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh, submitFeedback };
}
