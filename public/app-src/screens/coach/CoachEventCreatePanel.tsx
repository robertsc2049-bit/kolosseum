import React, { useRef } from "react";

import { countdownLabel } from "../../utils/format";
import { availableWeeksLabel, eventTypesForActivity, useCoachEventCreate } from "./useCoachEventCreate";

// DEV NOTE: ported from index.html's #eventForm ("Compile event"). The
// event library (metric cards + event list) is React already - see
// CoachEventsLibraryPanel.tsx - and refetches once this form dispatches
// kolosseum:coach-events-changed after a successful compile.
export function CoachEventCreatePanel() {
  const {
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
  } = useCoachEventCreate();

  const eventNameRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await create({
      eventName: eventNameRef.current?.value ?? "",
      location: locationRef.current?.value ?? "",
      timezone: timezoneRef.current?.value ?? "",
      notes: notesRef.current?.value ?? ""
    });
    if (ok) {
      if (eventNameRef.current) eventNameRef.current.value = "";
      if (locationRef.current) locationRef.current.value = "";
      if (timezoneRef.current) timezoneRef.current.value = "Europe/London";
      if (notesRef.current) notesRef.current.value = "";
    }
  }

  return (
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">New event</p>
        <h3>Compile event</h3>
      </div>

      <label className="field">
        <span>Event name</span>
        <input ref={eventNameRef} required maxLength={120} placeholder="British Championships" />
      </label>

      <label className="field">
        <span>Activity</span>
        <select value={activityId} onChange={(event) => setActivityId(event.target.value)}>
          <option value="powerlifting">Powerlifting</option>
          <option value="general_strength">General strength</option>
          <option value="rugby_union">Rugby union</option>
        </select>
      </label>

      <label className="field">
        <span>Event type</span>
        <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
          {eventTypesForActivity(activityId).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <div className="profile-settings-grid">
        <label className="field">
          <span>Preparation start date</span>
          <input type="date" required value={programmeStartDate} onChange={(event) => setProgrammeStartDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Event date</span>
          <input type="date" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Location</span>
        <input ref={locationRef} maxLength={200} placeholder="Optional venue or town" />
      </label>

      <label className="field">
        <span>Timezone</span>
        <input ref={timezoneRef} maxLength={80} defaultValue="Europe/London" />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea ref={notesRef} maxLength={1000} placeholder="Factual event details only"></textarea>
      </label>

      <div className="event-compiler-summary standalone-event-summary">
        <div><span>Countdown</span><strong>{eventDate ? countdownLabel(eventDate) : "Set event date"}</strong></div>
        <div><span>Available weeks</span><strong>{availableWeeksLabel(programmeStartDate, eventDate)}</strong></div>
      </div>

      {error ? <p role="status" className="muted small error">{error}</p> : null}
      {resultMessage ? <p role="status" className="muted small">{resultMessage}</p> : null}

      <button className="button primary" type="submit" disabled={submitting}>Compile event</button>
    </form>
  );
}
