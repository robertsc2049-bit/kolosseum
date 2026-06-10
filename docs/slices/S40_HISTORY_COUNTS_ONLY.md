<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S40 — History Counts Only

Project: Kolosseum
Slice: S40
Title: History Counts Only
Status: v0 implementation contract
Engine compatibility: EB2-1.0.0
Scope: v0 Deterministic Execution Alpha
Rewrite policy: rewrite-only

## 1. Purpose

S40 defines the v0 history surface for athletes and linked coaches.

The surface shows derived factual counts and factual session records only.

Counts are derived facts. Counts are not advice.

## 2. v0 Boundary

Allowed surface:

- Athlete own history
- Linked coach athlete history
- Factual counts
- Factual session list
- Factual session statuses
- Optional extra work event count only where S36 is active

Excluded semantic classes are enforced by the copy fixture and tests.

## 3. Authority Rules

### 3.1 Athlete Access

An athlete may read only their own history.

### 3.2 Coach Access

A coach may read factual history for an athlete only where all of the following are true:

- coach_user_id matches requester_user_id
- athlete_user_id is explicitly provided
- an accepted coach-athlete link exists
- the link is active at query time
- the link scope permits factual history visibility

Coach access is observational only.

Coach access must not alter:

- runtime events
- session truth
- counts
- athlete history
- engine behaviour
- future compilation
- future execution

### 3.3 Revoked Link Rule

Revoked link visibility fails closed unless an explicit historical access policy exists.

v0 default:

    revoked_link_history_visibility = denied

If no explicit historical policy is present, coach access after revocation must return:

    {
      "error": {
        "code": "HISTORY_VISIBILITY_DENIED",
        "message_copy_id": "history.error.visibility_denied"
      }
    }

No partial response is allowed.

## 4. Data Model

S40 reads from app-layer persistence only.

The engine remains stateless.

Required source records:

    sessions
    session_runtime_items
    runtime_events
    coach_athlete_links

Optional source records where S36 is active:

    extra_work_events

### 4.1 sessions

    create table if not exists sessions (
      session_id text primary key,
      athlete_user_id text not null,
      execution_scope text not null check (execution_scope in ('individual', 'coach_managed')),
      status text not null check (status in ('not_started', 'in_progress', 'completed', 'partially_completed', 'stopped')),
      started_at timestamptz null,
      completed_at timestamptz null,
      created_at timestamptz not null default now()
    );

### 4.2 session_runtime_items

    create table if not exists session_runtime_items (
      runtime_item_id text primary key,
      session_id text not null references sessions(session_id),
      athlete_user_id text not null,
      status text not null check (status in ('completed', 'skipped', 'partial')),
      recorded_at timestamptz not null
    );

### 4.3 extra_work_events

Only active when S36 is active.

    create table if not exists extra_work_events (
      extra_work_event_id text primary key,
      session_id text not null references sessions(session_id),
      athlete_user_id text not null,
      recorded_at timestamptz not null
    );

### 4.4 coach_athlete_links

    create table if not exists coach_athlete_links (
      link_id text primary key,
      coach_user_id text not null,
      athlete_user_id text not null,
      status text not null check (status in ('invited', 'accepted', 'revoked', 'expired', 'rejected')),
      scope jsonb not null,
      invited_at timestamptz null,
      accepted_at timestamptz null,
      revoked_at timestamptz null,
      rejected_at timestamptz null,
      expires_at timestamptz null,
      created_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

## 5. Allowed Response Fields

The summary response may include only:

- session_count
- completed_item_count
- skipped_item_count
- partial_item_count
- extra_work_event_count
- first_session_at
- latest_session_at
- sessions

extra_work_event_count is allowed only when S36 is active.

sessions may include only factual identifiers, timestamps, and factual statuses.

## 6. Query Contract

### 6.1 Summary Query

    select
      count(distinct s.session_id)::integer as session_count,
      count(ri.runtime_item_id) filter (where ri.status = 'completed')::integer as completed_item_count,
      count(ri.runtime_item_id) filter (where ri.status = 'skipped')::integer as skipped_item_count,
      count(ri.runtime_item_id) filter (where ri.status = 'partial')::integer as partial_item_count,
      min(s.started_at) as first_session_at,
      max(coalesce(s.completed_at, s.started_at, s.created_at)) as latest_session_at
    from sessions s
    left join session_runtime_items ri
      on ri.session_id = s.session_id
    where s.athlete_user_id = :athlete_user_id;

### 6.2 Extra Work Query

Only used when S36 is active.

    select
      count(extra_work_event_id)::integer as extra_work_event_count
    from extra_work_events
    where athlete_user_id = :athlete_user_id;

### 6.3 Session List Query

    select
      session_id,
      status,
      started_at,
      completed_at,
      created_at
    from sessions
    where athlete_user_id = :athlete_user_id
    order by coalesce(started_at, created_at) desc, session_id asc
    limit :limit
    offset :offset;

### 6.4 Coach Link Verification Query

    select
      link_id,
      status,
      scope,
      accepted_at,
      revoked_at,
      expires_at
    from coach_athlete_links
    where coach_user_id = :coach_user_id
      and athlete_user_id = :athlete_user_id
      and status = 'accepted'
      and accepted_at is not null
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    limit 1;

### 6.5 Link Scope Check

The link scope must explicitly permit factual history visibility.

Required scope flag:

    {
      "history_counts": true
    }

Missing scope flag means denied.

No inference is permitted.

## 7. API Contract

Endpoint:

    GET /api/v0/history/:athlete_user_id/counts

Query params:

    {
      "limit": "integer optional, default 25, max 100",
      "offset": "integer optional, default 0"
    }

Denied response:

    {
      "error": {
        "code": "HISTORY_VISIBILITY_DENIED",
        "message_copy_id": "history.error.visibility_denied"
      }
    }

No data is not an error.

## 8. UI Copy Surface

All copy must be rendered by copy ID.

Inline user-facing strings are forbidden.

Allowed copy IDs are defined in ui/copy/history_counts.copy.json.

## 9. UI Surface Rules

The UI may show:

- count cards
- factual date labels
- factual session list
- factual status chips

Status chips must use neutral styling.

Colour must not encode judgement.

## 10. Acceptance Criteria

S40 is accepted only when:

- Athlete can read own factual history.
- Athlete cannot read another athlete history.
- Coach can read linked athlete factual history only with accepted active scoped link.
- Revoked link access fails closed.
- Counts match persisted runtime events.
- S36 extra work count appears only where S36 is active.
- Session list contains factual statuses only.
- API response contains no forbidden derived fields.
- UI copy uses only registered copy IDs.
- No inline production copy exists.
- Copy lint passes.
- Negative tests prove excluded semantic classes fail.
- Engine output is unaffected by history queries.
- Coach access remains observational only.
