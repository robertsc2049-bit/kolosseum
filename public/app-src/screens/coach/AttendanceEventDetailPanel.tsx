import React from "react";

import { type JsonRecord } from "../../api/transport";
import { useAttendanceEventDetail } from "./useAttendanceEventDetail";

function rsvpLabel(state: string | null): string {
  if (state === "attending") return "Attending";
  if (state === "maybe") return "Maybe";
  if (state === "not_attending") return "Not attending";
  return "No response yet";
}

function formatOccurrence(occurrence: JsonRecord): string {
  const date = String(occurrence.occurrence_date ?? "");
  const start = occurrence.start_time ? String(occurrence.start_time) : null;
  const end = occurrence.end_time ? String(occurrence.end_time) : null;
  if (start && end) return `${date}, ${start}–${end}`;
  if (start) return `${date}, ${start}`;
  return date;
}

function EventDetail({
  detail,
  detailError,
  onCancel,
  onClose
}: {
  detail: JsonRecord | null;
  detailError: string | null;
  onCancel: () => void;
  onClose: () => void;
}) {
  if (detailError) {
    return (
      <div className="dashboard-status error" role="status" aria-live="polite">
        <span>{detailError}</span>
        <button className="button secondary" type="button" onClick={onClose}>Back</button>
      </div>
    );
  }

  if (!detail) {
    return <p className="dashboard-status" role="status" aria-live="polite">Loading event…</p>;
  }

  const event = (detail.event ?? {}) as JsonRecord;
  const occurrences = Array.isArray(detail.occurrences) ? (detail.occurrences as JsonRecord[]) : [];
  const roster = Array.isArray(detail.roster) ? (detail.roster as JsonRecord[]) : [];
  const cancelled = event.status === "cancelled";

  return (
    <div className="record-card attendance-event-detail">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <span className={`badge ${cancelled ? "neutral" : "active"}`}>{cancelled ? "Cancelled" : "Active"}</span>
          <h3>{String(event.title ?? "")}</h3>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>Back</button>
      </div>

      {event.location ? <p className="muted">{String(event.location)}</p> : null}
      {event.description ? <p>{String(event.description)}</p> : null}

      {occurrences.map((occurrence) => (
        <p key={String(occurrence.occurrence_id)} className="muted small">{formatOccurrence(occurrence)}</p>
      ))}

      <h4>Attendees</h4>
      {roster.length === 0 ? (
        <p className="muted small">No athletes invited yet.</p>
      ) : (
        <div className="record-list">
          {roster.map((entry) => {
            const rsvpByOccurrence = (entry.rsvp_by_occurrence ?? {}) as Record<string, string | null>;
            const firstOccurrenceId = occurrences[0] ? String(occurrences[0].occurrence_id) : null;
            const state = firstOccurrenceId ? rsvpByOccurrence[firstOccurrenceId] ?? null : null;
            return (
              <article className="record-card" key={String(entry.athlete_user_id)}>
                <strong>{String(entry.display_name ?? entry.athlete_user_id)}</strong>
                <span className="badge neutral">{rsvpLabel(state)}</span>
              </article>
            );
          })}
        </div>
      )}

      {!cancelled ? (
        <div className="button-row">
          <button className="button secondary" type="button" onClick={onCancel}>Cancel event</button>
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceEventDetailPanel() {
  const {
    loading,
    error,
    events,
    retry,
    selectedEventId,
    detail,
    detailError,
    selectEvent,
    closeDetail,
    cancel
  } = useAttendanceEventDetail();

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h3>Your events</h3>
        </div>
      </div>

      {selectedEventId ? (
        <EventDetail
          detail={detail}
          detailError={detailError}
          onCancel={() => cancel(selectedEventId)}
          onClose={closeDetail}
        />
      ) : loading && events.length === 0 ? (
        <p className="dashboard-status" role="status" aria-live="polite">Loading events…</p>
      ) : error ? (
        <div className="dashboard-status error" role="status" aria-live="polite">
          <span>{error}</span>
          <button className="button secondary status-retry-button" type="button" onClick={() => retry()}>Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No events created yet.</p>
        </div>
      ) : (
        <div className="record-list">
          {events.map((event) => (
            <article className="record-card" key={String(event.event_id)}>
              <div className="record-meta">
                <span className={`badge ${event.status === "cancelled" ? "neutral" : "active"}`}>
                  {event.status === "cancelled" ? "Cancelled" : "Active"}
                </span>
              </div>
              <strong>{String(event.title ?? "")}</strong>
              <button
                className="button secondary small-button"
                type="button"
                onClick={() => selectEvent(String(event.event_id))}
              >
                Open event
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
