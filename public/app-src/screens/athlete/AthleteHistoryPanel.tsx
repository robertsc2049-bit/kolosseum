import React, { useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useTrainingHistory } from "./useTrainingHistory";

// DEV NOTE: FULL-UI-16C athlete training history - ported from app.js's
// populateHistoryFilterOptions()/applyHistoryFilters()/
// clearHistoryFilters()/renderHistoryList()/historyRecordCard()/
// openHistoryDetail()/renderHistoryDetail()/renderVideoSubmissionCard().
// Filtering is server-side (a real round-trip per "Apply filters" click,
// unlike Marketplace's client-side search) - draft filter values are only
// sent to the server when Apply is clicked, matching legacy exactly.
// "Clear filters" is a cheap client-side reset back to the last unfiltered
// fetch, no round-trip, also matching legacy.

function exerciseName(exercise: JsonRecord | undefined): string {
  return String(
    exercise?.display_name ?? exercise?.exercise_name ?? exercise?.exercise_id ?? exercise?.item_id ?? "Exercise"
  );
}

function historyRecordStatusClass(executionStatus: string): string {
  if (executionStatus === "completed") return "complete";
  if (executionStatus === "partial") return "partial";
  if (executionStatus === "in_progress") return "active";
  return "neutral";
}

function renderVideoSubmissionCard(submission: JsonRecord, index: number) {
  const feedback = Array.isArray(submission.feedback) ? (submission.feedback as JsonRecord[]) : [];
  const reviewed = submission.review_status === "reviewed";
  return (
    <div className="history-exercise-row video-feedback-submission" key={String(submission.submission_id ?? index)}>
      <div>
        <strong>{String(submission.exercise_label || "Exercise")}</strong>
        <span className={`badge ${reviewed ? "complete" : "neutral"}`}>{reviewed ? "Reviewed" : "Awaiting review"}</span>
      </div>
      <video className="message-attachment-video" controls preload="metadata" poster={submission.thumbnail_url ? String(submission.thumbnail_url) : undefined}>
        <source src={String(submission.url ?? "")} />
      </video>
      {submission.caption ? <p className="muted">{String(submission.caption)}</p> : null}
      {feedback.map((entry, entryIndex) => (
        <p className="muted exercise-coaching-note" key={entryIndex}>Coach: {String(entry.feedback_text ?? "")}</p>
      ))}
    </div>
  );
}

function dispatchContinueSession(sessionId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:continue-history-session", { detail: { session_id: sessionId } }));
}

type DraftFilters = {
  status: string;
  dateFrom: string;
  dateTo: string;
  activityId: string;
  templateId: string;
  eventId: string;
};

const EMPTY_FILTERS: DraftFilters = { status: "", dateFrom: "", dateTo: "", activityId: "", templateId: "", eventId: "" };

export function AthleteHistoryPanel() {
  const { loading, error, sessions, unfilteredSessions, selectedSessionId, detail, detailVideoSubmissions, detailLoading, detailError, applyFilters, clearFilters, refresh, openDetail, closeDetail } = useTrainingHistory();
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_FILTERS);

  const filterOptions = useMemo(() => {
    const activities = new Set<string>();
    const programmes = new Map<string, string>();
    const events = new Map<string, string>();

    for (const session of unfilteredSessions) {
      if (session.activity_id) activities.add(String(session.activity_id));
      const provenance = session.provenance as JsonRecord | undefined;
      const programme = provenance?.programme as JsonRecord | undefined;
      if (programme?.template_id) programmes.set(String(programme.template_id), String(programme.template_name || programme.template_id));
      const eventRecord = provenance?.event as JsonRecord | undefined;
      if (eventRecord?.event_id) events.set(String(eventRecord.event_id), String(eventRecord.event_name || eventRecord.event_id));
    }

    return { activities: [...activities], programmes: [...programmes.entries()], events: [...events.entries()] };
  }, [unfilteredSessions]);

  function handleApply() {
    applyFilters({
      status: draft.status,
      date_from: draft.dateFrom,
      date_to: draft.dateTo,
      activity_id: draft.activityId,
      template_id: draft.templateId,
      event_id: draft.eventId
    });
  }

  function handleClear() {
    setDraft(EMPTY_FILTERS);
    clearFilters();
  }

  const programme = detail?.provenance ? ((detail.provenance as JsonRecord).programme as JsonRecord | undefined) : undefined;
  const assignment = detail?.provenance ? ((detail.provenance as JsonRecord).assignment as JsonRecord | undefined) : undefined;
  const event = detail?.provenance ? ((detail.provenance as JsonRecord).event as JsonRecord | undefined) : undefined;
  const canContinue = detail?.execution_status === "ready" || detail?.execution_status === "in_progress";
  const exercises = Array.isArray(detail?.exercises) ? (detail!.exercises as JsonRecord[]) : [];
  const splitReturnEvents = Array.isArray(detail?.split_return_events) ? (detail!.split_return_events as JsonRecord[]) : [];

  return (
    <>
      <div className="history-filters">
        <label className="field">
          <span>Status</span>
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
          </select>
        </label>
        <label className="field">
          <span>From</span>
          <input type="date" value={draft.dateFrom} onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={draft.dateTo} onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })} />
        </label>
        <label className="field">
          <span>Activity</span>
          <select value={draft.activityId} onChange={(e) => setDraft({ ...draft, activityId: e.target.value })}>
            <option value="">All activities</option>
            {filterOptions.activities.map((id) => <option value={id} key={id}>{titleCase(id)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Programme</span>
          <select value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>
            <option value="">All programmes</option>
            {filterOptions.programmes.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Event</span>
          <select value={draft.eventId} onChange={(e) => setDraft({ ...draft, eventId: e.target.value })}>
            <option value="">All events</option>
            {filterOptions.events.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>
        <div className="button-row">
          <button className="button primary" type="button" onClick={handleApply}>Apply filters</button>
          <button className="button secondary" type="button" onClick={handleClear}>Clear filters</button>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="panel empty-state">
          <div className="empty-icon">…</div>
          <h3>Loading history…</h3>
          <p>Fetching persisted session facts.</p>
        </div>
      ) : null}

      {error ? (
        <div className="panel empty-state">
          <div className="empty-icon">!</div>
          <h3>History could not be loaded</h3>
          <p>Training history could not be fetched. Check your connection and try again.</p>
          <button className="button primary" type="button" onClick={() => refresh()}>Retry</button>
        </div>
      ) : null}

      <div className="record-list">
        {sessions.length === 0 ? (
          !loading && !error ? (
            <div className="panel empty-state">
              <div className="empty-icon">H</div>
              <h3>No sessions recorded</h3>
              <p>Your persisted session history will appear here.</p>
            </div>
          ) : null
        ) : (
          [...sessions].reverse().map((session, index) => {
            const executionStatus = String(session.execution_status ?? session.status ?? "recorded");
            const provenance = session.provenance as JsonRecord | undefined;
            const programmeName = (provenance?.programme as JsonRecord | undefined)?.template_name;
            const eventName = (provenance?.event as JsonRecord | undefined)?.event_name;
            const droppedCount = Number(session.dropped_count ?? 0);

            return (
              <article
                className="record-card interactive"
                key={String(session.session_id ?? index)}
                data-history-detail-id={String(session.session_id ?? "")}
                onClick={() => openDetail(String(session.session_id))}
              >
                <div>
                  <h3>{String(programmeName || "Training session")}</h3>
                  <p>
                    {formatDate(session.updated_at ?? session.created_at)}
                    {eventName ? ` · ${String(eventName)}` : ""}
                  </p>
                </div>
                <div className="record-meta">
                  <span className={`badge ${historyRecordStatusClass(executionStatus)}`}>{titleCase(executionStatus)}</span>
                  <span className="badge neutral">{Number(session.completed_count ?? 0)} completed</span>
                  {droppedCount ? <span className="badge partial">{droppedCount} dropped</span> : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {selectedSessionId ? (
        <div className="panel history-detail-panel">
          {detailLoading ? (
            <div className="panel-header"><div><p className="eyebrow">Session detail</p><h3>Loading…</h3></div></div>
          ) : detailError ? (
            <>
              <div className="panel-header">
                <div><p className="eyebrow">Session detail</p><h3>Could not load this session</h3></div>
                <button className="button secondary" type="button" onClick={closeDetail}>Close detail</button>
              </div>
              <p className="muted">{detailError}</p>
            </>
          ) : detail ? (
            <>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Session detail</p>
                  <h3>{String(programme?.template_name || "Training session")}</h3>
                  <p className="muted">{formatDate(detail.created_at)} · {titleCase(detail.execution_status)}</p>
                </div>
                <div className="button-row">
                  {canContinue ? (
                    <button className="button primary" type="button" onClick={() => dispatchContinueSession(String(detail.session_id))}>Continue session</button>
                  ) : null}
                  <button className="button secondary" type="button" onClick={closeDetail}>Close detail</button>
                </div>
              </div>

              <div className="history-facts">
                <div><span>Status</span><strong>{titleCase(detail.execution_status)}</strong></div>
                <div><span>Split entered</span><strong>{detail.split_entered ? "Yes" : "No"}</strong></div>
                <div><span>Return decision</span><strong>{titleCase(detail.split_return_decision || "None")}</strong></div>
                <div><span>Programme</span><strong>{programme ? `${String(programme.template_name)} (v${String(programme.template_version)})` : "Not recorded"}</strong></div>
                <div><span>Assignment</span><strong>{String(assignment?.assignment_id || "Not recorded")}</strong></div>
                <div><span>Event</span><strong>{String(event?.event_name || "No linked event")}</strong></div>
              </div>

              <div className="panel-header"><div><p className="eyebrow">Planned versus recorded</p><h4>Exercises</h4></div></div>
              <div>
                {exercises.map((exercise, index) => {
                  const planned = exercise.planned as JsonRecord | undefined;
                  const recordedState = String(exercise.recorded_state ?? "");
                  const substitution = exercise.substitution as JsonRecord | undefined;
                  return (
                    <div className="history-exercise-row" key={String(exercise.exercise_id ?? index)}>
                      <strong>{exerciseName(planned)}</strong>
                      <span className={`badge ${recordedState === "completed" ? "complete" : recordedState === "dropped" ? "partial" : "neutral"}`}>
                        {titleCase(recordedState)}
                      </span>
                      {exercise.skip_reason ? <small>Skip reason: {titleCase(exercise.skip_reason)}</small> : null}
                      {exercise.pain_reported ? <small>Pain reported</small> : null}
                      {exercise.rpe_reported ? <small>RPE reported: {String(exercise.rpe_reported)}</small> : null}
                      {exercise.borg_reported ? <small>Borg reported: {String(exercise.borg_reported)}</small> : null}
                      {exercise.cr10_reported !== null && exercise.cr10_reported !== undefined ? <small>CR10 reported: {String(exercise.cr10_reported)}</small> : null}
                      {substitution ? <small>Substituted with {String(substitution.substituted_exercise_id)}</small> : null}
                    </div>
                  );
                })}
              </div>

              {detailVideoSubmissions.length > 0 ? (
                <>
                  <div className="panel-header"><div><p className="eyebrow">Form-check videos</p><h4>Video feedback</h4></div></div>
                  <div>
                    {detailVideoSubmissions.map((submission, index) => renderVideoSubmissionCard(submission, index))}
                  </div>
                </>
              ) : null}

              {splitReturnEvents.length > 0 ? (
                <>
                  <div className="panel-header"><div><p className="eyebrow">Split and return record</p><h4>Events</h4></div></div>
                  <div className="record-list">
                    {splitReturnEvents.map((event, index) => (
                      <div className="history-exercise-row" key={index}>
                        <strong>{titleCase(event.type)}</strong>
                        <small>{formatDate(event.created_at)}</small>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
