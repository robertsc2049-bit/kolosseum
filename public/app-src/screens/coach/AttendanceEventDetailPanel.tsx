import React, { useState } from "react";

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

function occurrenceStatusLabel(status: string): string {
  if (status === "skipped") return "Skipped";
  if (status === "rescheduled") return "Rescheduled";
  return "Scheduled";
}

function RescheduleForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (input: { new_date: string; new_start_time: string | null; new_end_time: string | null }) => void;
  onCancel: () => void;
}) {
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  return (
    <div className="reschedule-form">
      <label className="field">
        <span>New date</span>
        <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
      </label>
      <label className="field">
        <span>New start time</span>
        <input type="time" value={newStartTime} onChange={(event) => setNewStartTime(event.target.value)} />
      </label>
      <label className="field">
        <span>New end time</span>
        <input type="time" value={newEndTime} onChange={(event) => setNewEndTime(event.target.value)} />
      </label>
      <div className="button-row">
        <button
          className="button primary small-button"
          type="button"
          disabled={!newDate}
          onClick={() => onSubmit({ new_date: newDate, new_start_time: newStartTime || null, new_end_time: newEndTime || null })}
        >
          Confirm
        </button>
        <button className="button secondary small-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function OccurrenceRow({
  occurrence,
  roster,
  onSkip,
  onReschedule
}: {
  occurrence: JsonRecord;
  roster: JsonRecord[];
  onSkip: () => void;
  onReschedule: (input: { new_date: string; new_start_time: string | null; new_end_time: string | null }) => void;
}) {
  const [reschedulingOpen, setReschedulingOpen] = useState(false);
  const status = String(occurrence.status ?? "scheduled");
  const occurrenceId = String(occurrence.occurrence_id ?? "");
  const canAct = status !== "skipped";

  return (
    <div className="record-card attendance-occurrence-row">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <span>
          <span className={`badge ${status === "skipped" ? "neutral" : status === "rescheduled" ? "warning" : "active"}`}>
            {occurrenceStatusLabel(status)}
          </span>{" "}
          {formatOccurrence(occurrence)}
        </span>
        {canAct ? (
          <div className="button-row">
            <button className="button secondary small-button" type="button" onClick={() => setReschedulingOpen((open) => !open)}>
              Reschedule
            </button>
            <button className="button secondary small-button" type="button" onClick={onSkip}>Skip</button>
          </div>
        ) : null}
      </div>

      {status === "rescheduled" && occurrence.rescheduled_to_date ? (
        <p className="muted small">
          Moved to {String(occurrence.rescheduled_to_date)}
          {occurrence.rescheduled_to_start_time ? `, ${String(occurrence.rescheduled_to_start_time)}` : ""}
        </p>
      ) : null}

      {reschedulingOpen ? (
        <RescheduleForm
          onSubmit={(input) => { onReschedule(input); setReschedulingOpen(false); }}
          onCancel={() => setReschedulingOpen(false)}
        />
      ) : null}

      {roster.length > 0 ? (
        <div className="record-list">
          {roster.map((entry) => {
            const rsvpByOccurrence = (entry.rsvp_by_occurrence ?? {}) as Record<string, string | null>;
            const state = rsvpByOccurrence[occurrenceId] ?? null;
            return (
              <div className="record-meta" key={String(entry.athlete_user_id)}>
                <span>{String(entry.display_name ?? entry.athlete_user_id)}</span>
                <span className="badge neutral">{rsvpLabel(state)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EventDetail({
  detail,
  detailError,
  onCancel,
  onClose,
  onSkipOccurrence,
  onRescheduleOccurrence
}: {
  detail: JsonRecord | null;
  detailError: string | null;
  onCancel: () => void;
  onClose: () => void;
  onSkipOccurrence: (occurrenceId: string) => void;
  onRescheduleOccurrence: (occurrenceId: string, input: { new_date: string; new_start_time: string | null; new_end_time: string | null }) => void;
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
          {event.owner_scope === "org" ? <span className="badge neutral">Team event</span> : null}
          <h3>{String(event.title ?? "")}</h3>
        </div>
        <button className="button secondary" type="button" onClick={onClose}>Back</button>
      </div>

      {event.location ? <p className="muted">{String(event.location)}</p> : null}
      {event.description ? <p>{String(event.description)}</p> : null}

      <h4>Occurrences{occurrences.length > 1 ? ` (${occurrences.length})` : ""}</h4>
      {roster.length === 0 ? <p className="muted small">No athletes invited yet.</p> : null}
      {occurrences.map((occurrence) => (
        <OccurrenceRow
          key={String(occurrence.occurrence_id)}
          occurrence={occurrence}
          roster={roster}
          onSkip={() => onSkipOccurrence(String(occurrence.occurrence_id))}
          onReschedule={(input) => onRescheduleOccurrence(String(occurrence.occurrence_id), input)}
        />
      ))}

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
    cancel,
    skipOccurrence,
    rescheduleOccurrence
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
          onSkipOccurrence={(occurrenceId) => skipOccurrence(selectedEventId, occurrenceId)}
          onRescheduleOccurrence={(occurrenceId, input) => rescheduleOccurrence(selectedEventId, occurrenceId, input)}
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
                {event.owner_scope === "org" ? <span className="badge neutral">Team event</span> : null}
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
