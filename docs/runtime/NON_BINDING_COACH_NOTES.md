# S38 — Non-Binding Coach Notes

Document: NON_BINDING_COACH_NOTES.md  
Status: v0 implementation contract  
Engine compatibility: EB2-1.0.0  
Scope: v0 Deterministic Execution Alpha  
Rewrite policy: rewrite-only  
Authority level: subordinate platform metadata contract

## 1. Purpose

This document defines non-binding coach notes for Kolosseum v0.

Coaches may write notes on factual execution artefacts when, and only when, they have an accepted coach-athlete link for the athlete attached to the artefact.

Coach notes are observational platform metadata.

Coach notes are not engine truth, not runtime events, not Phase 1 declarations, not substitutions, not progression, not legality, and not compile input.

## 2. Boundary statement

Coach notes must not:

- alter engine output;
- alter Phase 1 declarations;
- alter Phase 2 canonical input hash;
- alter Phase 3 constraints;
- alter Phase 4 enumeration;
- alter Phase 5 selection or materialisation;
- alter Phase 6 runtime truth;
- trigger substitution;
- trigger progression;
- change legality;
- change session artefacts;
- create or edit runtime events;
- become compile input;
- be interpreted by the system.

The system may store note_text exactly as submitted. The system must not classify, score, parse, summarise, explain, or act on note_text.

## 3. Required fields

The coach_notes record must include:

- note_id
- coach_user_id
- athlete_user_id
- session_id
- artefact_id
- note_text
- created_at
- updated_at
- deleted_at
- visibility
- non_binding

Rules:

- note_id is opaque and unique.
- coach_user_id is the note author.
- athlete_user_id is the athlete associated with the note.
- session_id is required.
- artefact_id is nullable only where a session note is created without a specific artefact.
- note_text is user-entered text and must be stored without system interpretation.
- created_at is immutable after insert.
- updated_at changes only when note_text, visibility, or deleted_at changes.
- deleted_at is null until soft deletion.
- visibility must be one of the closed values defined by S38.
- non_binding must always be true.

## 4. Visibility values

Allowed visibility values:

- coach_private
- athlete_visible

Visibility rules:

- coach_private means visible only to the note author and authorised platform controls.
- athlete_visible means visible to the linked athlete and linked coach while access is permitted.
- visibility does not create engine authority.
- visibility does not alter artefact truth.
- visibility does not alter coach relationship status.

## 5. Permission matrix

| Actor | Link status | Action | Result |
| --- | --- | --- | --- |
| linked coach | accepted | create note | allowed |
| linked coach | accepted | update own note | allowed |
| linked coach | accepted | soft delete own note | allowed |
| linked coach | accepted | read own note | allowed |
| linked coach | accepted | read athlete_visible note for linked athlete | allowed |
| athlete | not required for own account | read athlete_visible note on own artefact | allowed |
| athlete | not required for own account | create coach note | denied |
| unlinked coach | none | create note | denied |
| coach | invited link | create note | denied |
| coach | rejected link | create note | denied |
| coach | expired link | create note | denied |
| coach | revoked link | create note | denied |
| coach | accepted link to another athlete | create note | denied |
| unknown actor | any | any note action | denied |

## 6. Revoked link rule

A revoked coach-athlete link denies note creation, update, and future visibility.

Historical visibility is denied unless a later lawful policy explicitly defines retained historical note access. S38 defines no such policy.

If visibility after link revocation is unclear, fail closed.

## 7. SQL schema

The canonical SQL table is coach_notes.

Required invariants:

- non_binding must always be true.
- note_text must be stored as entered.
- deleted_at is used for soft deletion.
- visibility is a closed set.
- no engine field may reference coach_notes as input.
- no trigger may mutate session artefacts or runtime events.

Schema:

CREATE TABLE IF NOT EXISTS public.coach_notes (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL,
  athlete_user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  artefact_id uuid NULL,
  note_text text NOT NULL,
  visibility text NOT NULL,
  non_binding boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT coach_notes_visibility_chk CHECK (
    visibility IN ('coach_private', 'athlete_visible')
  ),
  CONSTRAINT coach_notes_non_binding_chk CHECK (non_binding IS TRUE),
  CONSTRAINT coach_notes_note_text_nonempty_chk CHECK (length(trim(note_text)) > 0)
);

CREATE INDEX IF NOT EXISTS coach_notes_athlete_session_idx
  ON public.coach_notes (athlete_user_id, session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coach_notes_coach_idx
  ON public.coach_notes (coach_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coach_notes_artefact_idx
  ON public.coach_notes (artefact_id)
  WHERE artefact_id IS NOT NULL AND deleted_at IS NULL;

## 8. API contract

### 8.1 Create note

Method:

POST

Path:

/v0/coach-notes

Required actor context:

- actor_type
- user_id

Request body:

- athlete_user_id
- session_id
- artefact_id
- note_text
- visibility

Rules:

- actor_type must be coach.
- actor user_id must match coach_user_id.
- coach must have accepted link to athlete_user_id.
- revoked, expired, rejected, invited, missing, or unrelated links deny creation.
- note_text is stored without system interpretation.
- non_binding is set to true by the platform and cannot be supplied as false.

Response 201:

- note_id
- coach_user_id
- athlete_user_id
- session_id
- artefact_id
- note_text
- visibility
- non_binding
- created_at
- updated_at
- deleted_at
- copy_ids

Response 403:

- error: coach_note_access_denied
- copy_id: COACH_NOTE_ACCESS_DENIED

Response 400:

- error: invalid_coach_note_request
- copy_id: COACH_NOTE_INVALID_REQUEST

### 8.2 Read notes for session

Method:

GET

Path:

/v0/coach-notes?session_id=:session_id&athlete_user_id=:athlete_user_id

Rules:

- linked accepted coach may read permitted notes for linked athlete.
- athlete may read athlete_visible notes attached to own account.
- revoked or unclear link state denies coach visibility.

Response 200:

- notes
- copy_ids

### 8.3 Update note

Method:

PATCH

Path:

/v0/coach-notes/:note_id

Rules:

- only the authoring coach may update the note;
- the coach-athlete link must still be accepted;
- only note_text and visibility may change;
- non_binding cannot change;
- session_id, athlete_user_id, coach_user_id, artefact_id, created_at cannot change.

Response 200:

- updated note

Response 403:

- error: coach_note_access_denied

### 8.4 Soft delete note

Method:

DELETE

Path:

/v0/coach-notes/:note_id

Rules:

- only the authoring coach may soft delete the note;
- the coach-athlete link must still be accepted;
- deletion sets deleted_at;
- deletion does not delete artefacts;
- deletion does not alter runtime truth.

Response 200:

- deleted note

### 8.5 Compile exclusion

Compile APIs must not accept coach_notes.

Any request attempting to pass coach_notes into compile must be rejected or ignored according to the compile API's closed-world contract. S38 defines coach_notes as outside compile input.

## 9. UI states

### 9.1 Notes panel

The UI must visually separate notes from factual artefacts.

Required label copy IDs:

- COACH_NOTES_PANEL_TITLE
- COACH_NOTE_NON_BINDING_LABEL
- COACH_NOTE_PLATFORM_METADATA_LABEL

### 9.2 Empty state

Copy ID:

- COACH_NOTES_EMPTY

### 9.3 Access denied

Copy ID:

- COACH_NOTE_ACCESS_DENIED

### 9.4 Create success

Copy ID:

- COACH_NOTE_CREATED

### 9.5 Update success

Copy ID:

- COACH_NOTE_UPDATED

### 9.6 Delete success

Copy ID:

- COACH_NOTE_DELETED

## 10. Copy rules

System copy must be neutral and must not contain interpretive claims.

Allowed system copy includes:

- Coach notes
- Non-binding note
- Platform metadata
- No coach notes recorded.
- Coach note saved.
- Coach note updated.
- Coach note deleted.
- This note does not change the session artefact.
- This note is not used by the engine.
- This note is stored separately from factual artefacts.

The UI must label notes as non-binding.

The UI must not imply:

- instruction authority;
- correction;
- recommendation;
- session judgement;
- athlete judgement;
- future programme change;
- engine involvement;
- artefact mutation;
- runtime truth mutation.

## 11. Visual separation rule

Coach notes must be rendered in a distinct panel, section, or card group separate from factual session artefacts.

The artefact viewer must not interleave coach notes with factual runtime events as if notes were runtime truth.

Each note must show the non-binding label.

## 12. Acceptance criteria

S38 is accepted only if tests prove:

1. Accepted linked coach can create a note.
2. Unlinked coach cannot create a note.
3. Revoked link blocks note creation.
4. Invited, rejected, and expired links block note creation.
5. Athlete cannot create coach note.
6. Note creation does not change engine output.
7. Note creation does not change session artefact.
8. non_binding is always true.
9. non_binding cannot be changed by update.
10. Notes are returned separately from factual artefacts.
11. User-entered note_text is stored exactly and not interpreted.
12. System copy labels notes as non-binding.
13. System copy separates notes from factual artefacts.

## 13. Final rule

Coach notes are observational metadata only.

If a coach note changes engine output, compile input, session artefacts, runtime events, substitution, progression, legality, or Phase 1 declarations, the build is invalid.