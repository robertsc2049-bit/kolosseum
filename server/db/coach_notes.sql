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