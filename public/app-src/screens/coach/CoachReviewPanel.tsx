import React, { useEffect, useState } from "react";

import { loadAthleteHistoryDetail, loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { loadSessionSummary } from "../../api/sessionSummaryClient";
import { closedPlace, onClosePlace, onOpenPlace, openedPlace } from "../../utils/place";
import { type JsonRecord } from "../../api/transport";
import { LoadFailed } from "../../components/LoadFailed";
import { PhoneDisclosure } from "../../components/PhoneDisclosure";
import { TickIcon } from "../../components/TickIcon";
import { formatDate, sentenceCase, titleCase } from "../../utils/format";
import { ReviewSessionWork, type SessionWorkState } from "./ReviewSessionWork";
import { type ReviewRecord, useCoachReview } from "./useCoachReview";
import { finishedEarly } from "../../utils/sessionSummary";

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

// DEV NOTE: the backend already computes the real review timestamp
// (product_review.routes.ts's reviewed_at_iso8601, from the coach's latest
// product_session_reviews row) but this panel used to fall back to the
// session's own updated_at/created_at everywhere, showing when the session
// record last changed rather than when the coach actually marked it
// reviewed. Only meaningful once a record is actually reviewed - null
// otherwise.
function reviewedAtDate(record: ReviewRecord): string {
  return String(record.reviewed_at_iso8601 ?? "");
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
  athleteName,
  compact,
  marking,
  onMark,
  onNote
}: {
  record: ReviewRecord;
  athleteName?: string;
  compact: boolean;
  marking: boolean;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
  onNote: (record: ReviewRecord) => void;
}) {
  const status = reviewRecordStatus(record);
  const size = compact ? " small-button" : "";
  // A list of these says whose session each is for.
  const named = (action: string) => (athleteName ? { "aria-label": `${action}: ${athleteName}, ${String(record.session_title ?? "Training session")}, ${formatDate(reviewRecordDate(record))}` } : {});
  return (
    <>
      {status === "unreviewed" ? (
        <button className={`button primary${size}`} type="button" disabled={marking} {...named("Mark reviewed")} onClick={() => onMark(record, "reviewed")}>Mark reviewed</button>
      ) : status === "reviewed" ? (
        <button className={`button secondary${size}`} type="button" disabled={marking} {...named("Mark unreviewed")} onClick={() => onMark(record, "unreviewed")}>Mark unreviewed</button>
      ) : null}
      <button className={`button secondary${size}`} type="button" {...named("Add note")} onClick={() => onNote(record)}>Add note</button>
    </>
  );
}

const flagsOf = (record: ReviewRecord): string[] => (Array.isArray(record.review_flags) ? (record.review_flags as unknown[]).map(String).filter(Boolean) : []);

// One line a session: who and what, how it went, what stands out, and a tick.
function ReviewCard({
  record,
  athleteName,
  selected,
  marking,
  onSelect,
  onMark
}: {
  record: ReviewRecord;
  athleteName: string;
  selected: boolean;
  marking: boolean;
  onSelect: (sessionId: string) => void;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
}) {
  const notes = Number(record.note_count ?? 0);
  const status = reviewRecordStatus(record);
  const reviewedAt = reviewedAtDate(record);
  const title = String(record.session_title ?? "Training session");
  const dateLabel = status === "reviewed" && reviewedAt ? `Reviewed ${formatDate(reviewedAt)}` : formatDate(reviewRecordDate(record));
  const named = `${athleteName}, ${title}, ${formatDate(reviewRecordDate(record))}`;
  const flags = flagsOf(record);
  return (
    <article className={`review-row${selected ? " selected" : ""}${flags.length ? " has-flags" : ""}`}>
      <button className="review-row-open" type="button" aria-label={[`View details: ${named}`, String(record.done_summary ?? ""), ...flags].filter(Boolean).join(". ")} aria-current={selected ? "true" : undefined} onClick={() => onSelect(String(record.session_id))}>
        <span className="review-row-name"><strong>{athleteName}</strong> <span className="review-row-title">{title}</span></span>
        <span className="review-row-meta">{[dateLabel, String(record.done_summary ?? ""), record.self_directed === true ? "Self-directed" : "", notes > 0 ? `${notes} note${notes === 1 ? "" : "s"}` : "", status === "open" ? "Training now" : ""].filter(Boolean).join(" · ")}</span>
        {flags.map((flag) => <span key={flag} className="review-row-flag">{flag}</span>)}
        {Array.isArray(record.programme_adjustments) && record.programme_adjustments.length ? (
          <span className="review-row-meta" data-testid="programme-adjustments">{(record.programme_adjustments as unknown[]).map(String).map((line) => <span key={line} className="review-row-line">{line}</span>)}</span>
        ) : null}
      </button>
      {status === "unreviewed" ? (
        <button className="tick-button" type="button" disabled={marking} aria-label={`Mark reviewed: ${named}`} onClick={() => onMark(record, "reviewed")}><TickIcon /></button>
      ) : status === "reviewed" ? (
        <button className="tick-button is-done" type="button" disabled={marking} aria-label={`Mark unreviewed: ${named}`} onClick={() => onMark(record, "unreviewed")}><TickIcon /></button>
      ) : null}
    </article>
  );
}

// What the app changed about this session on its own (weeks skipped or held
// to time a taper, a lighter week back), so the coach is never surprised.
function ProgrammeAdjustments({ record }: { record: ReviewRecord }) {
  const lines = Array.isArray(record.programme_adjustments) ? (record.programme_adjustments as unknown[]).map(String).filter(Boolean) : [];
  if (!lines.length) return null;
  return (
    <ul className="programme-adjustments" data-testid="programme-adjustments">
      {lines.map((line) => <li key={line} className="inline-result" data-tone="warning">{line}</li>)}
    </ul>
  );
}

function ReviewDetail({
  record,
  athleteName,
  marking,
  summary,
  work,
  exerciseNames,
  onMark,
  onNote,
  onBack
}: {
  onBack: () => void;
  record: ReviewRecord;
  athleteName: string;
  marking: boolean;
  summary: JsonRecord | null;
  work: SessionWorkState;
  exerciseNames: ReadonlyMap<string, string>;
  onMark: (record: ReviewRecord, status: "reviewed" | "unreviewed") => void;
  onNote: (record: ReviewRecord) => void;
}) {
  const assignment = (record.assignment_provenance && typeof record.assignment_provenance === "object" ? record.assignment_provenance : {}) as JsonRecord;
  const eventLink = (record.event_provenance && typeof record.event_provenance === "object" ? record.event_provenance : {}) as JsonRecord;
  const status = reviewRecordStatus(record);
  const notes = Array.isArray(record.notes) ? (record.notes as JsonRecord[]) : [];

  return (
    <aside className="panel review-detail">
      <h2 className="sr-only">Session</h2>
      <button className="text-button review-back" type="button" onClick={onBack}>All sessions</button>
      <div className="review-detail-heading">
        <div>
          <h3>{athleteName}</h3>
          <p>{String(record.session_title ?? "Training session")}</p>
          <ProgrammeAdjustments record={record} />
        </div>
        <StatusBadge record={record} />
      </div>

      <ReviewSessionWork athleteName={athleteName} work={work} exerciseNames={exerciseNames} />

      {summary ? (
        <dl className="review-fact-grid">
          <div><dt>Exercises done</dt><dd>{Number(summary.prescribed_items_completed ?? 0)}</dd></div>
          <div><dt>Skipped or not done</dt><dd>{Number(summary.prescribed_items_skipped ?? 0)}</dd></div>
          <div><dt>Not reached</dt><dd>{Number(summary.prescribed_items_remaining ?? 0)}</dd></div>
          {finishedEarly(summary) ? (
            <div><dt>Finished early</dt><dd>Yes</dd></div>
          ) : (
            <>
              {Number(summary.split_event_count ?? 0) > 0 ? (
                <div><dt>Paused</dt><dd>{`${Number(summary.split_event_count)} time${Number(summary.split_event_count) === 1 ? "" : "s"}`}</dd></div>
              ) : null}
              {Number(summary.return_continue_count ?? 0) > 0 ? (
                <div><dt>Came back and carried on</dt><dd>{Number(summary.return_continue_count)}</dd></div>
              ) : null}
              {Number(summary.return_skip_count ?? 0) > 0 ? (
                <div><dt>Came back and skipped the rest</dt><dd>{Number(summary.return_skip_count)}</dd></div>
              ) : null}
            </>
          )}
        </dl>
      ) : null}


      <p className={`review-boundary-copy${status === "open" ? " live" : ""}`}>
        {status === "open"
          ? "This session is still in progress - you're seeing it live, read-only."
          : "Reviewed is just your own marker - it doesn't change the athlete's session or programme."}
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
                {note.exercise_id ? <p className="muted small">Exercise: {sentenceCase(String(note.exercise_id))}</p> : null}
                <p className="muted small">
                  {note.visibility === "athlete_visible"
                    ? "Visible to the athlete · doesn't affect training calculations"
                    : "Private note · doesn't affect training calculations"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="review-record-details">
        <summary>Session record</summary>
        <dl className="review-fact-grid">
          <div><dt>Status</dt><dd>{sentenceCase(record.session_status ?? "recorded")}</dd></div>
          <div><dt>Recorded events</dt><dd>{Number(record.runtime_event_count ?? 0)}</dd></div>
          <div><dt>Planned work items</dt><dd>{Number(record.planned_work_item_count ?? 0)}</dd></div>
          <div><dt>Block</dt><dd>{String(record.block_id || "Not recorded")}</dd></div>
          <div><dt>Updated</dt><dd>{formatDate(reviewRecordDate(record))}</dd></div>
          {status === "reviewed" ? <div><dt>Reviewed</dt><dd>{formatDate(reviewedAtDate(record))}</dd></div> : null}
        </dl>
  
          <section className="review-provenance">
          <h4>Where it came from</h4>
          <dl className="review-fact-grid">
            <div><dt>Assignment</dt><dd>{record.self_directed === true ? "None - the athlete ran this session themselves" : String(record.assignment_id || "Not recorded")}</dd></div>
            <div><dt>Programme</dt><dd>{String(assignment.template_name ?? assignment.template_id ?? "Not recorded")}</dd></div>
            <div><dt>Programme version</dt><dd>{Number(assignment.template_version ?? 0) || "Not recorded"}</dd></div>
            <div><dt>Activity</dt><dd>{titleCase(assignment.activity_id ?? "not recorded")}</dd></div>
            <div><dt>Event</dt><dd>{String(eventLink.event_id ?? "No event link")}</dd></div>
          </dl>
        </section>
        </details>
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
    markReviewed,
    recordNote,
    dispatchNoteDirty
  } = useCoachReview();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("awaiting");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  // On a phone the list and a session are two screens; side by side on a laptop.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const offClose = onClosePlace("review", () => setOpen(false));
    const offOpen = onOpenPlace("kolosseum:open-review-session", "session_id", (sessionId) => { setSelectedSessionId(sessionId); setOpen(true); });
    return () => { offClose(); offOpen(); };
  }, []);
  const closeSession = () => { setOpen(false); closedPlace("coach_review_session"); };
  const [noteRecord, setNoteRecord] = useState<ReviewRecord | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("coach_private");
  const [noteExerciseId, setNoteExerciseId] = useState("");

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
    // What stands out first, then the newest.
    .sort((left, right) => Number(flagsOf(right).length > 0 && reviewRecordStatus(right) === "unreviewed") - Number(flagsOf(left).length > 0 && reviewRecordStatus(left) === "unreviewed")
      || reviewRecordDate(right).localeCompare(reviewRecordDate(left)));
  const waitingList = filtered.filter((record) => reviewRecordStatus(record) === "unreviewed");
  const flagged = waitingList.filter((record) => flagsOf(record).length > 0);
  const asPlanned = waitingList.filter((record) => flagsOf(record).length === 0);

  const selected = reviews.find((record) => record.session_id === selectedSessionId)
    ?? (filtered.length > 0 ? filtered[0] : null);

  if (selected && selected.session_id !== selectedSessionId) {
    setSelectedSessionId(String(selected.session_id));
  }

  const [summary, setSummary] = useState<JsonRecord | null>(null);
  const [work, setWork] = useState<SessionWorkState>({ status: "loading" });
  const [exerciseNames, setExerciseNames] = useState<ReadonlyMap<string, string>>(new Map());
  const selectedAthleteForWork = selected ? String(selected.athlete_user_id ?? "") : "";
  const selectedSessionIdForSummary = selected ? String(selected.session_id) : "";

  useEffect(() => {
    if (!selectedSessionIdForSummary) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setSummary(null);
    loadSessionSummary(selectedSessionIdForSummary)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionIdForSummary]);

  // The session's logged work comes from the athlete's detail record.
  useEffect(() => {
    if (!selectedSessionIdForSummary || !selectedAthleteForWork) return;
    let cancelled = false;
    setWork({ status: "loading" });
    loadAthleteHistoryDetail(selectedAthleteForWork)
      .then((detail) => {
        const history = Array.isArray(detail.session_history) ? (detail.session_history as JsonRecord[]) : [];
        if (!cancelled) setWork({ status: "ready", session: history.find((entry) => String(entry.session_id) === selectedSessionIdForSummary) ?? null });
      })
      .catch(() => {
        if (!cancelled) setWork({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSessionIdForSummary, selectedAthleteForWork]);

  // Exercise names for the logged work, once.
  useEffect(() => {
    let cancelled = false;
    loadTemplateExercises()
      .then((exercises) => {
        if (!cancelled) setExerciseNames(new Map(exercises.map((exercise) => [String(exercise.exercise_id), String(exercise.display_name ?? exercise.exercise_id)])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleMarkAll() {
    if (!window.confirm(`Mark ${asPlanned.length} sessions with nothing flagged as reviewed?`)) return;
    void markReviewed(asPlanned);
  }

  function handleOpenNote(record: ReviewRecord) {
    setNoteRecord(record);
    setNoteText("");
    setNoteExerciseId("");
    dispatchNoteDirty(false);
  }

  async function handleSubmitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteRecord) return;
    const ok = await recordNote(noteRecord, noteText, noteVisibility, noteExerciseId);
    if (ok) setNoteRecord(null);
  }

  if (loading && reviews.length === 0) {
    return <p className="muted small">Loading review records…</p>;
  }

  if (error) {
    return <LoadFailed message={error} onRetry={() => { void refresh(); }} />;
  }

  return (
    <section className="panel">
      <div className="page-heading">
        <div>
          <h2>{statusFilter !== "awaiting" ? "Sessions" : flagged.length ? `${flagged.length} ${flagged.length === 1 ? "session needs" : "sessions need"} a look` : waitingList.length ? "Nothing flagged" : "Review"}</h2>
          <p className="dashboard-status muted" aria-live="polite">
            {`${counts.awaiting} completed session${counts.awaiting === 1 ? "" : "s"} awaiting review.`}
          </p>
        </div>
        <div className="review-toolbar">
          <label className="field compact-field review-search-field">
            <span>Search</span>
            <input type="search" placeholder="Athlete, session or programme" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <PhoneDisclosure label="Filters" openLabel="Hide filters" count={[selectedAthleteId !== "", statusFilter !== "awaiting"].filter(Boolean).length}>
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
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="awaiting">Awaiting review</option>
              <option value="reviewed">Reviewed</option>
              <option value="open">Training now</option>
              <option value="all">All sessions</option>
            </select>
          </label>
          </PhoneDisclosure>
        </div>
      </div>

      {statusFilter === "awaiting" && asPlanned.length > 1 ? (
        <div className="review-bulk">
          <p className="muted small">{`${asPlanned.length} went as planned: no pain, missed reps, skipped work or very hard ratings.`}</p>
          <button className="button primary" type="button" disabled={marking} onClick={handleMarkAll}>{`Mark ${asPlanned.length} as reviewed`}</button>
        </div>
      ) : null}

      {markError ? <p className="dashboard-status" role="status" aria-live="polite">{markError}</p> : null}

      <div className="review-layout" data-open={open}>
        <div>
          <div className="record-list">
            {filtered.length === 0 ? (
              statusFilter === "awaiting" && reviews.length > 0 ? (
                <div className="panel empty-state" data-testid="review-all-caught-up">
                  <div className="empty-icon">✓</div>
                  <h3>You're up to date</h3>
                  <p>Nothing is waiting for your review.</p>
                  <button className="button secondary" type="button" onClick={() => setStatusFilter("all")}>Show all sessions</button>
                </div>
              ) : (
                <div className="panel empty-state">
                  <h3>No matching sessions</h3>
                  <p>Finished sessions appear here for you to review, and open read-only sessions while an athlete is training.</p>
                </div>
              )
            ) : (
              filtered.map((record) => (
                <ReviewCard
                  key={String(record.session_id)}
                  record={record}
                  athleteName={reviewAthleteName(record, athleteNamesById)}
                  selected={String(record.session_id) === selectedSessionId}
                  marking={marking}
                  onSelect={(sessionId) => { setSelectedSessionId(sessionId); setOpen(true); if (window.matchMedia?.("(max-width: 900px)").matches) { openedPlace("coach_review_session", { session_id: sessionId }); window.scrollTo?.(0, 0); } }}
                  onMark={handleMark}
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
            summary={summary}
            work={work}
            exerciseNames={exerciseNames}
            onMark={handleMark}
            onNote={handleOpenNote}
            onBack={closeSession}
          />
        ) : null}
      </div>

      {noteRecord ? (
        <form className="panel form-panel narrow" onSubmit={handleSubmitNote}>
          <div>
            <p className="eyebrow">Coach note</p>
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
            <span>Exercise</span>
            <select value={noteExerciseId} onChange={(event) => setNoteExerciseId(event.target.value)}>
              <option value="">Whole session</option>
              {(Array.isArray(noteRecord.exercise_ids) ? (noteRecord.exercise_ids as string[]) : []).map((exerciseId) => (
                <option key={exerciseId} value={exerciseId}>{sentenceCase(exerciseId)}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Visibility</span>
            <select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value)}>
              <option value="coach_private">Coach only</option>
              <option value="athlete_visible">Visible to athlete</option>
            </select>
          </label>
          <p className="muted small">This note is private to you (unless marked visible to the athlete) and can't change the recorded session.</p>
          {noteError ? <p className="dashboard-status" role="status" aria-live="polite">{noteError}</p> : null}
          <button className="button primary" type="submit" disabled={noteSubmitting}>Record note</button>
        </form>
      ) : null}
    </section>
  );
}
