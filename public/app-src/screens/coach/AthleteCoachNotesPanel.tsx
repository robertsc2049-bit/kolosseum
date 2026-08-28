import React, { useEffect, useRef, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteCoachNotes } from "./useAthleteCoachNotes";

// DEV NOTE: ported from index.html's #athleteDetailNoteForm and app.js's
// (removed) recordAthleteDetailNote(). See useAthleteCoachNotes.ts for the
// capability-object handshake POST /sessions/beta-coach-notes requires -
// unlike every other coach write path migrated so far, this needs a
// hash-signed coach_profile + relationship pair rather than deriving
// authorization from the session alone.
export function AthleteCoachNotesPanel() {
  const { athleteUserId, loading, error, notes, composing, submitting, submitError, cancelCompose, submit } =
    useAthleteCoachNotes();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [visibility, setVisibility] = useState("coach_private");

  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

  if (!athleteUserId) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const noteText = textareaRef.current?.value ?? "";
    const ok = await submit(noteText, visibility);
    if (ok) {
      setVisibility("coach_private");
      if (textareaRef.current) textareaRef.current.value = "";
    }
  }

  return (
    <>
      {loading && notes.length === 0 ? (
        <p className="muted small">Loading coach notes…</p>
      ) : error ? (
        <p role="status" className="muted small error">{error}</p>
      ) : notes.length === 0 ? (
        <div className="empty-state compact-empty">
          <h4>No coach notes</h4>
          <p>Non-binding notes recorded against sessions will appear here.</p>
        </div>
      ) : (
        notes.map((note, index) => <NoteCard key={String(note.note_id ?? index)} note={note} />)
      )}

      {composing ? (
        <form className="athlete-detail-note-form" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
          <label className="field">
            <span>Non-binding note</span>
            <textarea ref={textareaRef} required maxLength={2000}></textarea>
          </label>

          <label className="field">
            <span>Visibility</span>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="coach_private">Coach only</option>
              <option value="athlete_visible">Visible to athlete</option>
            </select>
          </label>

          {submitError ? <p role="status" className="muted small error">{submitError}</p> : null}

          <div className="inline-controls">
            <button className="button secondary" type="button" onClick={cancelCompose}>Cancel</button>
            <button className="button primary" type="submit" disabled={submitting}>Record note</button>
          </div>

          <p className="muted small">Notes are stored separately and do not alter session facts or engine output.</p>
        </form>
      ) : null}
    </>
  );
}

function NoteCard({ note }: { note: JsonRecord }) {
  return (
    <article className="record-card">
      <div>
        <h4>{note.visibility === "athlete_visible" ? "Athlete-visible note" : "Coach-only note"}</h4>
        <p>{String(note.note_text ?? "")}</p>
        <p className="muted small">Session: {String(note.session_id ?? "")}</p>
      </div>
      <span className="badge neutral">{formatDate(note.created_at)}</span>
    </article>
  );
}
