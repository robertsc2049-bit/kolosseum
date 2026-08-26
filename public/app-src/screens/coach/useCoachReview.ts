import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachRelationships, loadCoachReviews, submitCoachNote, submitCoachSessionReview } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-17 coach review queue - ported from app.js's
// refreshCoachReviewQueue()/renderCoachReviewWorkspace()/
// setCoachSessionReview()/recordCoachNote(). Fetches on mount only, same
// as useCoachEventsLibrary.ts/useCoachVideoFeedbackQueue.ts. Also
// independently loads relationships purely to resolve display names and
// each athlete's relationship record (needed by the note-record request
// body), mirroring legacy's state.coachAthletes lookups.
//
// Three entry points elsewhere in the app open this view with a specific
// athlete preselected: the still-legacy "open review" dashboard action,
// AthleteHistoryPanels.tsx's session-history "Review" button, and
// route_bootstrap.js's coach_review_athlete deep link. All three dispatch
// the same kolosseum:open-session-review bridge event this hook listens
// for - legacy's own listener for that event now only does
// setView("review") (navigation stays legacy), while this hook applies
// the athlete filter once its own fetch has resolved. Unlike the old
// #reviewAthlete <select>'s synchronous options list, this hook's athlete
// list loads asynchronously, so a pending id is held until loading
// finishes; if it never turns out to be a real connected athlete, this
// hook dispatches kolosseum:coach-review-athlete-not-found for
// route_bootstrap.js's showRouteNotice() to report the same
// "record is not available" notice the removed hasOption check used to.
const OPEN_SESSION_REVIEW_EVENT = "kolosseum:open-session-review";
const ATHLETE_NOT_FOUND_EVENT = "kolosseum:coach-review-athlete-not-found";
const NOTE_DIRTY_EVENT = "kolosseum:coach-note-dirty-changed";

export type ReviewRecord = JsonRecord;

export type CoachReviewState = {
  loading: boolean;
  error: string | null;
  reviews: ReviewRecord[];
  athleteNamesById: Record<string, string>;
  selectedAthleteId: string;
  marking: boolean;
  markError: string | null;
  noteSubmitting: boolean;
  noteError: string | null;
};

const initialState: CoachReviewState = {
  loading: true,
  error: null,
  reviews: [],
  athleteNamesById: {},
  selectedAthleteId: "",
  marking: false,
  markError: null,
  noteSubmitting: false,
  noteError: null
};

function dispatchNoteDirty(dirty: boolean) {
  document.dispatchEvent(new CustomEvent(NOTE_DIRTY_EVENT, { detail: { dirty } }));
}

export function useCoachReview() {
  const [state, setState] = useState<CoachReviewState>(initialState);
  const [athleteRelationshipsById, setAthleteRelationshipsById] = useState<Record<string, JsonRecord>>({});
  const [pendingAthleteId, setPendingAthleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [reviews, relationships] = await Promise.all([
        loadCoachReviews(coachUserId),
        loadCoachRelationships(coachUserId)
      ]);

      const athleteNamesById: Record<string, string> = {};
      const relationshipsById: Record<string, JsonRecord> = {};
      for (const relationship of relationships) {
        const athleteUserId = String(relationship.athlete_user_id ?? "");
        if (!athleteUserId) continue;
        athleteNamesById[athleteUserId] = String(relationship.display_name ?? athleteUserId);
        relationshipsById[athleteUserId] = relationship;
      }

      setAthleteRelationshipsById(relationshipsById);
      setState((current) => ({ ...current, loading: false, reviews, athleteNamesById }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Review records could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const setSelectedAthleteId = useCallback((athleteUserId: string) => {
    setState((current) => ({ ...current, selectedAthleteId: athleteUserId }));
  }, []);

  const markReview = useCallback(async (record: ReviewRecord, reviewStatus: "reviewed" | "unreviewed"): Promise<boolean> => {
    setState((current) => ({ ...current, marking: true, markError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");

      await submitCoachSessionReview(
        String(record.session_id),
        {
          request_id: `session_review_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          requested_at_iso8601: new Date().toISOString(),
          coach_user_id: coachUserId,
          athlete_user_id: record.athlete_user_id,
          artefact_id: record.artefact_id,
          review_status: reviewStatus
        },
        csrfToken
      );

      setState((current) => ({ ...current, marking: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, marking: false, markError: "The review status could not be updated." }));
      return false;
    }
  }, [refresh]);

  const recordNote = useCallback(async (record: ReviewRecord, noteText: string, visibility: string): Promise<boolean> => {
    const relationship = athleteRelationshipsById[String(record.athlete_user_id ?? "")];
    if (!relationship) {
      setState((current) => ({ ...current, noteError: "An accepted athlete relationship is required to record a note." }));
      return false;
    }

    setState((current) => ({ ...current, noteSubmitting: true, noteError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const coachProfile = (account.bootstrap as JsonRecord | undefined)?.coach_profile ?? null;

      await submitCoachNote(
        {
          coach_profile: coachProfile,
          relationship,
          athlete_user_id: record.athlete_user_id,
          session_id: record.session_id,
          artefact_id: record.artefact_id,
          note_text: noteText.trim(),
          visibility
        },
        csrfToken
      );

      setState((current) => ({ ...current, noteSubmitting: false }));
      dispatchNoteDirty(false);
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, noteSubmitting: false, noteError: "The note could not be recorded." }));
      return false;
    }
  }, [athleteRelationshipsById, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handleOpenReview(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setPendingAthleteId(detail.athlete_user_id);
    }
    document.addEventListener(OPEN_SESSION_REVIEW_EVENT, handleOpenReview);
    return () => document.removeEventListener(OPEN_SESSION_REVIEW_EVENT, handleOpenReview);
  }, []);

  useEffect(() => {
    if (!pendingAthleteId || state.loading) return;

    if (state.athleteNamesById[pendingAthleteId]) {
      setSelectedAthleteId(pendingAthleteId);
    }
    else {
      document.dispatchEvent(new CustomEvent(ATHLETE_NOT_FOUND_EVENT));
    }
    setPendingAthleteId(null);
  }, [pendingAthleteId, state.loading, state.athleteNamesById, setSelectedAthleteId]);

  return {
    ...state,
    refresh,
    setSelectedAthleteId,
    markReview,
    recordNote,
    dispatchNoteDirty
  };
}
