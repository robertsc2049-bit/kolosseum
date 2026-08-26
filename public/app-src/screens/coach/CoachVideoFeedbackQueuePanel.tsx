import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useCoachVideoFeedbackQueue } from "./useCoachVideoFeedbackQueue";

// DEV NOTE: FULL-UI-32 coach video-feedback queue - ported from app.js's
// videoFeedbackQueueCard()/renderVideoFeedbackDetail()/
// filteredVideoFeedbackQueue()/refreshVideoFeedbackQueue()/
// submitVideoFeedback(). Search text and the selected submission are local
// component state, not persisted to localStorage as legacy's
// state.videoFeedbackQueueSearch/selectedVideoFeedbackSubmissionId were -
// same deliberate simplification as AthleteSelfProgressPhotosPanel's
// compare-selection.
function athleteNameFor(submission: JsonRecord, athleteNamesById: Record<string, string>): string {
  const athleteUserId = String(submission.athlete_user_id ?? "");
  return athleteNamesById[athleteUserId] ?? athleteUserId ?? "Athlete";
}

function QueueCard({
  submission,
  athleteName,
  selected,
  onSelect
}: {
  submission: JsonRecord;
  athleteName: string;
  selected: boolean;
  onSelect: (submissionId: string) => void;
}) {
  return (
    <article
      className={`record-card review-record-card interactive${selected ? " selected" : ""}`}
      onClick={() => onSelect(String(submission.submission_id))}
    >
      <div>
        <h3>{String(submission.exercise_label ?? "Exercise")}</h3>
        <p>{athleteName}</p>
        <p className="muted small">{formatDate(submission.created_at)}</p>
      </div>
      <div className="record-meta">
        <span className="badge neutral">Awaiting review</span>
      </div>
    </article>
  );
}

export function CoachVideoFeedbackQueuePanel() {
  const { loading, error, submissions, athleteNamesById, submitting, submitError, submitFeedback } = useCoachVideoFeedbackQueue();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? submissions.filter((submission) =>
        [submission.exercise_label, athleteNameFor(submission, athleteNamesById)]
          .some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch))
      )
    : submissions;

  const selected = filtered.find((submission) => String(submission.submission_id) === selectedId)
    ?? (filtered.length > 0 ? filtered[0] : null);

  if (selected && String(selected.submission_id) !== selectedId) {
    setSelectedId(String(selected.submission_id));
  }

  async function handleSendFeedback() {
    const text = feedbackText.trim();
    if (!text || !selected) return;
    const ok = await submitFeedback(String(selected.submission_id), text);
    if (ok) setFeedbackText("");
  }

  if (loading && submissions.length === 0) {
    return <p className="muted small">Loading video feedback queue…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  const statusText = submissions.length
    ? `${submissions.length} video submission${submissions.length === 1 ? "" : "s"} awaiting review.`
    : "No pending video submissions.";

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Video review</p>
          <h3>Video submissions awaiting feedback</h3>
        </div>
      </div>
      <p className="dashboard-status muted" aria-live="polite">{statusText}</p>
      <label className="field">
        <span>Search queue</span>
        <input
          type="search"
          autoComplete="off"
          placeholder="Athlete or exercise"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="review-layout">
        <div>
          <div className="record-list">
            {submissions.length === 0 ? (
              <div className="panel empty-state">
                <div className="empty-icon">V</div>
                <h3>No pending video submissions</h3>
                <p>Athlete form-check videos awaiting your feedback will appear here.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="panel empty-state">
                <h3>No submissions match</h3>
                <p>Try a different athlete or exercise search term.</p>
              </div>
            ) : (
              filtered.map((submission) => (
                <QueueCard
                  key={String(submission.submission_id)}
                  submission={submission}
                  athleteName={athleteNameFor(submission, athleteNamesById)}
                  selected={String(submission.submission_id) === selectedId}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>
        {selected ? (
          <aside className="panel review-detail">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{formatDate(selected.created_at)}</p>
                <h3>{String(selected.exercise_label ?? "Exercise")}</h3>
              </div>
            </div>
            <video
              className="message-attachment-video"
              controls
              preload="metadata"
              poster={selected.thumbnail_url ? String(selected.thumbnail_url) : undefined}
            >
              <source src={String(selected.url)} />
            </video>
            {selected.caption ? <p className="muted">{String(selected.caption)}</p> : null}
            <label className="field">
              <span>Feedback for the athlete</span>
              <textarea
                required
                maxLength={4000}
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </label>
            {submitError ? <p className="dashboard-status" role="status" aria-live="polite">{submitError}</p> : null}
            <button className="button primary" type="button" disabled={submitting} onClick={handleSendFeedback}>
              Send feedback
            </button>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
