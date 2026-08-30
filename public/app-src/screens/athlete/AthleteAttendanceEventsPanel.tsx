import React from "react";

import { type JsonRecord } from "../../api/transport";
import { useAthleteAttendanceEvents } from "./useAthleteAttendanceEvents";

function formatOccurrence(occurrence: JsonRecord): string {
  const date = String(occurrence.occurrence_date ?? "");
  const start = occurrence.start_time ? String(occurrence.start_time) : null;
  const end = occurrence.end_time ? String(occurrence.end_time) : null;
  if (start && end) return `${date}, ${start}–${end}`;
  if (start) return `${date}, ${start}`;
  return date;
}

function rsvpLabel(state: string | null): string {
  if (state === "attending") return "Attending";
  if (state === "maybe") return "Maybe";
  if (state === "not_attending") return "Not attending";
  return "No response yet";
}

export function AthleteAttendanceEventsPanel() {
  const { loading, error, occurrences, retry, rsvp, rsvpError } = useAthleteAttendanceEvents();

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h3>Your events</h3>
          <p className="muted">Events you've been invited to. Let your coach know if you're coming.</p>
        </div>
      </div>

      {rsvpError ? <p className="form-error" role="alert">{rsvpError}</p> : null}

      {loading && occurrences.length === 0 ? (
        <p className="dashboard-status" role="status" aria-live="polite">Loading your events…</p>
      ) : error ? (
        <div className="dashboard-status error" role="status" aria-live="polite">
          <span>{error}</span>
          <button className="button secondary status-retry-button" type="button" onClick={() => retry()}>Retry</button>
        </div>
      ) : occurrences.length === 0 ? (
        <div className="empty-state">
          <p>No upcoming events yet.</p>
        </div>
      ) : (
        <div className="record-list">
          {occurrences.map((occurrence) => (
            <article className="record-card" key={String(occurrence.occurrence_id)}>
              <div className="record-meta">
                <span className="badge neutral">{rsvpLabel(occurrence.my_rsvp_state as string | null)}</span>
              </div>
              <strong>{String(occurrence.title ?? "")}</strong>
              <p className="muted small">{formatOccurrence(occurrence)}</p>
              {occurrence.location ? <p className="muted small">{String(occurrence.location)}</p> : null}
              <div className="button-row">
                <button
                  className="button secondary small-button"
                  type="button"
                  onClick={() => rsvp(String(occurrence.occurrence_id), "attending")}
                >
                  Attending
                </button>
                <button
                  className="button secondary small-button"
                  type="button"
                  onClick={() => rsvp(String(occurrence.occurrence_id), "maybe")}
                >
                  Maybe
                </button>
                <button
                  className="button secondary small-button"
                  type="button"
                  onClick={() => rsvp(String(occurrence.occurrence_id), "not_attending")}
                >
                  Not attending
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
