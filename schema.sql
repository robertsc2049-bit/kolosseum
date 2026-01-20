-- KOLOSSEUM v0 schema (PostgreSQL)
-- Idempotent: safe to run repeatedly in dev.

BEGIN;

-- ---------- core tables ----------

CREATE TABLE IF NOT EXISTS blocks (
  block_id           text PRIMARY KEY,
  engine_version     text NOT NULL,
  canonical_hash     text NOT NULL,
  phase1_input       jsonb NOT NULL,
  phase2_canonical   jsonb NOT NULL,
  phase3_output      jsonb NOT NULL,
  phase4_program     jsonb NOT NULL,
  phase5_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id      text PRIMARY KEY,
  block_id        text NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'created',
  planned_session jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_events (
  session_id  text NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  event       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

-- ---------- indexes / constraints ----------

CREATE UNIQUE INDEX IF NOT EXISTS blocks_canonical_hash_uq ON blocks(canonical_hash);

CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_block_id ON sessions(block_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_runtime_events_created_at ON runtime_events(created_at);

-- ---------- updated_at trigger ----------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sessions_set_updated_at'
  ) THEN
    CREATE TRIGGER sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
