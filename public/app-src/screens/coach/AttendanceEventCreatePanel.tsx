import React from "react";

import { useAttendanceEventCreate } from "./useAttendanceEventCreate";

export function AttendanceEventCreatePanel() {
  const {
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
  } = useAttendanceEventCreate();

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h3>Create an event</h3>
          <p className="muted">Invite your accepted athletes to a class, practice or session, and see who's coming.</p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} />
        </label>

        <label className="field">
          <span>Location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} />
        </label>

        <label className="field">
          <span>Activity</span>
          <input value={activityLabel} onChange={(event) => setActivityLabel(event.target.value)} maxLength={80} placeholder="e.g. Powerlifting class" />
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" value={occurrenceDate} onChange={(event) => setOccurrenceDate(event.target.value)} required />
        </label>

        <label className="field">
          <span>Start time</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>

        <label className="field">
          <span>End time</span>
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>

        <label className="field">
          <span>Timezone</span>
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} maxLength={80} />
        </label>

        <fieldset>
          <legend>Invite athletes</legend>
          {acceptedAthletes.length === 0 ? (
            <p className="muted small">No connected athletes yet.</p>
          ) : (
            acceptedAthletes.map((athlete) => (
              <label key={athlete.athlete_user_id} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={selectedAthleteIds.includes(athlete.athlete_user_id)}
                  onChange={() => toggleAthlete(athlete.athlete_user_id)}
                />
                <span>{athlete.display_name}</span>
              </label>
            ))
          )}
        </fieldset>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {resultMessage ? <p className="form-success" role="status">{resultMessage}</p> : null}

        <div className="button-row">
          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create event"}
          </button>
        </div>
      </form>
    </div>
  );
}
