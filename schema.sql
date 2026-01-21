-- ================================
-- KOLOSSEUM DATABASE SCHEMA
-- (idempotent + additive migrations)
-- ================================


-- ----------------
-- UTIL: updated_at trigger function
-- ----------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------
-- BLOCKS
-- ----------------
CREATE TABLE IF NOT EXISTS blocks (
  block_id          TEXT PRIMARY KEY,
  engine_version    TEXT NOT NULL,
  canonical_hash    TEXT NOT NULL UNIQUE,

  phase1_input      JSONB NOT NULL,
  phase2_canonical  JSONB NOT NULL,
  phase3_output     JSONB NOT NULL,
  phase4_program    JSONB NOT NULL,

  phase5_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON blocks(created_at);

-- ----------------
-- SESSIONS
-- ----------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id            TEXT PRIMARY KEY,
  block_id              TEXT NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,

  status                TEXT NOT NULL DEFAULT 'created',

  planned_session       JSONB NOT NULL,

  -- O(1) reads target (API may update this)
  session_state_summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_block_id   ON sessions(block_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Ensure updated_at stays correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'sessions_set_updated_at'
  ) THEN
    CREATE TRIGGER sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- Additive migration safety for existing DBs (if sessions was created earlier without the column)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_state_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ----------------
-- RUNTIME EVENTS
-- ----------------
CREATE TABLE IF NOT EXISTS runtime_events (
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  event      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_runtime_events_session ON runtime_events(session_id);

-- ----------------
-- SESSION EVENT SEQ (O(1) allocator per session)
-- ----------------
CREATE TABLE IF NOT EXISTS session_event_seq (
  session_id TEXT PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
  next_seq   INTEGER NOT NULL DEFAULT 1
);


