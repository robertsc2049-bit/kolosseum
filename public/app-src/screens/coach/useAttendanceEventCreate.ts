import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachRelationships } from "../../api/coachWorkspaceClient";
import { createAttendanceEvent, type RecurrenceRuleInput } from "../../api/attendanceEventsClient";
import { type JsonRecord } from "../../api/transport";

const CHANGED_EVENT = "kolosseum:attendance-events-changed";

export type AcceptedAthleteOption = Readonly<{ athlete_user_id: string; display_name: string }>;

export const WEEKDAY_OPTIONS: ReadonlyArray<Readonly<{ token: string; label: string }>> = [
  { token: "mon", label: "Mon" },
  { token: "tue", label: "Tue" },
  { token: "wed", label: "Wed" },
  { token: "thu", label: "Thu" },
  { token: "fri", label: "Fri" },
  { token: "sat", label: "Sat" },
  { token: "sun", label: "Sun" }
];

export function useAttendanceEventCreate() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [activityLabel, setActivityLabel] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [acceptedAthletes, setAcceptedAthletes] = useState<AcceptedAthleteOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [interval, setInterval_] = useState("1");
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [endsType, setEndsType] = useState<"on_date" | "after_count">("after_count");
  const [endsOnDate, setEndsOnDate] = useState("");
  const [endsAfterCount, setEndsAfterCount] = useState("10");

  const toggleWeekday = useCallback((token: string) => {
    setWeekdays((current) =>
      current.includes(token) ? current.filter((value) => value !== token) : [...current, token]
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const account = await loadAccountDetail();
        const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
        if (!coachUserId) return;
        const relationships = await loadCoachRelationships(coachUserId);
        if (cancelled) return;
        setAcceptedAthletes(
          relationships
            .filter((relationship) => relationship.relationship_state === "accepted")
            .map((relationship) => ({
              athlete_user_id: String(relationship.athlete_user_id ?? ""),
              display_name: String(relationship.display_name ?? relationship.athlete_user_id ?? "")
            }))
        );
      }
      catch {
        // Leave acceptedAthletes empty - the create form simply shows no
        // invite candidates rather than a hard failure blocking the form.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleAthlete = useCallback((athleteUserId: string) => {
    setSelectedAthleteIds((current) =>
      current.includes(athleteUserId)
        ? current.filter((id) => id !== athleteUserId)
        : [...current, athleteUserId]
    );
  }, []);

  const create = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setResultMessage(null);

    if (repeats && frequency === "weekly" && weekdays.length === 0) {
      setSubmitting(false);
      setError("Pick at least one weekday for a weekly series.");
      return false;
    }
    if (repeats && endsType === "on_date" && !endsOnDate) {
      setSubmitting(false);
      setError("Pick an end date for the series.");
      return false;
    }

    let recurrenceRule: RecurrenceRuleInput | null = null;
    if (repeats) {
      const parsedInterval = Number.parseInt(interval, 10);
      recurrenceRule = {
        frequency,
        interval: Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1,
        weekdays: frequency === "weekly" ? weekdays : [],
        ends: endsType === "on_date"
          ? { type: "on_date", value: endsOnDate }
          : { type: "after_count", value: Number.parseInt(endsAfterCount, 10) || 1 }
      };
    }

    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";

      const response = await createAttendanceEvent(
        {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          activity_label: activityLabel.trim(),
          timezone: timezone.trim() || "Europe/London",
          occurrence_date: occurrenceDate,
          start_time: startTime || null,
          end_time: endTime || null,
          athlete_user_ids: selectedAthleteIds,
          recurrence_rule: recurrenceRule
        },
        csrfToken
      );

      const event = response.event as JsonRecord | undefined;
      const occurrenceCount = Array.isArray(response.occurrences) ? response.occurrences.length : 1;
      setSubmitting(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setActivityLabel("");
      setOccurrenceDate("");
      setStartTime("");
      setEndTime("");
      setSelectedAthleteIds([]);
      setRepeats(false);
      setFrequency("weekly");
      setInterval_("1");
      setWeekdays([]);
      setEndsType("after_count");
      setEndsOnDate("");
      setEndsAfterCount("10");
      setResultMessage(
        occurrenceCount > 1
          ? `${String(event?.title ?? "Event")} created (${occurrenceCount} occurrences).`
          : `${String(event?.title ?? "Event")} created.`
      );
      document.dispatchEvent(new CustomEvent(CHANGED_EVENT));
      return true;
    }
    catch (error_) {
      setSubmitting(false);
      setError(error_ instanceof Error ? error_.message : "The event could not be created.");
      return false;
    }
  }, [
    title, description, location, activityLabel, timezone, occurrenceDate, startTime, endTime, selectedAthleteIds,
    repeats, frequency, interval, weekdays, endsType, endsOnDate, endsAfterCount
  ]);

  return {
    title, setTitle,
    description, setDescription,
    location, setLocation,
    activityLabel, setActivityLabel,
    timezone, setTimezone,
    occurrenceDate, setOccurrenceDate,
    startTime, setStartTime,
    endTime, setEndTime,
    acceptedAthletes,
    selectedAthleteIds,
    toggleAthlete,
    repeats, setRepeats,
    frequency, setFrequency,
    interval, setInterval: setInterval_,
    weekdays, toggleWeekday,
    endsType, setEndsType,
    endsOnDate, setEndsOnDate,
    endsAfterCount, setEndsAfterCount,
    submitting,
    error,
    resultMessage,
    create
  };
}
