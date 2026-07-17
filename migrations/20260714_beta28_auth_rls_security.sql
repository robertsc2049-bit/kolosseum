-- BETA-28 Auth RLS Security Pass
-- Additive security migration. The production runtime role must not own these
-- tables and must set app.user_id, app.actor_type, app.account_state and
-- app.security_action with SET LOCAL after verified authentication.

CREATE SCHEMA IF NOT EXISTS kolosseum_security;

CREATE TABLE IF NOT EXISTS beta_accounts (
  user_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL
    CHECK (actor_type IN ('individual_user', 'coach')),
  account_state TEXT NOT NULL
    CHECK (account_state IN ('active', 'suspended'))
);

CREATE TABLE IF NOT EXISTS beta_coach_relationships (
  relationship_id TEXT PRIMARY KEY,
  coach_user_id TEXT NOT NULL,
  individual_user_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'archived', 'pending', 'revoked')),
  permitted_resource_types TEXT[] NOT NULL DEFAULT '{}',
  permitted_actions TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS
  beta28_relationship_coach_owner_idx
ON beta_coach_relationships (
  coach_user_id,
  individual_user_id,
  status
);

CREATE TABLE IF NOT EXISTS beta_security_artifacts (
  resource_type TEXT NOT NULL
    CHECK (
      resource_type IN (
        'projection',
        'replay_verdict',
        'evidence'
      )
    ),
  resource_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  stored_bytes BYTEA NOT NULL,
  stored_bytes_sha256 TEXT NOT NULL
    CHECK (
      stored_bytes_sha256 ~ '^[a-f0-9]{64}$'
    ),
  sealed BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS beta_coach_notes (
  note_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  coach_user_id TEXT NOT NULL,
  relationship_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  note_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beta_security_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_type TEXT,
  resource_type TEXT,
  resource_id TEXT,
  security_action TEXT,
  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'security_access_requested',
        'security_access_granted',
        'security_access_denied',
        'sealed_artifact_mutation_denied'
      )
    ),
  reason_token TEXT
);

ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

CREATE OR REPLACE FUNCTION
  kolosseum_security.current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('app.user_id', true),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.current_actor_type()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('app.actor_type', true),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.current_account_state()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('app.account_state', true),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.current_security_action()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      current_setting(
        'app.security_action',
        true
      ),
      ''
    ),
    'read'
  )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.account_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    kolosseum_security.current_account_state() =
      'active'
    AND EXISTS (
      SELECT 1
      FROM beta_accounts account
      WHERE
        account.user_id =
          kolosseum_security.current_user_id()
        AND account.account_state = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.coach_can_access(
    owner_user_id TEXT,
    requested_resource_type TEXT,
    requested_action TEXT
  )
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM beta_coach_relationships relationship
    WHERE
      relationship.coach_user_id =
        kolosseum_security.current_user_id()
      AND relationship.individual_user_id =
        owner_user_id
      AND relationship.status IN (
        'active',
        'archived'
      )
      AND requested_resource_type =
        ANY (
          relationship.permitted_resource_types
        )
      AND requested_action =
        ANY (
          relationship.permitted_actions
        )
      AND (
        relationship.status = 'active'
        OR requested_action IN (
          'read',
          'export'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.can_access(
    owner_user_id TEXT,
    requested_resource_type TEXT,
    requested_action TEXT
  )
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    kolosseum_security.account_is_active()
    AND (
      (
        kolosseum_security.current_actor_type() =
          'individual_user'
        AND kolosseum_security.current_user_id() =
          owner_user_id
      )
      OR (
        kolosseum_security.current_actor_type() =
          'coach'
        AND kolosseum_security.coach_can_access(
          owner_user_id,
          requested_resource_type,
          requested_action
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.deny_sealed_artifact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.sealed IS TRUE THEN
    RAISE EXCEPTION
      'beta28_sealed_artifact_mutation_denied';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION
  kolosseum_security.deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'beta28_audit_mutation_denied';
END;
$$;

DROP TRIGGER IF EXISTS
  beta28_deny_sealed_artifact_mutation
ON beta_security_artifacts;

CREATE TRIGGER
  beta28_deny_sealed_artifact_mutation
BEFORE UPDATE OR DELETE
ON beta_security_artifacts
FOR EACH ROW
EXECUTE FUNCTION
  kolosseum_security.deny_sealed_artifact_mutation();

DROP TRIGGER IF EXISTS
  beta28_deny_audit_mutation
ON beta_security_audit_events;

CREATE TRIGGER
  beta28_deny_audit_mutation
BEFORE UPDATE OR DELETE
ON beta_security_audit_events
FOR EACH ROW
EXECUTE FUNCTION
  kolosseum_security.deny_audit_mutation();

ALTER TABLE beta_accounts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE beta_coach_relationships
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE blocks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE sessions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE runtime_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE session_event_seq
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE beta_security_artifacts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE beta_coach_notes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE beta_security_audit_events
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  beta28_accounts_select_own
ON beta_accounts;

CREATE POLICY
  beta28_accounts_select_own
ON beta_accounts
FOR SELECT
USING (
  user_id =
    kolosseum_security.current_user_id()
);

DROP POLICY IF EXISTS
  beta28_relationship_participant_read
ON beta_coach_relationships;

CREATE POLICY
  beta28_relationship_participant_read
ON beta_coach_relationships
FOR SELECT
USING (
  kolosseum_security.account_is_active()
  AND (
    coach_user_id =
      kolosseum_security.current_user_id()
    OR individual_user_id =
      kolosseum_security.current_user_id()
  )
);

DROP POLICY IF EXISTS
  beta28_blocks_owner_or_coach_read
ON blocks;

CREATE POLICY
  beta28_blocks_owner_or_coach_read
ON blocks
FOR SELECT
USING (
  kolosseum_security.can_access(
    owner_user_id,
    'session',
    'read'
  )
);

DROP POLICY IF EXISTS
  beta28_blocks_owner_insert
ON blocks;

CREATE POLICY
  beta28_blocks_owner_insert
ON blocks
FOR INSERT
WITH CHECK (
  kolosseum_security.account_is_active()
  AND kolosseum_security.current_actor_type() =
    'individual_user'
  AND owner_user_id =
    kolosseum_security.current_user_id()
);

DROP POLICY IF EXISTS
  beta28_sessions_owner_or_coach_read
ON sessions;

CREATE POLICY
  beta28_sessions_owner_or_coach_read
ON sessions
FOR SELECT
USING (
  kolosseum_security.can_access(
    owner_user_id,
    'session',
    'read'
  )
);

DROP POLICY IF EXISTS
  beta28_sessions_owner_or_active_coach_write
ON sessions;

CREATE POLICY
  beta28_sessions_owner_or_active_coach_write
ON sessions
FOR UPDATE
USING (
  kolosseum_security.can_access(
    owner_user_id,
    'session',
    'write'
  )
)
WITH CHECK (
  kolosseum_security.can_access(
    owner_user_id,
    'session',
    'write'
  )
);

DROP POLICY IF EXISTS
  beta28_sessions_owner_insert
ON sessions;

CREATE POLICY
  beta28_sessions_owner_insert
ON sessions
FOR INSERT
WITH CHECK (
  kolosseum_security.account_is_active()
  AND kolosseum_security.current_actor_type() =
    'individual_user'
  AND owner_user_id =
    kolosseum_security.current_user_id()
);

DROP POLICY IF EXISTS
  beta28_runtime_events_scoped_read
ON runtime_events;

CREATE POLICY
  beta28_runtime_events_scoped_read
ON runtime_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM sessions session_row
    WHERE
      session_row.session_id =
        runtime_events.session_id
      AND kolosseum_security.can_access(
        session_row.owner_user_id,
        'session',
        'read'
      )
  )
);

DROP POLICY IF EXISTS
  beta28_runtime_events_scoped_write
ON runtime_events;

CREATE POLICY
  beta28_runtime_events_scoped_write
ON runtime_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sessions session_row
    WHERE
      session_row.session_id =
        runtime_events.session_id
      AND kolosseum_security.can_access(
        session_row.owner_user_id,
        'session',
        'write'
      )
  )
);

DROP POLICY IF EXISTS
  beta28_session_sequence_scoped
ON session_event_seq;

CREATE POLICY
  beta28_session_sequence_scoped
ON session_event_seq
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM sessions session_row
    WHERE
      session_row.session_id =
        session_event_seq.session_id
      AND kolosseum_security.can_access(
        session_row.owner_user_id,
        'session',
        'write'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sessions session_row
    WHERE
      session_row.session_id =
        session_event_seq.session_id
      AND kolosseum_security.can_access(
        session_row.owner_user_id,
        'session',
        'write'
      )
  )
);

DROP POLICY IF EXISTS
  beta28_artifacts_scoped_read_export
ON beta_security_artifacts;

CREATE POLICY
  beta28_artifacts_scoped_read_export
ON beta_security_artifacts
FOR SELECT
USING (
  kolosseum_security.can_access(
    owner_user_id,
    resource_type,
    kolosseum_security.current_security_action()
  )
);

DROP POLICY IF EXISTS
  beta28_artifacts_manual_insert_denied
ON beta_security_artifacts;

CREATE POLICY
  beta28_artifacts_manual_insert_denied
ON beta_security_artifacts
FOR INSERT
WITH CHECK (FALSE);

DROP POLICY IF EXISTS
  beta28_notes_scoped_read
ON beta_coach_notes;

CREATE POLICY
  beta28_notes_scoped_read
ON beta_coach_notes
FOR SELECT
USING (
  kolosseum_security.can_access(
    owner_user_id,
    'coach_note',
    'read'
  )
);

DROP POLICY IF EXISTS
  beta28_notes_active_coach_write
ON beta_coach_notes;

CREATE POLICY
  beta28_notes_active_coach_write
ON beta_coach_notes
FOR INSERT
WITH CHECK (
  kolosseum_security.can_access(
    owner_user_id,
    'coach_note',
    'write'
  )
  AND coach_user_id =
    kolosseum_security.current_user_id()
);

DROP POLICY IF EXISTS
  beta28_audit_insert
ON beta_security_audit_events;

CREATE POLICY
  beta28_audit_insert
ON beta_security_audit_events
FOR INSERT
WITH CHECK (
  kolosseum_security.account_is_active()
  AND actor_user_id =
    kolosseum_security.current_user_id()
);

DROP POLICY IF EXISTS
  beta28_audit_select_own
ON beta_security_audit_events;

CREATE POLICY
  beta28_audit_select_own
ON beta_security_audit_events
FOR SELECT
USING (
  actor_user_id =
    kolosseum_security.current_user_id()
);

COMMENT ON SCHEMA kolosseum_security IS
  'BETA-28 fail-closed owner and coach relationship security helpers.';

COMMENT ON TABLE beta_security_artifacts IS
  'Projection, replay verdict and evidence bytes protected by RLS and sealed mutation denial.';

COMMENT ON TABLE beta_security_audit_events IS
  'Append-only sensitive-action audit records.';
