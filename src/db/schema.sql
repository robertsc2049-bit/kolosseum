BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  session_id      text PRIMARY KEY,
  status          text NOT NULL DEFAULT 'not_started',
  planned_session jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Optional but useful if you plan to link sessions to blocks later
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS block_id text;

CREATE TABLE IF NOT EXISTS runtime_events (
  session_id text NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  seq       int  NOT NULL,
  event     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

CREATE INDEX IF NOT EXISTS runtime_events_session_id_seq_idx
  ON runtime_events (session_id, seq);

CREATE INDEX IF NOT EXISTS sessions_block_id_idx
  ON sessions (block_id);

COMMIT;