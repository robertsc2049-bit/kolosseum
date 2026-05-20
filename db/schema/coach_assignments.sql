-- S39 — Coach Assignment Within Limits
-- Platform metadata only. This schema must not create or mutate engine output.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'coach_assignment_status'
  ) then
    create type public.coach_assignment_status as enum (
      'assigned',
      'revoked'
    );
  end if;
end
$$;

create table if not exists public.coach_assignments (
  assignment_id uuid primary key default gen_random_uuid(),

  coach_user_id uuid not null,
  athlete_user_id uuid not null,
  coach_athlete_link_id uuid not null,

  session_id uuid null,
  compiled_artefact_id uuid null,

  assignment_status public.coach_assignment_status not null default 'assigned',

  assigned_artefact_hash text not null,

  assigned_at timestamptz not null default now(),
  revoked_at timestamptz null,

  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint coach_assignments_exactly_one_target_chk
    check (
      (
        session_id is not null
        and compiled_artefact_id is null
      )
      or
      (
        session_id is null
        and compiled_artefact_id is not null
      )
    ),

  constraint coach_assignments_status_revoked_at_chk
    check (
      (
        assignment_status = 'assigned'
        and revoked_at is null
      )
      or
      (
        assignment_status = 'revoked'
        and revoked_at is not null
      )
    ),

  constraint coach_assignments_hash_shape_chk
    check (
      assigned_artefact_hash ~ '^[a-f0-9]{64}$'
    ),

  constraint coach_assignments_created_by_coach_chk
    check (
      created_by = coach_user_id
    )
);

comment on table public.coach_assignments is
'S39 platform-side coach assignment records. Assignment controls visibility/access only and must not alter engine legality, Phase 1 declarations, substitutions, progression, registries, compile admission, artefact content, or artefact hashes.';

comment on column public.coach_assignments.assigned_artefact_hash is
'Immutable echo of the target hash at assignment time, used only to prove assignment did not mutate the target artefact. Not engine truth.';

create unique index if not exists coach_assignments_unique_active_session_target
on public.coach_assignments (
  coach_user_id,
  athlete_user_id,
  session_id
)
where assignment_status = 'assigned'
  and session_id is not null;

create unique index if not exists coach_assignments_unique_active_compiled_artefact_target
on public.coach_assignments (
  coach_user_id,
  athlete_user_id,
  compiled_artefact_id
)
where assignment_status = 'assigned'
  and compiled_artefact_id is not null;

create index if not exists coach_assignments_coach_idx
on public.coach_assignments (
  coach_user_id,
  assignment_status,
  created_at desc
);

create index if not exists coach_assignments_athlete_idx
on public.coach_assignments (
  athlete_user_id,
  assignment_status,
  created_at desc
);

create index if not exists coach_assignments_link_idx
on public.coach_assignments (
  coach_athlete_link_id
);

create or replace function public.set_coach_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_coach_assignments_updated_at on public.coach_assignments;

create trigger trg_set_coach_assignments_updated_at
before update on public.coach_assignments
for each row
execute function public.set_coach_assignments_updated_at();

create or replace function public.prevent_coach_assignment_target_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.assignment_id <> new.assignment_id then
    raise exception 'assignment_id is immutable';
  end if;

  if old.coach_user_id <> new.coach_user_id then
    raise exception 'coach_user_id is immutable';
  end if;

  if old.athlete_user_id <> new.athlete_user_id then
    raise exception 'athlete_user_id is immutable';
  end if;

  if old.coach_athlete_link_id <> new.coach_athlete_link_id then
    raise exception 'coach_athlete_link_id is immutable';
  end if;

  if old.session_id is distinct from new.session_id then
    raise exception 'session_id is immutable';
  end if;

  if old.compiled_artefact_id is distinct from new.compiled_artefact_id then
    raise exception 'compiled_artefact_id is immutable';
  end if;

  if old.assigned_artefact_hash <> new.assigned_artefact_hash then
    raise exception 'assigned_artefact_hash is immutable';
  end if;

  if old.assigned_at <> new.assigned_at then
    raise exception 'assigned_at is immutable';
  end if;

  if old.created_at <> new.created_at then
    raise exception 'created_at is immutable';
  end if;

  if old.created_by <> new.created_by then
    raise exception 'created_by is immutable';
  end if;

  if old.assignment_status = 'revoked' and new.assignment_status = 'assigned' then
    raise exception 'revoked assignments cannot be reactivated';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_coach_assignment_target_mutation on public.coach_assignments;

create trigger trg_prevent_coach_assignment_target_mutation
before update on public.coach_assignments
for each row
execute function public.prevent_coach_assignment_target_mutation();

-- Recommended foreign keys.
-- Keep these commented until the canonical repo table names are confirmed.
-- The semantic requirement is binding even if physical table names differ.
--
-- alter table public.coach_assignments
--   add constraint coach_assignments_coach_fk
--   foreign key (coach_user_id)
--   references public.app_users(user_id);
--
-- alter table public.coach_assignments
--   add constraint coach_assignments_athlete_fk
--   foreign key (athlete_user_id)
--   references public.app_users(user_id);
--
-- alter table public.coach_assignments
--   add constraint coach_assignments_link_fk
--   foreign key (coach_athlete_link_id)
--   references public.coach_athlete_links(link_id);
--
-- alter table public.coach_assignments
--   add constraint coach_assignments_session_fk
--   foreign key (session_id)
--   references public.sessions(session_id);
--
-- alter table public.coach_assignments
--   add constraint coach_assignments_compiled_artefact_fk
--   foreign key (compiled_artefact_id)
--   references public.compiled_artefacts(compiled_artefact_id);

-- Application-layer enforcement required before insert:
-- 1. Authenticated actor must be coach_user_id.
-- 2. coach_athlete_link_id must resolve to the same coach_user_id and athlete_user_id.
-- 3. Link status must be accepted and active.
-- 4. Target must already exist and be lawful.
-- 5. Target hash must be read before insert and echoed in assigned_artefact_hash.
-- 6. Hash before assignment must equal hash after assignment.
-- 7. Active tier seat cap, when active, may deny assignment only.
-- 8. Tier cap denial must never alter target artefact content or hash.
-- 9. No engine compile, Phase 1 edit, substitution, progression, or registry mutation path may be called.