import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachRelationships } from "../../api/coachWorkspaceClient";
import { createAttendanceEvent } from "../../api/attendanceEventsClient";
import { type JsonRecord } from "../../api/transport";

const CHANGED_EVENT = "kolosseum:attendance-events-changed";

export type AcceptedAthleteOption = Readonly<{ athlete_user_id: string; display_name: string }>;

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
          athlete_user_ids: selectedAthleteIds
        },
        csrfToken
      );

      const event = response.event as JsonRecord | undefined;
      setSubmitting(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setActivityLabel("");
      setOccurrenceDate("");
      setStartTime("");
      setEndTime("");
      setSelectedAthleteIds([]);
      setResultMessage(`${String(event?.title ?? "Event")} created.`);
      document.dispatchEvent(new CustomEvent(CHANGED_EVENT));
      return true;
    }
    catch (error_) {
      setSubmitting(false);
      setError(error_ instanceof Error ? error_.message : "The event could not be created.");
      return false;
    }
  }, [title, description, location, activityLabel, timezone, occurrenceDate, startTime, endTime, selectedAthleteIds]);

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
    submitting,
    error,
    resultMessage,
    create
  };
}
