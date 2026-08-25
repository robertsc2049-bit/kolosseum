import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteCoachNotes } from "./useAthleteCoachNotes";

// DEV NOTE: read-only history list only - note *creation* deliberately
// stays legacy (recordAthleteDetailNote, #athleteDetailNoteForm, the
// "Add note" triggers embedded in session-history rows). Unlike every
// other coach write path migrated so far, POST /sessions/beta-coach-notes
// requires a hash-signed coach_profile + relationship "capability object"
// pair (see beta17_coach_managed_service.ts's assertRecordIntegrity) issued
// once at sign-in and held in legacy's private state - not a session-
// cookie-derived write like /body-metrics/coach/:id or
// /coach-workspace/athlete-strength-profile. Migrating that write path
// needs its own dedicated slice to get the capability-object handling
// right, not a rushed extension of this one.
export function AthleteCoachNotesPanel() {
  const { athleteUserId, loading, error, notes } = useAthleteCoachNotes();

  if (!athleteUserId) return null;

  if (loading && notes.length === 0) {
    return <p className="muted small">Loading coach notes…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (notes.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <h4>No coach notes</h4>
        <p>Non-binding notes recorded against sessions will appear here.</p>
      </div>
    );
  }

  return (
    <>
      {notes.map((note, index) => (
        <NoteCard key={String(note.note_id ?? index)} note={note} />
      ))}
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
