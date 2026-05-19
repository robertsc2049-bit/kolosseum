-- S28 — Phase 1 Acceptance Record SQL
-- Document ID: phase1_declarations_sql
-- Version: 1.0.0
-- Scope class: closed_world
-- Target: PostgreSQL / Supabase-compatible SQL

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'phase1_actor_type') then
    create type public.phase1_actor_type as enum (
      'individual_user',
      'coach'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'phase1_execution_scope') then
    create type public.phase1_execution_scope as enum (
      'individual',
      'coach_managed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'phase1_activity_id') then
    create type public.phase1_activity_id as enum (
      'powerlifting',
      'rugby_union',
      'general_strength'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'phase1_immutable_status') then
    create type public.phase1_immutable_status as enum (
      'immutable'
    );
  end if;
end $$;

create table if not exists public.phase1_declarations (
  declaration_id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  actor_type public.phase1_actor_type not null,
  execution_scope public.phase1_execution_scope not null,
  activity_id public.phase1_activity_id not null,

  declaration_payload_json jsonb not null,
  declaration_payload_sha256 text not null,

  phase1_schema_version text not null,
  engine_compatibility text not null,
  enum_bundle_version text not null,

  consent_granted boolean not null,
  jurisdiction_acknowledged boolean not null,

  accepted_at timestamptz not null,
  superseded_at timestamptz null,

  immutable boolean not null default true,
  immutable_status public.phase1_immutable_status not null default 'immutable',

  created_at timestamptz not null default now(),

  constraint phase1_declarations_sha256_format_chk
    check (declaration_payload_sha256 ~ '^[a-f0-9]{64}$'),

  constraint phase1_declarations_phase1_schema_version_chk
    check (phase1_schema_version = '1.0.0'),

  constraint phase1_declarations_engine_compatibility_chk
    check (engine_compatibility = 'EB2-1.0.0'),

  constraint phase1_declarations_enum_bundle_version_chk
    check (enum_bundle_version = 'EB2-1.0.0'),

  constraint phase1_declarations_consent_granted_chk
    check (consent_granted is true),

  constraint phase1_declarations_jurisdiction_acknowledged_chk
    check (jurisdiction_acknowledged is true),

  constraint phase1_declarations_immutable_chk
    check (immutable is true),

  constraint phase1_declarations_immutable_status_chk
    check (immutable_status = 'immutable'),

  constraint phase1_declarations_superseded_after_acceptance_chk
    check (superseded_at is null or superseded_at >= accepted_at),

  constraint phase1_declarations_payload_object_chk
    check (jsonb_typeof(declaration_payload_json) = 'object'),

  constraint phase1_declarations_payload_actor_type_chk
    check ((declaration_payload_json ->> 'actor_type') = actor_type::text),

  constraint phase1_declarations_payload_execution_scope_chk
    check ((declaration_payload_json ->> 'execution_scope') = execution_scope::text),

  constraint phase1_declarations_payload_activity_id_chk
    check ((declaration_payload_json ->> 'activity_id') = activity_id::text),

  constraint phase1_declarations_payload_schema_version_chk
    check ((declaration_payload_json ->> 'phase1_schema_version') = phase1_schema_version),

  constraint phase1_declarations_payload_engine_compatibility_chk
    check (
      coalesce(
        declaration_payload_json ->> 'engine_compatibility',
        declaration_payload_json ->> 'engine_version'
      ) = engine_compatibility
    ),

  constraint phase1_declarations_payload_enum_bundle_version_chk
    check ((declaration_payload_json ->> 'enum_bundle_version') = enum_bundle_version),

  constraint phase1_declarations_payload_consent_chk
    check ((declaration_payload_json ->> 'consent_granted')::boolean is true),

  constraint phase1_declarations_payload_jurisdiction_chk
    check ((declaration_payload_json ->> 'jurisdiction_acknowledged')::boolean is true)
);

create index if not exists phase1_declarations_user_accepted_idx
  on public.phase1_declarations (user_id, accepted_at desc)
  where superseded_at is null;

create unique index if not exists phase1_declarations_one_current_per_user_uidx
  on public.phase1_declarations (user_id)
  where superseded_at is null;

create or replace function public.prevent_phase1_declaration_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.declaration_id <> old.declaration_id
      or new.user_id <> old.user_id
      or new.actor_type <> old.actor_type
      or new.execution_scope <> old.execution_scope
      or new.activity_id <> old.activity_id
      or new.declaration_payload_json <> old.declaration_payload_json
      or new.declaration_payload_sha256 <> old.declaration_payload_sha256
      or new.phase1_schema_version <> old.phase1_schema_version
      or new.engine_compatibility <> old.engine_compatibility
      or new.enum_bundle_version <> old.enum_bundle_version
      or new.consent_granted <> old.consent_granted
      or new.jurisdiction_acknowledged <> old.jurisdiction_acknowledged
      or new.accepted_at <> old.accepted_at
      or new.immutable <> old.immutable
      or new.immutable_status <> old.immutable_status
      or new.created_at <> old.created_at
    then
      raise exception 'PHASE1_ACCEPTANCE_RECORD_IMMUTABLE';
    end if;

    if old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at then
      raise exception 'PHASE1_ACCEPTANCE_SUPERSEDED_METADATA_IMMUTABLE';
    end if;

    if old.superseded_at is null and new.superseded_at is null then
      raise exception 'PHASE1_ACCEPTANCE_RECORD_NOOP_UPDATE_FORBIDDEN';
    end if;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'PHASE1_ACCEPTANCE_RECORD_DELETE_FORBIDDEN';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_phase1_declaration_mutation on public.phase1_declarations;

create trigger trg_prevent_phase1_declaration_mutation
before update or delete on public.phase1_declarations
for each row
execute function public.prevent_phase1_declaration_mutation();

create or replace view public.current_phase1_declarations as
select *
from public.phase1_declarations
where superseded_at is null
  and accepted_at is not null
  and immutable is true
  and immutable_status = 'immutable'
  and consent_granted is true
  and jurisdiction_acknowledged is true;

create or replace function public.get_current_phase1_declaration(p_user_id uuid)
returns setof public.phase1_declarations
language sql
stable
as $$
  select *
  from public.phase1_declarations
  where user_id = p_user_id
    and superseded_at is null
    and accepted_at is not null
    and immutable is true
    and immutable_status = 'immutable'
    and consent_granted is true
    and jurisdiction_acknowledged is true
  order by accepted_at desc
  limit 1;
$$;