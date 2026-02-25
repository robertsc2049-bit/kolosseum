BEGIN;

-- sessions is anchored to blocks (FK); this repo already has blocks.
-- Runtime truth lives in sessions.session_state_summary (exercise objects), not planned_session, once started.

CREATE TABLE IF NOT EXISTS sessions (
  session_id            text PRIMARY KEY,
  block_id              text NOT NULL,
  status                text NOT NULL DEFAULT 'not_started',
  planned_session        jsonb NOT NULL,
  session_state_summary  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns exist on older DBs
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS block_id text;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_state_summary jsonb;

-- Enforce anchor: a session must reference a block.
-- (If the FK already exists under another name, this may raise; safe to ignore if it does.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_block_id_fkey'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_block_id_fkey
      FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE;
  END IF;
END$$;

-- Bring defaults in line with API expectations (idempotent)
ALTER TABLE sessions
  ALTER COLUMN status SET DEFAULT 'not_started';

UPDATE sessions
SET status = 'not_started'
WHERE status = 'created';

-- runtime events (append-only, monotonic seq)
CREATE TABLE IF NOT EXISTS runtime_events (
  session_id  text NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  seq         int  NOT NULL,
  event       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

CREATE INDEX IF NOT EXISTS runtime_events_session_id_seq_idx
  ON runtime_events (session_id, seq);

CREATE INDEX IF NOT EXISTS sessions_block_id_idx
  ON sessions (block_id);

-- O(1) monotonic seq allocator (one row per session)
CREATE TABLE IF NOT EXISTS session_event_seq (
  session_id text PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
  next_seq   int NOT NULL DEFAULT 0
);

ALTER TABLE session_event_seq
  ALTER COLUMN next_seq SET DEFAULT 0;

COMMIT;
-- hard invariant: runtime_events.seq is strictly positive
DO $$
BEGIN
  ALTER TABLE runtime_events
    ADD CONSTRAINT runtime_events_seq_ge_1 CHECK (seq >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
