import { useCallback, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { createCoachEvent } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's (removed) COACH_EVENT_TYPES/
// syncCoachEventTypeOptions()/renderCoachEventPreview()/createCoachEvent().
// The event library (metric counts + event card list) is already React -
// see CoachEventsLibraryPanel.tsx/useCoachEventsLibrary.ts, which refetches
// on the kolosseum:coach-events-changed dispatch below, same as legacy's
// renderCoachEvents() used to trigger. #refreshEventsButton/
// #exportEventsCalendarLink stay legacy - they're siblings of this form,
// not part of it.
const CHANGED_EVENT = "kolosseum:coach-events-changed";

const EVENT_TYPES_BY_ACTIVITY: Record<string, ReadonlyArray<readonly [string, string]>> = {
  powerlifting: [
    ["powerlifting_meet", "Powerlifting meet"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ],
  general_strength: [
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ],
  rugby_union: [
    ["rugby_match", "Rugby match"],
    ["rugby_tournament", "Rugby tournament"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ],
  strongman: [
    ["strongman_competition", "Strongman competition"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ]
};

export function eventTypesForActivity(activityId: string): ReadonlyArray<readonly [string, string]> {
  return EVENT_TYPES_BY_ACTIVITY[activityId] ?? EVENT_TYPES_BY_ACTIVITY.powerlifting;
}

function dateOnlyEpochDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

export function availableWeeksLabel(startDate: string, eventDate: string): string {
  const from = dateOnlyEpochDay(startDate);
  const to = dateOnlyEpochDay(eventDate);
  if (from === null || to === null) return "—";
  const days = to - from;
  return days > 0 ? String(Math.ceil(days / 7)) : "—";
}

export type CoachEventCreateFields = {
  eventName: string;
  location: string;
  timezone: string;
  notes: string;
};

export function useCoachEventCreate() {
  const [activityId, setActivityIdRaw] = useState("powerlifting");
  const [eventType, setEventType] = useState<string>(eventTypesForActivity("powerlifting")[0][0]);
  const [programmeStartDate, setProgrammeStartDate] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const setActivityId = useCallback((nextActivityId: string) => {
    setActivityIdRaw(nextActivityId);
    const options = eventTypesForActivity(nextActivityId);
    setEventType((current) => (options.some(([value]) => value === current) ? current : options[0][0]));
  }, []);

  const create = useCallback(async (fields: CoachEventCreateFields) => {
    setSubmitting(true);
    setError(null);
    setResultMessage(null);
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const timestamp = new Date().toISOString();

      const response = await createCoachEvent(
        {
          coach_user_id: coachUserId,
          event_id: "",
          event_name: fields.eventName.trim(),
          activity_id: activityId,
          event_type: eventType,
          programme_start_date: programmeStartDate,
          event_date: eventDate,
          location: fields.location.trim(),
          timezone: fields.timezone.trim() || "Europe/London",
          notes: fields.notes.trim(),
          created_at_iso8601: timestamp,
          updated_at_iso8601: timestamp
        },
        csrfToken
      );

      const eventRecord = response.event as JsonRecord | undefined;
      const eventPlan = eventRecord?.event_plan as JsonRecord | undefined;

      setSubmitting(false);
      setProgrammeStartDate("");
      setEventDate("");
      setResultMessage(`${String(eventPlan?.event_name ?? "Event")} compiled.`);
      document.dispatchEvent(new CustomEvent(CHANGED_EVENT));
      return true;
    }
    catch (error_) {
      setSubmitting(false);
      setError(error_ instanceof Error ? error_.message : "The event could not be compiled.");
      return false;
    }
  }, [activityId, eventType, programmeStartDate, eventDate]);

  return {
    activityId,
    setActivityId,
    eventType,
    setEventType,
    programmeStartDate,
    setProgrammeStartDate,
    eventDate,
    setEventDate,
    submitting,
    error,
    resultMessage,
    create
  };
}
