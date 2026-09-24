import React from "react";

import { useAttendanceEventCreate, WEEKDAY_OPTIONS } from "./useAttendanceEventCreate";

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
    sharedOrgOptions,
    inviteScope, chooseInviteScope,
    selectedOrgId, chooseOrgId,
    orgAthletes,
    selectedAthleteIds,
    toggleAthlete,
    repeats, setRepeats,
    frequency, setFrequency,
    interval, setInterval,
    weekdays, toggleWeekday,
    endsType, setEndsType,
    endsOnDate, setEndsOnDate,
    endsAfterCount, setEndsAfterCount,
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
          <legend>Repeats</legend>
          <label className="checkbox-field">
            <input type="checkbox" checked={repeats} onChange={(event) => setRepeats(event.target.checked)} />
            <span>This event repeats</span>
          </label>

          {repeats ? (
            <div className="recurrence-fields">
              <label className="field">
                <span>Frequency</span>
                <select value={frequency} onChange={(event) => setFrequency(event.target.value as "daily" | "weekly")}>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>

              <label className="field">
                <span>Every</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={interval}
                  onChange={(event) => setInterval(event.target.value)}
                />
                <span className="muted small">{frequency === "weekly" ? "week(s)" : "day(s)"}</span>
              </label>

              {frequency === "weekly" ? (
                <fieldset>
                  <legend>On these days</legend>
                  {WEEKDAY_OPTIONS.map((option) => (
                    <label key={option.token} className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={weekdays.includes(option.token)}
                        onChange={() => toggleWeekday(option.token)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              <fieldset>
                <legend>Ends</legend>
                <label className="radio-field">
                  <input
                    type="radio"
                    name="attendance-ends-type"
                    checked={endsType === "after_count"}
                    onChange={() => setEndsType("after_count")}
                  />
                  <span>After a number of occurrences</span>
                </label>
                <label className="field">
                  <span>Number of occurrences</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={endsAfterCount}
                    disabled={endsType !== "after_count"}
                    onChange={(event) => setEndsAfterCount(event.target.value)}
                  />
                </label>

                <label className="radio-field">
                  <input
                    type="radio"
                    name="attendance-ends-type"
                    checked={endsType === "on_date"}
                    onChange={() => setEndsType("on_date")}
                  />
                  <span>On a specific date</span>
                </label>
                <label className="field">
                  <span>End date</span>
                  <input
                    type="date"
                    value={endsOnDate}
                    disabled={endsType !== "on_date"}
                    onChange={(event) => setEndsOnDate(event.target.value)}
                  />
                </label>
              </fieldset>
            </div>
          ) : null}
        </fieldset>

        {sharedOrgOptions.length > 0 ? (
          <fieldset>
            <legend>Who is this event for</legend>
            <label className="radio-field">
              <input
                type="radio"
                name="attendance-invite-scope"
                checked={inviteScope === "own"}
                onChange={() => chooseInviteScope("own")}
              />
              <span>My own athletes</span>
            </label>
            {sharedOrgOptions.map((org) => (
              <label key={org.org_id} className="radio-field">
                <input
                  type="radio"
                  name="attendance-invite-scope"
                  checked={inviteScope === "org" && selectedOrgId === org.org_id}
                  onChange={() => { chooseInviteScope("org"); chooseOrgId(org.org_id); }}
                />
                <span>Everyone in {org.org_name}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <fieldset>
          <legend>Invite athletes</legend>
          {(inviteScope === "org" ? orgAthletes : acceptedAthletes).length === 0 ? (
            <p className="muted small">
              {inviteScope === "org" ? "No accepted athletes in this team yet." : "No connected athletes yet."}
            </p>
          ) : (
            (inviteScope === "org" ? orgAthletes : acceptedAthletes).map((athlete) => (
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
