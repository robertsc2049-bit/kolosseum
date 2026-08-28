import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  archiveStandaloneEvent,
  cancelStandaloneEvent,
  createStandaloneEventVersion,
  linkStandaloneEventAthlete,
  loadCoachRelationships,
  loadCoachTemplates,
  loadStandaloneEventDetail,
  unlinkStandaloneEventAthlete
} from "../../api/coachWorkspaceClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// DEV NOTE: FULL-UI-09C event detail/lifecycle (cancel/archive/re-version/
// link/unlink an athlete) - ported from the now-deleted event_lifecycle_ui.js
// (see coachWorkspaceClient.ts's DEV NOTE for why). Opens on
// kolosseum:open-event-detail, dispatched by route_bootstrap.js's
// coach_event_detail deep-link resolution and by CoachEventsLibraryPanel.tsx's
// "Open event" button - mirrors the kolosseum:open-session-review/
// kolosseum:open-athlete-profile-request precedent (an async-validated
// bridge event rather than a synchronous DOM lookup). A stale/invalid
// event_id dispatches kolosseum:coach-event-detail-not-found, which
// route_bootstrap.js's own listener reports via showRouteNotice() - the
// same pattern useCoachReview.ts's ATHLETE_NOT_FOUND_EVENT already
// established for coach_review_athlete deep links.
const OPEN_EVENT_DETAIL_EVENT = "kolosseum:open-event-detail";
const NOT_FOUND_EVENT = "kolosseum:coach-event-detail-not-found";
const EVENTS_CHANGED_EVENT = "kolosseum:coach-events-changed";

function actionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const payload = error.payload as JsonRecord | undefined;
    const details = payload?.details as JsonRecord | undefined;
    const reason = String(details?.reason ?? payload?.error ?? "event_action_failed");
    return titleCase(reason);
  }
  return "Event action failed";
}

export type CoachEventDetailState = {
  eventId: string;
  loading: boolean;
  error: string | null;
  detail: JsonRecord | null;
  linkableAthletes: JsonRecord[];
  linkableTemplates: JsonRecord[];
  actionPending: boolean;
  actionError: string | null;
  actionMessage: string | null;
};

const initialState: CoachEventDetailState = {
  eventId: "",
  loading: false,
  error: null,
  detail: null,
  linkableAthletes: [],
  linkableTemplates: [],
  actionPending: false,
  actionError: null,
  actionMessage: null
};

export function useCoachEventDetail() {
  const [state, setState] = useState<CoachEventDetailState>(initialState);

  const load = useCallback(async (eventId: string) => {
    setState((current) => ({ ...current, eventId, loading: true, error: null, detail: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [response, relationships, templates] = await Promise.all([
        loadStandaloneEventDetail(eventId),
        loadCoachRelationships(coachUserId),
        loadCoachTemplates(coachUserId)
      ]);
      const detail = response.detail && typeof response.detail === "object" ? (response.detail as JsonRecord) : null;
      const event = (detail?.event ?? {}) as JsonRecord;
      const linkedAthleteIds = new Set(
        (Array.isArray(detail?.linked_athletes) ? (detail!.linked_athletes as JsonRecord[]) : [])
          .map((entry) => String(entry.athlete_user_id ?? ""))
      );
      const linkableAthletes = relationships.filter(
        (entry) =>
          String(entry.relationship_state ?? "") === "accepted" &&
          entry.relationship_expired !== true &&
          !linkedAthleteIds.has(String(entry.athlete_user_id ?? ""))
      );
      const linkableTemplates = templates.filter(
        (template) => template.template_state === "active" && template.activity_id === event.activity_id
      );
      setState((current) => ({ ...current, loading: false, detail, linkableAthletes, linkableTemplates }));
    }
    catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        document.dispatchEvent(new CustomEvent(NOT_FOUND_EVENT));
        setState(initialState);
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: "This event record could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const close = useCallback(() => {
    setState(initialState);
    if (window.location.hash.startsWith("#/coach/events/")) {
      window.location.hash = "#/coach/events";
    }
  }, []);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setState((current) => ({ ...current, actionPending: true, actionError: null, actionMessage: null }));
    try {
      await action();
      setState((current) => ({ ...current, actionPending: false, actionMessage: successMessage }));
    }
    catch (error) {
      setState((current) => ({ ...current, actionPending: false, actionError: actionErrorMessage(error) }));
    }
  }, []);

  const createVersion = useCallback((eventId: string, fields: JsonRecord, expectedCurrentRecordSha256: string) => {
    return runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await createStandaloneEventVersion(eventId, { ...fields, expected_current_record_sha256: expectedCurrentRecordSha256 }, csrfToken);
      document.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
      await load(eventId);
    }, "New event version created.");
  }, [load, runAction]);

  const cancelEvent = useCallback((eventId: string, expectedCurrentRecordSha256: string) => {
    return runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await cancelStandaloneEvent(eventId, expectedCurrentRecordSha256, csrfToken);
      document.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
      await load(eventId);
    }, "Event cancelled.");
  }, [load, runAction]);

  const archiveEvent = useCallback((eventId: string, expectedCurrentRecordSha256: string) => {
    return runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await archiveStandaloneEvent(eventId, expectedCurrentRecordSha256, csrfToken);
      document.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
      await load(eventId);
    }, "Event archived.");
  }, [load, runAction]);

  const linkAthlete = useCallback((eventId: string, athleteUserId: string, templateId: string) => {
    return runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await linkStandaloneEventAthlete(
        eventId,
        athleteUserId,
        { template_id: templateId, request_id: `event_link_${Date.now()}` },
        csrfToken
      );
      document.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
      await load(eventId);
    }, "Athlete linked.");
  }, [load, runAction]);

  const unlinkAthlete = useCallback((eventId: string, athleteUserId: string) => {
    return runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await unlinkStandaloneEventAthlete(eventId, athleteUserId, csrfToken);
      document.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
      await load(eventId);
    }, "Athlete unlinked. Historical records retained.");
  }, [load, runAction]);

  useEffect(() => {
    function handleOpen(event: Event) {
      const eventId = (event as CustomEvent<{ event_id?: string }>).detail?.event_id;
      if (eventId) load(eventId);
    }
    document.addEventListener(OPEN_EVENT_DETAIL_EVENT, handleOpen);
    return () => document.removeEventListener(OPEN_EVENT_DETAIL_EVENT, handleOpen);
  }, [load]);

  return { ...state, close, createVersion, cancelEvent, archiveEvent, linkAthlete, unlinkAthlete };
}
