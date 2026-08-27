import React from "react";

import { type JsonRecord } from "../../api/transport";
import { countdownLabel, formatDate, titleCase } from "../../utils/format";
import { type AssignmentEntry, useAthleteProfileAssignment } from "./useAthleteProfileAssignment";

// DEV NOTE: ported from index.html's #athleteAssignmentPanel ("Programme
// assignment / Assign from athlete profile"). See
// useAthleteProfileAssignment.ts for the eligibility-check and mutation
// logic, and its DEV NOTE for the still-dead standalone #view-assign twin
// this deliberately leaves untouched.

function assignmentStateBadgeClass(status: string): string {
  if (status === "cancelled") return "warning";
  if (status === "replaced") return "neutral";
  return "complete";
}

function assignmentStateBadgeLabel(status: string): string {
  if (status === "cancelled") return "Cancelled";
  if (status === "replaced") return "Replaced";
  return "Current";
}

function AssignmentHistoryCard({ entry }: { entry: AssignmentEntry }) {
  return (
    <article className="record-card assignment-history-card" data-assignment-id={entry.assignmentId}>
      <div>
        <h4>{entry.templateName}</h4>
        <p>{titleCase(entry.activityId || "training")} · {formatDate(entry.recordedAt)}</p>
        <p className="muted small">Assignment {entry.assignmentId}</p>
        {entry.preservedSessionCount > 0 ? (
          <p className="muted small">{entry.preservedSessionCount} prior session{entry.preservedSessionCount === 1 ? "" : "s"} preserved.</p>
        ) : null}
      </div>
      <div className="record-meta">
        <span className={`badge ${assignmentStateBadgeClass(entry.assignmentStatus)}`}>{assignmentStateBadgeLabel(entry.assignmentStatus)}</span>
        <span className="badge neutral">Version {entry.templateVersion}</span>
      </div>
    </article>
  );
}

export function AthleteProfileAssignmentPanel() {
  const {
    athleteUserId,
    loading,
    error,
    activeTemplates,
    activeEvents,
    assignments,
    eventLinks,
    templates,
    currentAssignment,
    requirements,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedEventId,
    setSelectedEventId,
    submitting,
    resultMessage,
    assign,
    cancel
  } = useAthleteProfileAssignment();

  if (!athleteUserId || loading) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const selectedTemplate = activeTemplates.find((template) => String(template.template_id ?? "") === selectedTemplateId);
    if (!selectedTemplate || !requirements.canSubmit) return;

    const selectedEvent = activeEvents.find((entry) => String(entry.event_id ?? "") === selectedEventId);
    const eventName = selectedEvent ? String((selectedEvent.event_plan as JsonRecord | undefined)?.event_name ?? "the event") : "";

    const confirmation = currentAssignment
      ? `Replace ${currentAssignment.templateName} version ${currentAssignment.templateVersion} with ${selectedTemplate.template_name} version ${Number(selectedTemplate.template_version)}${eventName ? ` linked to ${eventName}` : " without an event link"}? Existing compiled sessions remain unchanged.`
      : `Assign ${selectedTemplate.template_name} version ${Number(selectedTemplate.template_version)}${eventName ? ` and link ${eventName}` : " without an event link"}?`;

    if (!window.confirm(confirmation)) return;
    await assign();
  }

  async function handleCancel() {
    if (!currentAssignment) return;
    const confirmation = `Cancel ${currentAssignment.templateName} version ${currentAssignment.templateVersion}? Future sessions cannot be created from it. Existing compiled sessions and history remain unchanged.`;
    if (!window.confirm(confirmation)) return;
    await cancel();
  }

  return (
    <section className="athlete-assignment-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Programme assignment</p>
          <h3>Assign from athlete profile</h3>
          <p className="muted">Select an active programme and optionally link it to a compiled event.</p>
        </div>
      </div>

      <form className="athlete-assignment-form" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
        <label className="field">
          <span>Event</span>
          <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
            <option value="">No event link</option>
            {activeEvents.map((eventRecord) => {
              const plan = (eventRecord.event_plan as JsonRecord | undefined) ?? {};
              return (
                <option key={String(eventRecord.event_id)} value={String(eventRecord.event_id)}>
                  {String(plan.event_name ?? "Event")} · {formatDate(plan.event_date)}
                </option>
              );
            })}
          </select>
        </label>

        <label className="field">
          <span>Programme</span>
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} disabled={activeTemplates.length === 0}>
            <option value="">{activeTemplates.length ? "No active programmes" : "No active programmes for this activity"}</option>
            {activeTemplates.map((template) => (
              <option key={String(template.template_id)} value={String(template.template_id)}>
                {String(template.template_name)} · v{Number(template.template_version)}
              </option>
            ))}
          </select>
        </label>

        <div className="assignment-current-state">
          {currentAssignment ? (
            <article className="record-card assignment-current-card">
              <div>
                <p className="eyebrow">Current assignment</p>
                <h4>{currentAssignment.templateName}</h4>
                <p>{titleCase(currentAssignment.activityId || "training")} · Version {currentAssignment.templateVersion}</p>
                <p className="muted small">Assigned {formatDate(currentAssignment.recordedAt)}</p>
              </div>
              <span className="badge complete">Assigned</span>
            </article>
          ) : (
            <div className="empty-state compact-empty"><p>No current programme assignment.</p></div>
          )}
        </div>

        <div className={`assignment-requirements ${requirements.className}`}>{requirements.message}</div>

        <div className="assignment-action-row">
          <button className="button primary" type="submit" disabled={submitting || !requirements.canSubmit}>
            {currentAssignment ? "Replace assignment" : "Assign programme"}
          </button>
          {currentAssignment ? (
            <button className="button danger" type="button" disabled={submitting} onClick={() => { handleCancel().catch(() => {}); }}>
              Cancel future assignment
            </button>
          ) : null}
        </div>

        {resultMessage ? <p className="inline-result">{resultMessage}</p> : null}

        <div>
          <p className="eyebrow">Assignment history</p>
          <div className="athlete-assignment-history">
            {assignments.length === 0 ? (
              <div className="empty-state compact-empty">
                <h4>No assignment history</h4>
                <p>Programme assignments will appear here after they are recorded.</p>
              </div>
            ) : (
              [...assignments]
                .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
                .map((entry) => <AssignmentHistoryCard key={entry.assignmentId} entry={entry} />)
            )}
          </div>
        </div>
      </form>

      <div className="panel-header athlete-event-links-header">
        <div><p className="eyebrow">Event links</p><h3>Linked assignments</h3></div>
      </div>
      <div className="record-list">
        {eventLinks.length === 0 ? (
          <div className="empty-state compact-empty"><p>The current assignment has no event link.</p></div>
        ) : (
          eventLinks.map((link, index) => {
            const eventRecord = (link.event as JsonRecord | undefined) ?? {};
            const plan = (eventRecord.event_plan as JsonRecord | undefined) ?? {};
            const template = templates.find((entry) => String(entry.template_id ?? "") === String(link.template_id ?? ""));
            const templateName = String(template?.template_name ?? titleCase(String(link.template_id ?? "programme")));
            return (
              <article className="record-card athlete-event-link-card" key={String(link.event_id ?? index)}>
                <div>
                  <p className="eyebrow">Current event link</p>
                  <h3>{String(plan.event_name ?? "Event")}</h3>
                  <p>{formatDate(plan.event_date)}{plan.location ? ` · ${String(plan.location)}` : ""}</p>
                </div>
                <div className="record-meta">
                  <strong>{countdownLabel(plan.event_date as string | undefined)}</strong>
                  <span className="badge active">{templateName}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
