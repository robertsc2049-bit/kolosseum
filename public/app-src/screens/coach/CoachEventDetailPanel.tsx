import React, { useEffect, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { countdownLabel, formatDate, titleCase } from "../../utils/format";
import { useCoachEventDetail } from "./useCoachEventDetail";

// DEV NOTE: FULL-UI-09C event detail/lifecycle - see useCoachEventDetail.ts.
// Ported field-for-field from the now-deleted event_lifecycle_ui.js's
// renderEventDetail()/detailEditForm()/linkForm().

type VersionFields = {
  eventName: string;
  activityId: string;
  eventType: string;
  programmeStartDate: string;
  eventDate: string;
  location: string;
  timezone: string;
  notes: string;
};

function versionFieldsFromPlan(plan: JsonRecord, activityId: string): VersionFields {
  return {
    eventName: String(plan.event_name ?? ""),
    activityId,
    eventType: String(plan.event_type ?? ""),
    programmeStartDate: String(plan.programme_start_date ?? ""),
    eventDate: String(plan.event_date ?? ""),
    location: String(plan.location ?? ""),
    timezone: String(plan.timezone ?? "Europe/London"),
    notes: String(plan.notes ?? "")
  };
}

export function CoachEventDetailPanel() {
  const {
    eventId,
    loading,
    error,
    detail,
    linkableAthletes,
    linkableTemplates,
    actionPending,
    actionError,
    actionMessage,
    close,
    createVersion,
    cancelEvent,
    archiveEvent,
    linkAthlete,
    unlinkAthlete
  } = useCoachEventDetail();

  const event = (detail?.event ?? {}) as JsonRecord;
  const plan = (event.event_plan ?? {}) as JsonRecord;
  const recordSha256 = String(event.record_sha256 ?? "");

  const [versionFields, setVersionFields] = useState<VersionFields>(() => versionFieldsFromPlan(plan, String(event.activity_id ?? "powerlifting")));
  const [linkAthleteId, setLinkAthleteId] = useState("");
  const [linkTemplateId, setLinkTemplateId] = useState("");

  useEffect(() => {
    if (detail) {
      setVersionFields(versionFieldsFromPlan(plan, String(event.activity_id ?? "powerlifting")));
      setLinkAthleteId("");
      setLinkTemplateId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordSha256]);

  if (!eventId) return null;

  if (loading && !detail) {
    return (
      <section className="panel event-lifecycle-detail">
        <p className="muted">Loading event detail…</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="panel event-lifecycle-detail">
        <p role="status" className="muted small error">{error ?? "This event record could not be loaded."}</p>
        <button className="button secondary" type="button" onClick={close}>Close detail</button>
      </section>
    );
  }

  const active = event.event_status === "active";
  const linked = Array.isArray(detail.linked_athletes) ? (detail.linked_athletes as JsonRecord[]) : [];
  const historicalPreservation = (detail.historical_preservation ?? {}) as JsonRecord;

  function handleVersionSubmit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault();
    createVersion(
      eventId,
      {
        event_name: versionFields.eventName.trim(),
        activity_id: versionFields.activityId,
        event_type: versionFields.eventType.trim(),
        programme_start_date: versionFields.programmeStartDate,
        event_date: versionFields.eventDate,
        location: versionFields.location.trim(),
        timezone: versionFields.timezone.trim() || "Europe/London",
        notes: versionFields.notes.trim()
      },
      recordSha256
    );
  }

  function handleLinkSubmit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault();
    if (!linkAthleteId) return;
    linkAthlete(eventId, linkAthleteId, linkTemplateId);
  }

  function handleCancel() {
    if (!window.confirm(`Cancel ${plan.event_name || "this event"}?`)) return;
    cancelEvent(eventId, recordSha256);
  }

  function handleArchive() {
    if (!window.confirm(`Archive ${plan.event_name || "this event"}?`)) return;
    archiveEvent(eventId, recordSha256);
  }

  return (
    <section className="panel event-lifecycle-detail">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Event detail</p>
          <h3>{String(plan.event_name ?? "Event")}</h3>
          <p className="muted">Stable route · {eventId}</p>
        </div>
        <button className="button secondary" type="button" onClick={close}>Close detail</button>
      </div>

      {actionMessage ? <p role="status" className="muted small">{actionMessage}</p> : null}
      {actionError ? <p role="status" className="muted small error">{actionError}</p> : null}

      <div className="event-lifecycle-facts">
        <div><span>State</span><strong>{titleCase(event.event_status)}</strong></div>
        <div><span>Version</span><strong>{Number(event.event_version ?? 1)}</strong></div>
        <div><span>Countdown</span><strong>{countdownLabel(plan.event_date)}</strong></div>
        <div><span>Date</span><strong>{formatDate(plan.event_date)}</strong></div>
        <div><span>Activity</span><strong>{titleCase(event.activity_id)}</strong></div>
        <div><span>Type</span><strong>{titleCase(plan.event_type)}</strong></div>
        <div><span>Location</span><strong>{String(plan.location || "Not recorded")}</strong></div>
        <div><span>Timezone</span><strong>{String(plan.timezone || "Not recorded")}</strong></div>
        <div><span>Lifecycle records</span><strong>{Array.isArray(detail.lifecycle_records) ? detail.lifecycle_records.length : 0}</strong></div>
      </div>

      <p>{String(plan.notes || "No event notes recorded.")}</p>

      <div className="event-lifecycle-actions">
        {active ? <button className="button secondary" type="button" disabled={actionPending} onClick={handleCancel}>Cancel event</button> : null}
        {event.event_status !== "archived" ? <button className="button secondary" type="button" disabled={actionPending} onClick={handleArchive}>Archive event</button> : null}
      </div>

      <div className="event-lifecycle-grid">
        <article>
          <p className="eyebrow">Linked athletes</p>
          <div className="record-list">
            {linked.length ? linked.map((item) => {
              const athleteUserId = String(item.athlete_user_id ?? "");
              const linkedProgramme = item.linked_programme as JsonRecord | null;
              return (
                <article className="record-card event-lifecycle-athlete" key={athleteUserId}>
                  <div>
                    <h4>{String(item.display_name || athleteUserId)}</h4>
                    <p>{String(linkedProgramme?.template_name || "No linked programme")}</p>
                  </div>
                  <button
                    className="button secondary small-button"
                    type="button"
                    disabled={actionPending}
                    onClick={() => unlinkAthlete(eventId, athleteUserId)}
                  >
                    Unlink
                  </button>
                </article>
              );
            }) : <div className="empty-state compact-empty"><p>No athletes are currently linked.</p></div>}
          </div>

          {active ? (
            <form className="form-panel" onSubmit={handleLinkSubmit}>
              <p className="eyebrow">Link athlete</p>
              <label className="field">
                <span>Athlete</span>
                <select value={linkAthleteId} onChange={(linkEvent) => setLinkAthleteId(linkEvent.target.value)} required>
                  <option value="">Choose</option>
                  {linkableAthletes.map((athlete) => (
                    <option value={String(athlete.athlete_user_id)} key={String(athlete.athlete_user_id)}>
                      {String(athlete.display_name || athlete.athlete_user_id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Programme</span>
                <select value={linkTemplateId} onChange={(linkEvent) => setLinkTemplateId(linkEvent.target.value)}>
                  <option value="">No programme</option>
                  {linkableTemplates.map((template) => (
                    <option value={String(template.template_id)} key={String(template.template_id)}>
                      {String(template.template_name)} · v{Number(template.template_version ?? 1)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary" type="submit" disabled={actionPending || linkableAthletes.length === 0}>Link athlete</button>
            </form>
          ) : null}
        </article>

        <article>
          {active ? (
            <form className="form-panel" onSubmit={handleVersionSubmit}>
              <p className="eyebrow">New immutable version</p>
              <label className="field">
                <span>Event name</span>
                <input
                  value={versionFields.eventName}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, eventName: fieldEvent.target.value })}
                  required
                  maxLength={120}
                />
              </label>
              <label className="field">
                <span>Activity</span>
                <select
                  value={versionFields.activityId}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, activityId: fieldEvent.target.value })}
                >
                  <option value="powerlifting">Powerlifting</option>
                  <option value="general_strength">General strength</option>
                  <option value="rugby_union">Rugby union</option>
                  <option value="strongman">Strongman</option>
                </select>
              </label>
              <label className="field">
                <span>Event type</span>
                <input
                  value={versionFields.eventType}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, eventType: fieldEvent.target.value })}
                  required
                />
              </label>
              <div className="profile-settings-grid">
                <label className="field">
                  <span>Preparation start date</span>
                  <input
                    type="date"
                    value={versionFields.programmeStartDate}
                    onChange={(fieldEvent) => setVersionFields({ ...versionFields, programmeStartDate: fieldEvent.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Event date</span>
                  <input
                    type="date"
                    value={versionFields.eventDate}
                    onChange={(fieldEvent) => setVersionFields({ ...versionFields, eventDate: fieldEvent.target.value })}
                    required
                  />
                </label>
              </div>
              <label className="field">
                <span>Location</span>
                <input
                  value={versionFields.location}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, location: fieldEvent.target.value })}
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>Timezone</span>
                <input
                  value={versionFields.timezone}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, timezone: fieldEvent.target.value })}
                  maxLength={80}
                />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  value={versionFields.notes}
                  onChange={(fieldEvent) => setVersionFields({ ...versionFields, notes: fieldEvent.target.value })}
                  maxLength={1000}
                />
              </label>
              <button className="button primary" type="submit" disabled={actionPending}>Create new version</button>
            </form>
          ) : (
            <div className="empty-state compact-empty"><p>This event no longer accepts factual edits.</p></div>
          )}
        </article>
      </div>

      <details>
        <summary>Historical preservation</summary>
        <p>
          {Number(historicalPreservation.event_versions_retained ?? 0)} event records ·{" "}
          {Number(historicalPreservation.link_records_retained ?? 0)} link records ·{" "}
          {Number(historicalPreservation.assignment_records_retained ?? 0)} assignment records ·{" "}
          {Number(historicalPreservation.session_records_retained ?? 0)} session records.
        </p>
      </details>
    </section>
  );
}
