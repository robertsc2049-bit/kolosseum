import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { type ReviewRecord, useCoachReview } from "./useCoachReview";

// DEV NOTE: FULL-UI-17 coach review queue - ported from app.js's
// reviewRecordCard()/renderCoachReviewDetail()/reviewNoteList()/
// renderCoachReviewWorkspace(). See useCoachReview.ts's DEV NOTE for the
// kolosseum:open-session-review bridge this panel's athlete filter
// listens to, and the kolosseum:coach-note-dirty-changed bridge the note
// form dispatches so legacy's setView()-guarding
// confirmCoachNoteDeparture() still warns before an accidental departure.
function reviewRecordStatus(record: ReviewRecord): "reviewed" | "unreviewed" | "open" {
  const status = String(record.review_status ?? "unreviewed").toLowerCase();
  return status === "reviewed" || status === "open" ? status : "unreviewed";
}

function reviewRecordDate(record: ReviewRecord): string {
  return String(record.updated_at ?? record.created_at ?? "");
}

function reviewAthleteName(record: ReviewRecord, athleteNamesById: Record<string, string>): string {
  return athleteNamesById[String(record.athlete_user_id ?? "")] ?? "Connected athlete";
}

function reviewRecordMatches(record: ReviewRecord, athleteName: string, query: string): boolean {
  const assignment = (record.assignment_provenance && typeof record.assignment_provenance === "object" ? record.assignment_provenance : {}) as JsonRecord;
  const eventLink = (record.event_provenance && typeof record.event_provenance === "object" ? record.event_provenance : {}) as JsonRecord;

  return [
    athleteName,
    record.session_id,
    record.session_title,
    record.block_id,
    record.assignment_id,
    assignment.template_id,
    assignment.template_name,
    assignment.activity_id,
    eventLink.event_id
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ")
    .includes(query.trim().toLowerCase());
}

function StatusBadge({ record }: { record: ReviewRecord }) {
  const status = reviewRecordStatus(record);
  if (status === "reviewed") return <span className="badge complete">Reviewed</span>;
  if (status === "open") return <span className="badge neutral">Open · read only</span>;
  return <span className="badge warning">Awaiting review</span>;
}

function ReviewActions({
  record,
  compact,
  marking,
  onMark,
  onNote
}: {
  record: ReviewRecord;
  compact: boolean;
  marking: boolean;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
  onNote: (record: ReviewRecord) => void;
}) {
  const status = reviewRecordStatus(record);
  const size = compact ? " small-button" : "";
  return (
    <>
      {status === "unreviewed" ? (
        <button className={`button primary${size}`} type="button" disabled={marking} onClick={() => onMark(record, "reviewed")}>Mark reviewed</button>
      ) : status === "reviewed" ? (
        <button className={`button secondary${size}`} type="button" disabled={marking} onClick={() => onMark(record, "unreviewed")}>Mark unreviewed</button>
      ) : null}
      <button className={`button secondary${size}`} type="button" onClick={() => onNote(record)}>{compact ? "Add note" : "Add non-binding note"}</button>
    </>
  );
}

function ReviewCard({
  record,
  athleteName,
  selected,
  marking,
  onSelect,
  onMark,
  onNote
}: {
  record: ReviewRecord;
  athleteName: string;
  selected: boolean;
  marking: boolean;
  onSelect: (sessionId: string) => void;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
  onNote: (record: ReviewRecord) => void;
}) {
  const notes = Number(record.note_count ?? 0);
  return (
    <article className={`record-card review-record-card${selected ? " selected" : ""}`}>
      <div>
        <p className="eyebrow">{athleteName}</p>
        <h3>{String(record.session_title ?? "Training session")}</h3>
        <p>{formatDate(reviewRecordDate(record))} · {Number(record.runtime_event_count ?? 0)} recorded events</p>
        <p className="muted small">Session {String(record.session_id)}</p>
      </div>
      <div className="record-meta review-record-actions">
        <StatusBadge record={record} />
        <span className="badge neutral">{notes} note{notes === 1 ? "" : "s"}</span>
        <button className="button secondary small-button" type="button" onClick={() => onSelect(String(record.session_id))}>View details</button>
        <ReviewActions record={record} compact marking={marking} onMark={onMark} onNote={onNote} />
      </div>
    </article>
  );
}

function ReviewDetail({
  record,
  athleteName,
  marking,
  onMark,
  onNote
}: {
  record: ReviewRecord;
  athleteName: string;
  marking: boolean;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
  onNote: (record: ReviewRecord) => void;
}) {
  const assignment = (record.assignment_provenance && typeof record.assignment_provenance === "object" ? record.assignment_provenance : {}) as JsonRecord;
  const eventLink = (record.event_provenance && typeof record.event_provenance === "object" ? record.event_provenance : {}) as JsonRecord;
  const status = reviewRecordStatus(record);
  const notes = Array.isArray(record.notes) ? (record.notes as JsonRecord[]) : [];

  return (
    <aside className="panel review-detail">
      <div className="review-detail-heading">
        <div>
          <p className="eyebrow">Factual session detail</p>
          <h3>{athleteName}</h3>
          <p>{String(record.session_title ?? "Training session")}</p>
        </div>
        <StatusBadge record={record} />
      </div>

      <dl className="review-fact-grid">
        <div><dt>Session</dt><dd>{String(record.session_id)}</dd></div>
        <div><dt>Status</dt><dd>{titleCase(record.session_status ?? "recorded")}</dd></div>
        <div><dt>Recorded events</dt><dd>{Number(record.runtime_event_count ?? 0)}</dd></div>
        <div><dt>Planned work items</dt><dd>{Number(record.planned_work_item_count ?? 0)}</dd></div>
        <div><dt>Block</dt><dd>{String(record.block_id || "Not recorded")}</dd></div>
        <div><dt>Updated</dt><dd>{formatDate(reviewRecordDate(record))}</dd></div>
      </dl>

      <section className="review-provenance">
        <h4>Provenance</h4>
        <dl className="review-fact-grid">
          <div><dt>Assignment</dt><dd>{String(record.assignment_id || "Not recorded")}</dd></div>
          <div><dt>Programme</dt><dd>{String(assignment.template_name ?? assignment.template_id ?? "Not recorded")}</dd></div>
          <div><dt>Programme version</dt><dd>{Number(assignment.template_version ?? 0) || "Not recorded"}</dd></div>
          <div><dt>Activity</dt><dd>{titleCase(assignment.activity_id ?? "not recorded")}</dd></div>
          <div><dt>Event</dt><dd>{String(eventLink.event_id ?? "No event link")}</dd></div>
          <div><dt>Artefact</dt><dd>{String(record.artefact_id)}</dd></div>
        </dl>
      </section>

      <p className={`review-boundary-copy${status === "open" ? " live" : ""}`}>
        {status === "open"
          ? "Live status is read-only. This surface displays recorded session facts and cannot control or override the active session."
          : "Review state is product metadata only. Marking a record reviewed or unreviewed does not change the session artefact, programme, assignment or engine truth."}
      </p>

      <div className="assignment-action-row">
        <ReviewActions record={record} compact={false} marking={marking} onMark={onMark} onNote={onNote} />
      </div>

      <section>
        <h4>Coach notes</h4>
        {notes.length === 0 ? (
          <div className="empty-state compact-empty"><p>No coach notes are recorded for this session.</p></div>
        ) : (
          <div className="review-note-list">
            {notes.map((note, index) => (
              <article className="review-note-card" key={index}>
                <div className="record-meta">
                  <span className="badge neutral">{note.visibility === "athlete_visible" ? "Athlete visible" : "Coach only"}</span>
                  <span className="muted small">{formatDate(note.created_at)}</span>
                </div>
                <p>{String(note.note_text ?? "")}</p>
                <p className="muted small">Non-binding product note · not included in engine input</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

export function CoachReviewPanel() {
  const {
    loading,
    error,
    reviews,
    athleteNamesById,
    selectedAthleteId,
    marking,
    markError,
    noteSubmitting,
    noteError,
    refresh,
    setSelectedAthleteId,
    markReview,
    recordNote,
    dispatchNoteDirty
  } = useCoachReview();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("awaiting");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [noteRecord, setNoteRecord] = useState<ReviewRecord | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("coach_private");

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = reviews
    .filter((record) => !selectedAthleteId || String(record.athlete_user_id ?? "") === selectedAthleteId)
    .filter((record) => !normalizedSearch || reviewRecordMatches(record, reviewAthleteName(record, athleteNamesById), normalizedSearch))
    .filter((record) => {
      const status = reviewRecordStatus(record);
      if (statusFilter === "all") return true;
      if (statusFilter === "awaiting") return status === "unreviewed";
      return status === statusFilter;
    })
    .sort((left, right) => reviewRecordDate(right).localeCompare(reviewRecordDate(left)));

  const selected = reviews.find((record) => record.session_id === selectedSessionId)
    ?? (filtered.length > 0 ? filtered[0] : null);

  if (selected && selected.session_id !== selectedSessionId) {
    setSelectedSessionId(String(selected.session_id));
  }

  const counts = {
    all: reviews.length,
    awaiting: reviews.filter((record) => reviewRecordStatus(record) === "unreviewed").length,
    reviewed: reviews.filter((record) => reviewRecordStatus(record) === "reviewed").length,
    open: reviews.filter((record) => reviewRecordStatus(record) === "open").length
  };

  function handleMark(record: ReviewRecord, status: "reviewed" | "unreviewed") {
    const copy = status === "reviewed"
      ? "Mark this completed session as reviewed?"
      : "Return this completed session to the awaiting-review queue?";
    if (!window.confirm(copy)) return;
    markReview(record, status);
  }

  function handleOpenNote(record: ReviewRecord) {
    setNoteRecord(record);
    setNoteText("");
    dispatchNoteDirty(false);
  }

  async function handleSubmitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteRecord) return;
    const ok = await recordNote(noteRecord, noteText, noteVisibility);
    if (ok) setNoteRecord(null);
  }

  if (loading && reviews.length === 0) {
    return <p className="muted small">Loading review records…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  return (
    <section className="panel">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Coach workspace</p>
          <h2>Review</h2>
          <p className="muted">Factual completed-session review, live read-only status and non-binding coach notes.</p>
        </div>
        <div className="review-toolbar">
          <label className="field compact-field">
            <span>Athlete</span>
            <select value={selectedAthleteId} onChange={(event) => setSelectedAthleteId(event.target.value)} disabled={Object.keys(athleteNamesById).length === 0}>
              <option value="">All connected athletes</option>
              {Object.entries(athleteNamesById).map(([athleteUserId, displayName]) => (
                <option key={athleteUserId} value={athleteUserId}>{displayName}</option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>Search</span>
            <input type="search" placeholder="Athlete, session or programme" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="field compact-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="awaiting">Awaiting review</option>
              <option value="reviewed">Reviewed</option>
              <option value="open">Open sessions</option>
              <option value="all">All records</option>
            </select>
          </label>
          <button className="button secondary" type="button" disabled={Object.keys(athleteNamesById).length === 0} onClick={() => refresh()}>Refresh review</button>
        </div>
      </div>

      <p className="dashboard-status muted" aria-live="polite">
        {`${counts.awaiting} completed session${counts.awaiting === 1 ? "" : "s"} awaiting review.`}
      </p>

      <div className="review-summary-grid" aria-label="Review counts">
        <article className="stat-card"><span>All records</span><strong>{counts.all}</strong></article>
        <article className="stat-card"><span>Awaiting review</span><strong>{counts.awaiting}</strong></article>
        <article className="stat-card"><span>Reviewed</span><strong>{counts.reviewed}</strong></article>
        <article className="stat-card"><span>Open sessions</span><strong>{counts.open}</strong></article>
      </div>

      {markError ? <p className="dashboard-status" role="status" aria-live="polite">{markError}</p> : null}

      <div className="review-layout">
        <div>
          <div className="record-list">
            {filtered.length === 0 ? (
              <div className="panel empty-state">
                <div className="empty-icon">R</div>
                <h3>No matching review records</h3>
                <p>Completed sessions awaiting review, reviewed records and open read-only sessions will appear here.</p>
              </div>
            ) : (
              filtered.map((record) => (
                <ReviewCard
                  key={String(record.session_id)}
                  record={record}
                  athleteName={reviewAthleteName(record, athleteNamesById)}
                  selected={String(record.session_id) === selectedSessionId}
                  marking={marking}
                  onSelect={setSelectedSessionId}
                  onMark={handleMark}
                  onNote={handleOpenNote}
                />
              ))
            )}
          </div>
        </div>
        {selected ? (
          <ReviewDetail
            record={selected}
            athleteName={reviewAthleteName(selected, athleteNamesById)}
            marking={marking}
            onMark={handleMark}
            onNote={handleOpenNote}
          />
        ) : null}
      </div>

      {noteRecord ? (
        <form className="panel form-panel narrow" onSubmit={handleSubmitNote}>
          <div>
            <p className="eyebrow">Non-binding note</p>
            <h3>Add note for {reviewAthleteName(noteRecord, athleteNamesById)}</h3>
          </div>
          <label className="field">
            <span>Note</span>
            <textarea
              required
              maxLength={2000}
              value={noteText}
              onChange={(event) => {
                setNoteText(event.target.value);
                dispatchNoteDirty(true);
              }}
            />
          </label>
          <label className="field">
            <span>Visibility</span>
            <select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value)}>
              <option value="coach_private">Coach only</option>
              <option value="athlete_visible">Visible to athlete</option>
            </select>
          </label>
          <p className="muted small">This note is non-binding, stored separately from the session artefact and cannot alter engine output or session facts.</p>
          {noteError ? <p className="dashboard-status" role="status" aria-live="polite">{noteError}</p> : null}
          <button className="button primary" type="submit" disabled={noteSubmitting}>Record note</button>
        </form>
      ) : null}
    </section>
  );
}
