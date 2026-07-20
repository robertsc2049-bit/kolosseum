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

  -- Nullable product/application ownership.
  -- These fields do not enter deterministic engine state.
  beta_subject_user_id  TEXT,
  beta_coach_user_id    TEXT,
  beta_assignment_id    TEXT,

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

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS beta_subject_user_id TEXT;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS beta_coach_user_id TEXT;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS beta_assignment_id TEXT;

CREATE INDEX IF NOT EXISTS
  idx_sessions_beta_subject_created
ON sessions (
  beta_subject_user_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_sessions_beta_coach_subject
ON sessions (
  beta_coach_user_id,
  beta_subject_user_id,
  created_at DESC
);

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

-- ----------------
-- BETA PRODUCT RECORDS
-- ----------------
-- Immutable product/application records only.
-- These records do not enter or modify deterministic engine truth.
CREATE TABLE IF NOT EXISTS beta_product_records (
  record_type       TEXT NOT NULL,
  record_id         TEXT NOT NULL,
  subject_user_id   TEXT NOT NULL,
  actor_user_id     TEXT NOT NULL,
  effective_at      TIMESTAMPTZ NOT NULL,
  record_sha256     TEXT NOT NULL,
  record_payload    JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (
    record_type,
    record_id,
    record_sha256
  ),

  CONSTRAINT beta_product_records_type_check
    CHECK (
      record_type IN (
        'beta16_auth',
        'beta16_acknowledgement',
        'beta16_phase1_declaration',
        'beta17_coach_profile',
        'beta17_coach_relationship',
        'beta17_assignment_trigger'
      )
    ),

  CONSTRAINT beta_product_records_hash_check
    CHECK (
      record_sha256 ~ '^[a-f0-9]{64}$'
    ),

  CONSTRAINT beta_product_records_payload_check
    CHECK (
      jsonb_typeof(record_payload) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS
  idx_beta_product_records_subject_type_effective
ON beta_product_records (
  subject_user_id,
  record_type,
  effective_at DESC,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_beta_product_records_actor_subject_type
ON beta_product_records (
  actor_user_id,
  subject_user_id,
  record_type,
  effective_at DESC,
  created_at DESC
);


-- beta_product_records_beta18_type_migration
-- Additive BETA-18 coach-authored programme template product records.
ALTER TABLE beta_product_records
  DROP CONSTRAINT IF EXISTS beta_product_records_type_check;

ALTER TABLE beta_product_records
  ADD CONSTRAINT beta_product_records_type_check
    CHECK (
      record_type IN (
        'beta16_auth',
        'beta16_acknowledgement',
        'beta16_phase1_declaration',
        'beta17_coach_profile',
        'beta17_coach_relationship',
        'beta17_assignment_trigger',
        'beta18_programme_template'
      )
    );
