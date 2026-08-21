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
-- SESSION EVENT REQUESTS (idempotency dedup for /events retries)
-- ----------------
-- Records which client-supplied request id produced which runtime event
-- sequence number, so a duplicate submission or network retry replays the
-- prior sequence instead of appending a second runtime event.
CREATE TABLE IF NOT EXISTS session_event_requests (
  session_id        TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL,
  seq               INTEGER NOT NULL,
  event_json        JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, client_request_id)
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
-- Replay-safe superset constraint. BETA-19 rows may already exist when the
-- additive schema is reapplied, so this intermediate migration must not narrow
-- the lawful record-type surface before the BETA-19 migration executes.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link'
      )
    );


-- beta_product_records_beta19_type_migration
-- Additive BETA-19 factual athlete strength-reference records. These records
-- are explicit deterministic compile references, not inferred coaching state.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link'
      )
    );


-- beta_product_records_full_ui_28_type_migration
-- Additive FULL-UI-28 factual athlete progress-photo records. A progress
-- photo is a single immutable fact (an athlete-declared photo at a point in
-- time), never inferred, scored, or engine-visible.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo'
      )
    );


-- beta_product_records_full_ui_29_type_migration
-- Additive FULL-UI-29 factual body-metric and habit records. Each body
-- metric entry and habit completion is an independent immutable fact
-- (never a chained "profile"); habit_definition records the athlete's own
-- self-declared habit, never engine-visible, inferred, or scored - streak
-- counts are computed on read from these raw facts, never persisted.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion'
      )
    );


-- beta_product_records_full_ui_31_type_migration
-- Additive FULL-UI-31 / S-V1-P-06 factual device-sync records. A device
-- connection is an append-only fact stream keyed by connection_id (latest
-- row per connection_id wins, mirroring habit_definition's archival
-- pattern) - connect/disconnect never UPDATEs or DELETEs a row, it appends
-- a new fact. A device metric entry is an independent immutable fact for
-- metrics with no body_metric_entry equivalent (heart rate, steps, sleep);
-- overlapping metrics (e.g. weight) route to body_metric_entry with
-- source "device_synced" instead of duplicating the fact type. Neither
-- type is ever engine-visible, inferred, or scored - provider-computed
-- scores are rejected at ingestion, never stored.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry'
      )
    );

-- beta_product_records_full_ui_37_type_migration
-- Additive FULL-UI-37 athlete goal-setting record. A goal is a low-frequency
-- self-declared fact, mirroring habit_definition's own shape and archival
-- pattern exactly: one row per goal_id, superseded (never UPDATEd/DELETEd)
-- by a new row when the athlete manually resolves it as achieved or
-- abandoned - the newest row for a goal_id always wins on read. A goal
-- optionally links to an existing body-metric type; when it does, its
-- baseline value is captured once at creation time from the athlete's
-- then-latest body_metric_entry and never backfilled. Progress toward the
-- target is always computed fresh at read time from the athlete's current
-- body_metric_entry rows - never stored, never engine-visible, never
-- inferred.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry',
        'athlete_goal'
      )
    );

-- beta_product_records_full_ui_64_type_migration
-- Additive FULL-UI-64 athlete weekly check-in record. A check-in is a
-- self-declared factual wellness snapshot - energy, motivation and
-- sleep-quality ratings plus an optional note - mirroring
-- habit_completion's own append-only, one-row-per-submission shape.
-- Exactly one check-in is accepted per athlete per week_start_date; a
-- second submission for an already-submitted week is rejected at the
-- application layer rather than stored as a second row, so unlike
-- athlete_goal/habit_definition there is never more than one row per
-- checkin_id to disambiguate on read.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry',
        'athlete_goal',
        'weekly_checkin_entry'
      )
    );

-- beta_product_records_full_ui_65_type_migration
-- Additive FULL-UI-65 coach branding preference record. A brand
-- preference (accent colour, optional tagline) is a coach's own declared
-- presentation choice, additive to and separate from beta17_coach_profile
-- - it never touches that record's fixed field shape, which the wider
-- test suite creates directly via a strict exact-key contract. One
-- preference exists per coach_user_id, superseded (never UPDATEd/
-- DELETEd) by a new row on save, mirroring athlete_goal's own archival
-- pattern.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry',
        'athlete_goal',
        'weekly_checkin_entry',
        'coach_brand_preference'
      )
    );

-- beta_product_records_full_ui_67_type_migration
-- Additive FULL-UI-67 programme template marketplace visibility record.
-- Sharing a template is the owning coach's own declared visibility
-- choice, additive to and separate from beta18_programme_template - it
-- never touches that record's own field contract. One sharing
-- preference exists per template_id, superseded (never UPDATEd/
-- DELETEd) by a new row on save, mirroring coach_brand_preference's own
-- archival pattern.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry',
        'athlete_goal',
        'weekly_checkin_entry',
        'coach_brand_preference',
        'programme_template_sharing_preference'
      )
    );

-- beta_product_records_full_ui_68_type_migration
-- Additive FULL-UI-68 programme template release record. A release is a
-- factual, immutable event: the owning coach released a copy of their
-- own shared template to a specific buying coach, after being paid
-- through whatever means the two coaches arranged off-platform - this
-- application never processes, holds, or transmits any payment. Many
-- release rows can exist per template (one per buyer); each is its own
-- append-only record, never UPDATEd or DELETEd.
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
        'beta18_programme_template',
        'beta19_athlete_strength_profile',
        'beta19_coach_event',
        'beta19_event_athlete_link',
        'beta_progress_photo',
        'body_metric_entry',
        'habit_definition',
        'habit_completion',
        'device_connection_record',
        'device_metric_entry',
        'athlete_goal',
        'weekly_checkin_entry',
        'coach_brand_preference',
        'programme_template_sharing_preference',
        'programme_template_release'
      )
    );

-- FULL-UI-02 PRODUCT ACCOUNT ACCESS

-- FULL-UI-02 runtime account principal bridge.
CREATE TABLE IF NOT EXISTS beta_accounts (
  user_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL
    CHECK (
      actor_type IN (
        'individual_user',
        'coach'
      )
    ),
  account_state TEXT NOT NULL
    CHECK (
      account_state IN (
        'active',
        'suspended'
      )
    )
);
CREATE TABLE IF NOT EXISTS product_accounts (
  user_id text PRIMARY KEY,
  email_canonical text NOT NULL UNIQUE,
  display_name text NOT NULL,
  actor_type text NOT NULL
    CHECK (actor_type IN ('athlete', 'coach')),
  account_state text NOT NULL DEFAULT 'active'
    CHECK (
      account_state IN (
        'active',
        'suspended',
        'closed',
        'deleted'
      )
    ),
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  accepted_terms_version text NOT NULL,
  accepted_consent_version text NOT NULL,
  failed_sign_in_count integer NOT NULL DEFAULT 0
    CHECK (failed_sign_in_count >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_auth_sessions (
  session_hash text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent_hash text NOT NULL
);

CREATE INDEX IF NOT EXISTS
  product_auth_sessions_user_id_idx
ON product_auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS
  product_auth_sessions_expiry_idx
ON product_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS product_auth_challenges (
  challenge_id text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  challenge_type text NOT NULL
    CHECK (
      challenge_type IN (
        'email_verification',
        'password_reset'
      )
    ),
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS
  product_auth_challenges_user_idx
ON product_auth_challenges(
  user_id,
  challenge_type,
  created_at DESC
);

CREATE TABLE IF NOT EXISTS product_account_events (
  event_id text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  product_account_events_user_idx
ON product_account_events(
  user_id,
  occurred_at DESC
);

CREATE TABLE IF NOT EXISTS product_account_closure_requests (
  closure_request_id text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  request_state text NOT NULL
    CHECK (
      request_state IN (
        'requested',
        'completed',
        'cancelled'
      )
    ),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS
  product_account_closure_user_idx
ON product_account_closure_requests(
  user_id,
  requested_at DESC
);

-- FULL-UI-19 DATA RIGHTS AND CONSENT
-- Complete personal-data export requests, generated server-side through the
-- existing sealed S-V1-L-02 GDPR export boundary. This is a lawfully-expiring
-- artefact record only - it never stores credentials, and access is always
-- re-checked against the caller's own authenticated session at download time.
CREATE TABLE IF NOT EXISTS data_export_requests (
  export_request_id text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'ready',
        'expired',
        'failed'
      )
    ),
  requested_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  expires_at timestamptz,
  export_payload jsonb,
  export_payload_hash text,
  included_category_counts jsonb,
  downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  data_export_requests_user_idx
ON data_export_requests(
  user_id,
  requested_at DESC
);

-- Deletion (erasure) requests, recorded through the existing sealed S-V1-L-03
-- GDPR delete queue contract. This table only ever persists a queued review
-- state - it never performs or records a hard delete of any row.
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  deletion_request_id text PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  reason_code text NOT NULL,
  queue_status text NOT NULL DEFAULT 'queued_for_review',
  request_hash text NOT NULL,
  retained_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_boundary jsonb NOT NULL,
  client_request_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS
  data_deletion_requests_user_idx
ON data_deletion_requests(
  user_id,
  requested_at DESC
);

-- FULL-UI-04B COACH NOTE HISTORY
-- Immutable, non-binding coach commentary is stored separately from session
-- artefacts and deterministic engine state.
CREATE TABLE IF NOT EXISTS product_coach_notes (
  note_id          TEXT PRIMARY KEY,
  coach_user_id    TEXT NOT NULL,
  athlete_user_id  TEXT NOT NULL,
  relationship_id  TEXT NOT NULL,
  session_id       TEXT NOT NULL,
  artefact_id      TEXT NOT NULL,
  note_text        TEXT NOT NULL,
  visibility       TEXT NOT NULL
    CHECK (
      visibility IN (
        'coach_private',
        'athlete_visible'
      )
    ),
  record_sha256    TEXT NOT NULL
    CHECK (
      record_sha256 ~ '^[a-f0-9]{64}$'
    ),
  note_payload     JSONB NOT NULL
    CHECK (
      jsonb_typeof(note_payload) =
        'object'
    ),
  created_at       TIMESTAMPTZ NOT NULL
    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  idx_product_coach_notes_coach_athlete_created
ON product_coach_notes (
  coach_user_id,
  athlete_user_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_product_coach_notes_session_created
ON product_coach_notes (
  session_id,
  created_at DESC
);

-- FULL-UI-07 DURABLE COACH REVIEW STATE
-- Immutable product review transitions remain separate from session artefacts,
-- runtime events and deterministic engine state.
CREATE TABLE IF NOT EXISTS product_session_reviews (
  review_record_id  TEXT PRIMARY KEY,
  coach_user_id     TEXT NOT NULL,
  athlete_user_id   TEXT NOT NULL,
  relationship_id   TEXT NOT NULL,
  session_id        TEXT NOT NULL,
  artefact_id       TEXT NOT NULL,
  review_status     TEXT NOT NULL
    CHECK (
      review_status IN (
        'reviewed',
        'unreviewed'
      )
    ),
  reviewed_at       TIMESTAMPTZ,
  recorded_at       TIMESTAMPTZ NOT NULL,
  record_sha256     TEXT NOT NULL
    CHECK (
      record_sha256 ~
        '^[a-f0-9]{64}$'
    ),
  review_payload    JSONB NOT NULL
    CHECK (
      jsonb_typeof(
        review_payload
      ) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS
  idx_product_session_reviews_coach_recorded
ON product_session_reviews (
  coach_user_id,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_product_session_reviews_session_recorded
ON product_session_reviews (
  session_id,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_product_session_reviews_coach_athlete
ON product_session_reviews (
  coach_user_id,
  athlete_user_id,
  recorded_at DESC
);
-- FULL-UI-08 controlled-launch commercial product records.
-- Commercial state is immutable product state and is never engine input.
CREATE TABLE IF NOT EXISTS product_commercial_records (
  commercial_record_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  record_type TEXT NOT NULL
    CHECK (
      record_type IN (
        'commercial_checkout_requested',
        'commercial_payment_return_recorded',
        'commercial_billing_access_updated',
        'commercial_portal_requested'
      )
    ),
  effective_at TIMESTAMPTZ NOT NULL,
  record_payload JSONB NOT NULL,
  record_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS
  idx_product_commercial_records_user_effective
ON product_commercial_records (
  user_id,
  effective_at DESC,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_product_commercial_records_type_effective
ON product_commercial_records (
  record_type,
  effective_at DESC
);

-- FULL-UI-18 factual in-product notifications.
-- Every row is derived from an explicit, already-durable product event
-- (relationship, assignment, event, session, coach-note or commercial
-- record). Notifications never carry inferred urgency, priority or risk
-- language. One row per (recipient, notification_type, source_record_id) -
-- ON CONFLICT DO NOTHING makes derivation idempotent and safe to re-run.
CREATE TABLE IF NOT EXISTS product_notifications (
  notification_id      TEXT PRIMARY KEY,
  recipient_user_id     TEXT NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  notification_type     TEXT NOT NULL
    CHECK (
      notification_type IN (
        'relationship_invited',
        'relationship_accepted',
        'relationship_declined',
        'relationship_revoked',
        'assignment_created',
        'assignment_replaced',
        'assignment_cancelled',
        'event_linked',
        'event_unlinked',
        'event_cancelled',
        'programme_available',
        'session_completed',
        'coach_note_visible',
        'billing_action_required',
        'marketplace_template_released',
        'weekly_checkin_submitted',
        'video_feedback_received',
        'athlete_goal_achieved'
      )
    ),
  source_record_type    TEXT NOT NULL,
  source_record_id      TEXT NOT NULL,
  deep_link_route_id     TEXT NOT NULL,
  deep_link_params       JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at           TIMESTAMPTZ NOT NULL,
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, notification_type, source_record_id)
);

CREATE INDEX IF NOT EXISTS
  idx_product_notifications_recipient_unread
ON product_notifications (
  recipient_user_id,
  read_at,
  occurred_at DESC
);

-- product_notifications_full_ui_68_type_migration
-- Additive FULL-UI-68 marketplace_template_released notification type. The
-- CREATE TABLE IF NOT EXISTS above never re-runs against an
-- already-existing table, so widening its inline notification_type CHECK
-- needs this explicit migration too - the same DROP/ADD pattern already
-- used for beta_product_records_type_check, targeting Postgres's default
-- column-check name for this table.
ALTER TABLE product_notifications
  DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check;

ALTER TABLE product_notifications
  ADD CONSTRAINT product_notifications_notification_type_check
    CHECK (
      notification_type IN (
        'relationship_invited',
        'relationship_accepted',
        'relationship_declined',
        'relationship_revoked',
        'assignment_created',
        'assignment_replaced',
        'assignment_cancelled',
        'event_linked',
        'event_unlinked',
        'event_cancelled',
        'programme_available',
        'session_completed',
        'coach_note_visible',
        'billing_action_required',
        'marketplace_template_released'
      )
    );

-- product_notifications_full_ui_71_type_migration
-- Additive FULL-UI-71 weekly_checkin_submitted notification type - same
-- reason and same DROP/ADD pattern as the FULL-UI-68 migration above.
ALTER TABLE product_notifications
  DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check;

ALTER TABLE product_notifications
  ADD CONSTRAINT product_notifications_notification_type_check
    CHECK (
      notification_type IN (
        'relationship_invited',
        'relationship_accepted',
        'relationship_declined',
        'relationship_revoked',
        'assignment_created',
        'assignment_replaced',
        'assignment_cancelled',
        'event_linked',
        'event_unlinked',
        'event_cancelled',
        'programme_available',
        'session_completed',
        'coach_note_visible',
        'billing_action_required',
        'marketplace_template_released',
        'weekly_checkin_submitted'
      )
    );

-- product_notifications_full_ui_72_type_migration
-- Additive FULL-UI-72 video_feedback_received notification type - same
-- reason and same DROP/ADD pattern as the FULL-UI-68 migration above.
ALTER TABLE product_notifications
  DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check;

ALTER TABLE product_notifications
  ADD CONSTRAINT product_notifications_notification_type_check
    CHECK (
      notification_type IN (
        'relationship_invited',
        'relationship_accepted',
        'relationship_declined',
        'relationship_revoked',
        'assignment_created',
        'assignment_replaced',
        'assignment_cancelled',
        'event_linked',
        'event_unlinked',
        'event_cancelled',
        'programme_available',
        'session_completed',
        'coach_note_visible',
        'billing_action_required',
        'marketplace_template_released',
        'weekly_checkin_submitted',
        'video_feedback_received'
      )
    );

-- product_notifications_full_ui_73_type_migration
-- Additive FULL-UI-73 athlete_goal_achieved notification type - same
-- reason and same DROP/ADD pattern as the FULL-UI-68 migration above.
ALTER TABLE product_notifications
  DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check;

ALTER TABLE product_notifications
  ADD CONSTRAINT product_notifications_notification_type_check
    CHECK (
      notification_type IN (
        'relationship_invited',
        'relationship_accepted',
        'relationship_declined',
        'relationship_revoked',
        'assignment_created',
        'assignment_replaced',
        'assignment_cancelled',
        'event_linked',
        'event_unlinked',
        'event_cancelled',
        'programme_available',
        'session_completed',
        'coach_note_visible',
        'billing_action_required',
        'marketplace_template_released',
        'weekly_checkin_submitted',
        'video_feedback_received',
        'athlete_goal_achieved'
      )
    );

-- FULL-UI-20 factual status, support and error-reporting.
-- Every row stores only an explicit, narrow allowlist of caller-supplied
-- context (never a raw error payload, stack trace, header set, cookie or
-- token - that redaction happens in the service layer before this INSERT
-- is ever built). status starts at 'submitted' and only ever changes
-- through direct operator action on this table; the product client never
-- writes 'acknowledged' or 'closed' itself.
CREATE TABLE IF NOT EXISTS product_support_requests (
  correlation_id   TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  route_hash       TEXT NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL,
  description      TEXT NOT NULL
    CHECK (
      char_length(description) BETWEEN 1 AND 4000
    ),
  browser_context  JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (
      jsonb_typeof(browser_context) = 'object'
    ),
  failure_context  JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (
      jsonb_typeof(failure_context) = 'object'
    ),
  status           TEXT NOT NULL DEFAULT 'submitted'
    CHECK (
      status IN ('submitted', 'acknowledged', 'closed')
    ),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  idx_product_support_requests_user_created
ON product_support_requests (
  user_id,
  created_at DESC
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_support_requests_set_updated_at'
  ) THEN
    CREATE TRIGGER product_support_requests_set_updated_at
    BEFORE UPDATE ON product_support_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- FULL-UI-21 founder/admin operations.
-- Deliberately a wholly separate identity/session surface from
-- product_accounts/product_auth_sessions - a founder/admin account is
-- never an athlete/coach actor_type, is never created through the public
-- /account/register route, and its session cookie is never the same
-- cookie an athlete or coach session uses. This keeps "an admin action can
-- never flow into engine/relationship/session truth" true by physical
-- separation rather than by policing every call site.
CREATE TABLE IF NOT EXISTS product_admin_accounts (
  user_id          TEXT PRIMARY KEY,
  email_canonical  TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  account_state    TEXT NOT NULL DEFAULT 'active'
    CHECK (
      account_state IN ('active', 'suspended')
    ),
  failed_sign_in_count INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_admin_accounts_set_updated_at'
  ) THEN
    CREATE TRIGGER product_admin_accounts_set_updated_at
    BEFORE UPDATE ON product_admin_accounts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS product_admin_sessions (
  session_hash  TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL
    REFERENCES product_admin_accounts(user_id)
    ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS
  idx_product_admin_sessions_user
ON product_admin_sessions (
  user_id,
  expires_at DESC
);

-- A marker table, not a column on product_accounts - lower blast radius,
-- and it makes "which accounts are test accounts" its own explicit,
-- append-and-remove record rather than a silent flag threaded through the
-- athlete/coach account model.
CREATE TABLE IF NOT EXISTS product_test_accounts (
  user_id                  TEXT PRIMARY KEY
    REFERENCES product_accounts(user_id)
    ON DELETE CASCADE,
  marked_by_admin_user_id  TEXT NOT NULL
    REFERENCES product_admin_accounts(user_id),
  reason                   TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable operational audit trail. Append-only by design - no
-- updated_at, no in-place edits. One row per confirmed admin action, with
-- an explicit before/after factual state and a caller-supplied correlation
-- id so a duplicate submission (e.g. a double-click) replays rather than
-- creating a second audit record for the same action.
CREATE TABLE IF NOT EXISTS product_admin_audit_records (
  audit_record_id      TEXT PRIMARY KEY,
  actor_user_id         TEXT NOT NULL
    REFERENCES product_admin_accounts(user_id),
  action_type           TEXT NOT NULL
    CHECK (
      action_type IN (
        'account_state_change',
        'test_account_marked',
        'test_account_unmarked',
        'support_request_status_change'
      )
    ),
  target_record_type    TEXT NOT NULL,
  target_record_id      TEXT NOT NULL,
  before_state          JSONB NOT NULL
    CHECK (
      jsonb_typeof(before_state) = 'object'
    ),
  after_state           JSONB NOT NULL
    CHECK (
      jsonb_typeof(after_state) = 'object'
    ),
  correlation_id        TEXT NOT NULL,
  record_sha256         TEXT NOT NULL
    CHECK (
      record_sha256 ~ '^[a-f0-9]{64}$'
    ),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (actor_user_id, correlation_id)
);

CREATE INDEX IF NOT EXISTS
  idx_product_admin_audit_records_target
ON product_admin_audit_records (
  target_record_type,
  target_record_id,
  created_at DESC
);

-- Organisation/team billing and roster shell (commercial expansion, part B).
-- An org owner is a wholly separate identity/session surface from
-- product_accounts and product_admin_accounts, mirroring the same physical-
-- separation pattern proven for founder/admin accounts. None of these
-- tables carry an athlete_user_id column, a session_id column, or an FK
-- into beta_product_records - an org owner has no schema path to any
-- athlete-scoped data, by construction, not by policy. The actual coach-
-- athlete relationship model is entirely untouched by this expansion; an
-- org only groups EXISTING coach accounts under shared billing/roster
-- management.
CREATE TABLE IF NOT EXISTS product_org_owner_accounts (
  user_id          TEXT PRIMARY KEY,
  email_canonical  TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  account_state    TEXT NOT NULL DEFAULT 'active'
    CHECK (
      account_state IN ('active', 'suspended', 'closed')
    ),
  failed_sign_in_count INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_org_owner_accounts_set_updated_at'
  ) THEN
    CREATE TRIGGER product_org_owner_accounts_set_updated_at
    BEFORE UPDATE ON product_org_owner_accounts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS product_org_owner_sessions (
  session_hash  TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL
    REFERENCES product_org_owner_accounts(user_id)
    ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS
  idx_product_org_owner_sessions_user
ON product_org_owner_sessions (
  user_id,
  expires_at DESC
);

CREATE TABLE IF NOT EXISTS product_organisations (
  org_id        TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL
    REFERENCES product_org_owner_accounts(user_id),
  org_name      TEXT NOT NULL,
  org_state     TEXT NOT NULL DEFAULT 'active'
    CHECK (
      org_state IN ('active', 'suspended', 'closed')
    ),
  -- Real, per-org seat allowance (part B.3, seat-entitlement billing) - set
  -- at creation from the controlled-launch default and changed only
  -- through an explicit, audited seat_plan_changed action. Unlike the
  -- single-coach commercial config (env-var only, one global limit), each
  -- org carries its own persisted limit.
  seat_limit    INTEGER
    CHECK (
      seat_limit IS NULL OR seat_limit > 0
    ),
  -- Part C, org-owner athlete visibility - declared once at creation and
  -- immutable afterward (by design: this makes silent widening of an
  -- already-joined coach's exposure structurally impossible rather than
  -- policed). 'individual' (default) exposes aggregate athlete counts per
  -- coach only, never an athlete_user_id or name - for gyms billing
  -- independent coaches. 'shared' exposes a real per-coach athlete roster -
  -- for teams/units where the org owner already is the coaching authority.
  visibility_mode TEXT NOT NULL DEFAULT 'individual'
    CHECK (
      visibility_mode IN ('individual', 'shared')
    ),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration for environments that already applied the original B.1
-- product_organisations shape (no seat_limit column) before this fix
-- landed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_organisations'
      AND column_name = 'seat_limit'
  ) THEN
    ALTER TABLE product_organisations ADD COLUMN seat_limit INTEGER;
    ALTER TABLE product_organisations
      ADD CONSTRAINT product_organisations_seat_limit_check
      CHECK (seat_limit IS NULL OR seat_limit > 0);
  END IF;
END;
$$;

-- Migration for environments that already applied the product_organisations
-- shape from before Part C (no visibility_mode column).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_organisations'
      AND column_name = 'visibility_mode'
  ) THEN
    ALTER TABLE product_organisations
      ADD COLUMN visibility_mode TEXT NOT NULL DEFAULT 'individual';
    ALTER TABLE product_organisations
      ADD CONSTRAINT product_organisations_visibility_mode_check
      CHECK (visibility_mode IN ('individual', 'shared'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_organisations_set_updated_at'
  ) THEN
    CREATE TRIGGER product_organisations_set_updated_at
    BEFORE UPDATE ON product_organisations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS
  idx_product_organisations_owner
ON product_organisations (
  owner_user_id
);

-- Roster membership: which EXISTING coach accounts belong to which org.
-- No athlete_user_id anywhere in this table on purpose - membership is a
-- billing/roster fact only, never a data-visibility grant.
CREATE TABLE IF NOT EXISTS product_org_coach_memberships (
  membership_id     TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL
    REFERENCES product_organisations(org_id)
    ON DELETE CASCADE,
  coach_user_id     TEXT NOT NULL
    REFERENCES product_accounts(user_id),
  membership_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (
      membership_status IN ('invited', 'active', 'removed')
    ),
  invited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at      TIMESTAMPTZ,
  removed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (org_id, coach_user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_org_coach_memberships_set_updated_at'
  ) THEN
    CREATE TRIGGER product_org_coach_memberships_set_updated_at
    BEFORE UPDATE ON product_org_coach_memberships
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS
  idx_product_org_coach_memberships_coach
ON product_org_coach_memberships (
  coach_user_id,
  membership_status
);

-- Immutable operational audit trail for org billing/roster actions,
-- mirroring product_admin_audit_records's shape (append-only, correlation-
-- id deduped, explicit before/after factual state). Unlike the admin audit
-- table, the actor here can be EITHER the org owner (create/invite/remove/
-- billing) OR the invited coach acting on their own membership (accept/
-- leave) - mirroring the coach-athlete relationship ledger's symmetric
-- self-service pattern. actor_user_id therefore carries no single-table FK
-- (same reasoning as beta_product_records.actor_user_id); actor_role
-- records which identity surface the id belongs to.
CREATE TABLE IF NOT EXISTS product_org_audit_records (
  audit_record_id  TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL
    REFERENCES product_organisations(org_id),
  actor_user_id    TEXT NOT NULL,
  actor_role       TEXT NOT NULL
    CHECK (
      actor_role IN ('org_owner', 'coach')
    ),
  action_type      TEXT NOT NULL
    CHECK (
      action_type IN (
        'org_created',
        'coach_invited',
        'coach_membership_activated',
        'coach_membership_removed',
        'coach_membership_left',
        'seat_plan_changed'
      )
    ),
  before_state     JSONB NOT NULL
    CHECK (
      jsonb_typeof(before_state) = 'object'
    ),
  after_state      JSONB NOT NULL
    CHECK (
      jsonb_typeof(after_state) = 'object'
    ),
  correlation_id   TEXT NOT NULL,
  record_sha256    TEXT NOT NULL
    CHECK (
      record_sha256 ~ '^[a-f0-9]{64}$'
    ),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (actor_user_id, correlation_id)
);

CREATE INDEX IF NOT EXISTS
  idx_product_org_audit_records_org
ON product_org_audit_records (
  org_id,
  created_at DESC
);

-- Migration for environments that already applied the original B.1
-- product_org_audit_records shape (org-owner-only actor FK, no coach-
-- initiated actions in the action_type enum) before this fix landed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'product_org_audit_records'
      AND constraint_name = 'product_org_audit_records_actor_user_id_fkey'
  ) THEN
    ALTER TABLE product_org_audit_records
      DROP CONSTRAINT product_org_audit_records_actor_user_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_org_audit_records'
      AND column_name = 'actor_role'
  ) THEN
    ALTER TABLE product_org_audit_records
      ADD COLUMN actor_role TEXT;
    UPDATE product_org_audit_records SET actor_role = 'org_owner' WHERE actor_role IS NULL;
    ALTER TABLE product_org_audit_records
      ALTER COLUMN actor_role SET NOT NULL;
    ALTER TABLE product_org_audit_records
      ADD CONSTRAINT product_org_audit_records_actor_role_check
      CHECK (actor_role IN ('org_owner', 'coach'));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'product_org_audit_records'
      AND constraint_name = 'product_org_audit_records_action_type_check'
  ) THEN
    ALTER TABLE product_org_audit_records
      DROP CONSTRAINT product_org_audit_records_action_type_check;
    ALTER TABLE product_org_audit_records
      ADD CONSTRAINT product_org_audit_records_action_type_check
      CHECK (
        action_type IN (
          'org_created',
          'coach_invited',
          'coach_membership_activated',
          'coach_membership_removed',
          'coach_membership_left',
          'seat_plan_changed'
        )
      );
  END IF;
END;
$$;

-- Part D - messaging. thread_type discriminates between coach_athlete
-- threads (a coach and their currently-accepted athlete), org_owner_coach
-- threads (an org owner and an active-member coach of their org), and
-- org_owner_athlete threads (part D.4 - an org owner and an athlete
-- currently coached by one of that org's active coaches, gated by the
-- org's visibility_mode = 'shared' - see org_athlete_messaging_service.ts).
-- Exactly one shape of {coach_user_id, athlete_user_id, org_id} is
-- populated per row, enforced by the CHECK below.
CREATE TABLE IF NOT EXISTS product_message_threads (
  thread_id        TEXT PRIMARY KEY,
  thread_type      TEXT NOT NULL
    CHECK (
      thread_type IN ('coach_athlete', 'org_owner_coach', 'org_owner_athlete')
    ),
  coach_user_id    TEXT
    REFERENCES product_accounts(user_id),
  athlete_user_id  TEXT
    REFERENCES product_accounts(user_id),
  org_id           TEXT
    REFERENCES product_organisations(org_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (thread_type = 'coach_athlete' AND coach_user_id IS NOT NULL AND athlete_user_id IS NOT NULL AND org_id IS NULL)
    OR
    (thread_type = 'org_owner_coach' AND coach_user_id IS NOT NULL AND org_id IS NOT NULL AND athlete_user_id IS NULL)
    OR
    (thread_type = 'org_owner_athlete' AND coach_user_id IS NULL AND org_id IS NOT NULL AND athlete_user_id IS NOT NULL)
  )
);

-- A plain multi-column UNIQUE would not work here - NULL <> NULL in
-- Postgres, so it would silently allow duplicate org_owner_coach/
-- org_owner_athlete threads (their unused id column is always NULL).
-- Partial unique indexes, scoped per thread_type, are the correct
-- construct.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_product_message_threads_coach_athlete_unique
ON product_message_threads (coach_user_id, athlete_user_id)
WHERE thread_type = 'coach_athlete';

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_product_message_threads_org_owner_coach_unique
ON product_message_threads (org_id, coach_user_id)
WHERE thread_type = 'org_owner_coach';

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_product_message_threads_org_owner_athlete_unique
ON product_message_threads (org_id, athlete_user_id)
WHERE thread_type = 'org_owner_athlete';

-- Migration for environments that already applied product_message_threads
-- before org_owner_athlete threads (Part D.4) landed. coach_user_id must
-- become nullable before the widened shape CHECK is installed, since the
-- new thread type requires it to be NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'product_message_threads_thread_type_check'
      AND check_clause LIKE '%org_owner_athlete%'
  ) THEN
    ALTER TABLE product_message_threads ALTER COLUMN coach_user_id DROP NOT NULL;

    ALTER TABLE product_message_threads DROP CONSTRAINT IF EXISTS product_message_threads_thread_type_check;
    ALTER TABLE product_message_threads
      ADD CONSTRAINT product_message_threads_thread_type_check
      CHECK (thread_type IN ('coach_athlete', 'org_owner_coach', 'org_owner_athlete'));

    ALTER TABLE product_message_threads DROP CONSTRAINT IF EXISTS product_message_threads_check;
    ALTER TABLE product_message_threads
      ADD CONSTRAINT product_message_threads_shape_check
      CHECK (
        (thread_type = 'coach_athlete' AND coach_user_id IS NOT NULL AND athlete_user_id IS NOT NULL AND org_id IS NULL)
        OR
        (thread_type = 'org_owner_coach' AND coach_user_id IS NOT NULL AND org_id IS NOT NULL AND athlete_user_id IS NULL)
        OR
        (thread_type = 'org_owner_athlete' AND coach_user_id IS NULL AND org_id IS NOT NULL AND athlete_user_id IS NOT NULL)
      );
  END IF;
END;
$$;

-- No length bound exists on product_coach_notes.note_text (this
-- codebase's only prior free-text precedent) - messages are much
-- higher-frequency, so a deliberate cap is added here rather than
-- blindly copying the unbounded precedent.
--
-- Part D.3 - photo/video attachments. body_text becomes an optional
-- caption when an attachment is present (still bounded/non-blank when
-- it IS present), never both absent. The four core attachment columns
-- are all-NULL or all-NOT-NULL together (no state where only some are
-- set); the thumbnail key is video-only, and nullable even then - a
-- failed poster extraction (message_attachment_storage.ts) is a valid,
-- storable outcome, never a reason to fail the send.
CREATE TABLE IF NOT EXISTS product_messages (
  message_id         TEXT PRIMARY KEY,
  thread_id          TEXT NOT NULL
    REFERENCES product_message_threads(thread_id)
    ON DELETE CASCADE,
  sender_user_id     TEXT NOT NULL,
  sender_role        TEXT NOT NULL
    CHECK (
      sender_role IN ('coach', 'athlete', 'org_owner')
    ),
  body_text          TEXT
    CHECK (
      (body_text IS NULL AND attachment_media_type IS NOT NULL)
      OR
      (body_text IS NOT NULL AND char_length(btrim(body_text)) BETWEEN 1 AND 4000)
    ),
  attachment_media_type             TEXT
    CHECK (
      attachment_media_type IS NULL OR attachment_media_type IN ('image', 'video')
    ),
  attachment_mime_type              TEXT,
  attachment_byte_size              INTEGER
    CHECK (
      attachment_byte_size IS NULL OR attachment_byte_size > 0
    ),
  attachment_storage_key            TEXT,
  attachment_thumbnail_storage_key  TEXT,
  client_request_id  TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (thread_id, sender_user_id, client_request_id),

  CHECK (
    (
      attachment_media_type IS NULL
      AND attachment_mime_type IS NULL
      AND attachment_byte_size IS NULL
      AND attachment_storage_key IS NULL
    )
    OR
    (
      attachment_media_type IS NOT NULL
      AND attachment_mime_type IS NOT NULL
      AND attachment_byte_size IS NOT NULL
      AND attachment_storage_key IS NOT NULL
    )
  ),
  CHECK (
    attachment_thumbnail_storage_key IS NULL OR attachment_media_type = 'video'
  )
);

CREATE INDEX IF NOT EXISTS
  idx_product_messages_thread
ON product_messages (
  thread_id,
  created_at ASC
);

-- Migration for environments that already applied product_messages before
-- attachment support (Part D.3) landed. Attachment columns must be added
-- BEFORE the body_text CHECK is replaced, since the new CHECK references
-- attachment_media_type.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_messages' AND column_name = 'attachment_media_type'
  ) THEN
    ALTER TABLE product_messages ADD COLUMN attachment_media_type TEXT;
    ALTER TABLE product_messages ADD COLUMN attachment_mime_type TEXT;
    ALTER TABLE product_messages ADD COLUMN attachment_byte_size INTEGER;
    ALTER TABLE product_messages ADD COLUMN attachment_storage_key TEXT;
    ALTER TABLE product_messages ADD COLUMN attachment_thumbnail_storage_key TEXT;

    ALTER TABLE product_messages
      ADD CONSTRAINT product_messages_attachment_media_type_check
      CHECK (attachment_media_type IS NULL OR attachment_media_type IN ('image', 'video'));

    ALTER TABLE product_messages
      ADD CONSTRAINT product_messages_attachment_byte_size_check
      CHECK (attachment_byte_size IS NULL OR attachment_byte_size > 0);

    ALTER TABLE product_messages
      ADD CONSTRAINT product_messages_attachment_columns_consistency_check
      CHECK (
        (attachment_media_type IS NULL AND attachment_mime_type IS NULL
          AND attachment_byte_size IS NULL AND attachment_storage_key IS NULL)
        OR
        (attachment_media_type IS NOT NULL AND attachment_mime_type IS NOT NULL
          AND attachment_byte_size IS NOT NULL AND attachment_storage_key IS NOT NULL)
      );

    ALTER TABLE product_messages
      ADD CONSTRAINT product_messages_attachment_thumbnail_video_only_check
      CHECK (attachment_thumbnail_storage_key IS NULL OR attachment_media_type = 'video');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'product_messages'
      AND constraint_name = 'product_messages_body_text_check'
  ) THEN
    ALTER TABLE product_messages DROP CONSTRAINT product_messages_body_text_check;
    ALTER TABLE product_messages ALTER COLUMN body_text DROP NOT NULL;
    ALTER TABLE product_messages
      ADD CONSTRAINT product_messages_body_text_check
      CHECK (
        (body_text IS NULL AND attachment_media_type IS NOT NULL)
        OR
        (body_text IS NOT NULL AND char_length(btrim(body_text)) BETWEEN 1 AND 4000)
      );
  END IF;
END;
$$;

-- FULL-UI-32 VIDEO FEEDBACK
-- Athlete-recorded, per-exercise form-check videos and the coach's text
-- reply. A genuinely new grain from product_coach_notes/session review:
-- those are keyed by session_id + a synthetic per-session artefact_id
-- only, with nothing finer-grained than "this session" - work_item_id
-- here is the specific exercise within the session the video is for
-- (same id the athlete-side "today" plan and session-execution client
-- already use, see beta18_programme_template_service.ts and app.js
-- currentFocusExerciseId). Video-only (no photo variant), so unlike
-- product_messages there is no attachment_media_type discriminator
-- column. exercise_label is an immutable snapshot captured at upload
-- time so the coach queue never has to re-derive it from programme
-- state later.
CREATE TABLE IF NOT EXISTS product_video_submissions (
  submission_id                     TEXT PRIMARY KEY,
  athlete_user_id                   TEXT NOT NULL,
  coach_user_id                     TEXT NOT NULL,
  relationship_id                   TEXT NOT NULL,
  session_id                        TEXT NOT NULL,
  work_item_id                      TEXT NOT NULL,
  exercise_label                    TEXT NOT NULL
    CHECK (
      char_length(btrim(exercise_label)) BETWEEN 1 AND 200
    ),
  caption                           TEXT
    CHECK (
      caption IS NULL OR char_length(btrim(caption)) BETWEEN 1 AND 4000
    ),
  attachment_mime_type               TEXT NOT NULL,
  attachment_byte_size               INTEGER NOT NULL
    CHECK (
      attachment_byte_size > 0
    ),
  attachment_storage_key             TEXT NOT NULL,
  attachment_thumbnail_storage_key   TEXT,
  review_status                     TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      review_status IN ('pending', 'reviewed')
    ),
  reviewed_at                       TIMESTAMPTZ,
  client_request_id                 TEXT NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (athlete_user_id, client_request_id),

  CHECK (
    (review_status = 'pending' AND reviewed_at IS NULL)
    OR
    (review_status = 'reviewed' AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS
  idx_product_video_submissions_coach_queue
ON product_video_submissions (
  coach_user_id,
  review_status,
  created_at ASC
);

CREATE INDEX IF NOT EXISTS
  idx_product_video_submissions_athlete_session
ON product_video_submissions (
  athlete_user_id,
  session_id,
  created_at ASC
);

-- Append-only, immutable coach feedback - mirrors product_coach_notes.
-- Writing the first feedback row for a submission is what flips that
-- submission's review_status to 'reviewed' (video_feedback_service.ts),
-- never a second write path against product_video_submissions itself.
CREATE TABLE IF NOT EXISTS product_video_submission_feedback (
  feedback_id      TEXT PRIMARY KEY,
  submission_id    TEXT NOT NULL
    REFERENCES product_video_submissions(submission_id)
    ON DELETE CASCADE,
  coach_user_id    TEXT NOT NULL,
  feedback_text    TEXT NOT NULL
    CHECK (
      char_length(btrim(feedback_text)) BETWEEN 1 AND 4000
    ),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  idx_product_video_submission_feedback_submission
ON product_video_submission_feedback (
  submission_id,
  created_at ASC
);
