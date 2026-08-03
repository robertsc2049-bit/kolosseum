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
        'billing_action_required'
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
