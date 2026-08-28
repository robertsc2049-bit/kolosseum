import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadAthleteCoachNotes, loadCoachRelationships, submitCoachNote } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteStrengthProfile.ts's DEV NOTE).
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";
// DEV NOTE: dispatched by AthleteHistoryPanels.tsx's session-history "Add
// note" button - this hook now owns the compose form directly rather than
// app.js's (removed) listener toggling #athleteDetailNoteForm.
const OPEN_NOTE_FORM_EVENT = "kolosseum:open-session-note-form";

export type AthleteCoachNotesState = {
  loading: boolean;
  error: string | null;
  notes: JsonRecord[];
  composing: boolean;
  sessionId: string;
  artefactId: string;
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteCoachNotesState = {
  loading: true,
  error: null,
  notes: [],
  composing: false,
  sessionId: "",
  artefactId: "",
  submitting: false,
  submitError: null
};

export function useAthleteCoachNotes() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteCoachNotesState>(initialState);

  useEffect(() => {
    function handleOpened(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setAthleteUserId(detail.athlete_user_id);
    }

    function handleClosed() {
      setAthleteUserId(null);
    }

    document.addEventListener(OPENED_EVENT, handleOpened);
    document.addEventListener(CLOSED_EVENT, handleClosed);
    return () => {
      document.removeEventListener(OPENED_EVENT, handleOpened);
      document.removeEventListener(CLOSED_EVENT, handleClosed);
    };
  }, []);

  useEffect(() => {
    function handleOpenNoteForm(event: Event) {
      const detail = (event as CustomEvent).detail as { session_id?: string; artefact_id?: string } | undefined;
      setState((current) => ({
        ...current,
        composing: true,
        sessionId: detail?.session_id ?? "",
        artefactId: detail?.artefact_id ?? "",
        submitError: null
      }));
    }

    document.addEventListener(OPEN_NOTE_FORM_EVENT, handleOpenNoteForm);
    return () => document.removeEventListener(OPEN_NOTE_FORM_EVENT, handleOpenNoteForm);
  }, []);

  const refresh = useCallback(async (id: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const notes = await loadAthleteCoachNotes(id);
      setState((current) => ({ ...current, loading: false, error: null, notes }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Coach notes could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    if (athleteUserId) {
      refresh(athleteUserId);
    }
    else {
      setState(initialState);
    }
  }, [athleteUserId, refresh]);

  const cancelCompose = useCallback(() => {
    setState((current) => ({ ...current, composing: false, submitError: null }));
  }, []);

  // DEV NOTE: unlike every other coach write path migrated so far, this
  // needs two hash-signed "capability object" records issued elsewhere
  // (see beta17_coach_managed_service.ts's assertRecordIntegrity) rather
  // than deriving authorization from the session alone: coach_profile
  // comes from /account/detail's bootstrap field (same session.bootstrap
  // /account/session also returns), and relationship is the matching
  // entry's own .relationship field from /coach-workspace/relationships -
  // the exact same raw beta17_coach_relationship record app.js's
  // state.coachAthletes[].relationship used to hold. Mirrors
  // useCoachReview.ts's recordNote() exactly, just scoped to the currently
  // open athlete profile instead of a review record.
  const submit = useCallback(async (noteText: string, visibility: string) => {
    if (!athleteUserId) return false;

    const trimmed = noteText.trim();
    if (!trimmed) {
      setState((current) => ({ ...current, submitError: "Enter a coach note." }));
      return false;
    }

    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const coachProfile = (account.bootstrap as JsonRecord | undefined)?.coach_profile;

      if (!coachProfile || typeof coachProfile !== "object") {
        throw new Error("Coach profile is not available yet.");
      }

      const relationships = await loadCoachRelationships(coachUserId);
      const relationshipEntry = relationships.find(
        (entry) => String(entry.athlete_user_id ?? "") === athleteUserId
      );
      const relationship = relationshipEntry?.relationship;

      if (!relationship || typeof relationship !== "object") {
        throw new Error("This coach-athlete relationship is not available.");
      }

      await submitCoachNote(
        {
          coach_profile: coachProfile,
          relationship,
          athlete_user_id: athleteUserId,
          session_id: state.sessionId,
          artefact_id: state.artefactId,
          note_text: trimmed,
          visibility
        },
        csrfToken
      );

      setState((current) => ({ ...current, submitting: false, composing: false }));
      await refresh(athleteUserId);
      return true;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        submitting: false,
        submitError: error instanceof Error ? error.message : "The coach note could not be recorded."
      }));
      return false;
    }
  }, [athleteUserId, state.sessionId, state.artefactId, refresh]);

  return { athleteUserId, ...state, cancelCompose, submit };
}
