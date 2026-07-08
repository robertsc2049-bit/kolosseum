<!-- DEV NOTE: V1 assignment visibility contract. This document records the S-V1-29 read-model boundary for programme assignments. It must stay product/auth read state only and must not create aggregate product surfaces, team/org/unit/gym/federation scope, marketplace scope, billing scope, UI screens, database migrations, or engine behaviour. -->

# S-V1-29 - Assignment Visibility

## Status

Accepted as a v1 product/auth read-model implementation slice.

## Purpose

S-V1-29 defines programme assignment visibility.

Coach sees assigned athletes only.

Athlete sees own assignments only.

Visibility state does not alter compile.

The slice provides a bounded read model for programme assignments created under S-V1-28.

## Boundary

This slice may add:

- docs/v1/V1_ASSIGNMENT_VISIBILITY.md
- src/programmeAssignmentVisibility.mjs
- src/api/programmeAssignmentVisibilityApi.mjs
- ci/fixtures/v1_assignment_visibility/s_v1_29_assignment_visibility_cases.json
- ci/fixtures/v1_assignment_visibility_negative/s_v1_29_assignment_visibility_negative.json
- test/s_v1_29_assignment_visibility.test.mjs
- ci/guards/s_v1_29_assignment_visibility_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- S-V1-15 relationship permission guards
- S-V1-28 programme assignment contract
- docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md
- docs/v1/V1_PROGRAMME_ASSIGNMENT_CONTRACT.md
- docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md
- docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md

This slice must not add:

- non-individual assignment scope
- aggregate assignment surfaces
- marketplace purchases
- marketplace publishing
- coach-to-coach sharing
- royalty calculation
- billing behaviour
- payment behaviour
- product UI screens
- database migrations
- engine behaviour changes
- compile route mutation
- Phase 1 declaration mutation
- active registry content rows
- proof implementation
- package version changes
- release tags

## Visibility read model

The assignment visibility read model is product/auth state.

It is not deterministic engine truth.

It is not proof truth.

It is not replay truth.

It is not registry truth.

It is not compile input.

The read model returns only assignment records visible to the requesting actor.

A coach actor receives assignment records only where:

- the assignment was assigned by that coach
- the assignment targets an athlete in an accepted individual coach-athlete relationship
- the relationship record matches the assignment relationship id
- the relationship athlete id matches the assignment athlete id

An athlete actor receives assignment records only where:

- the assignment athlete id matches the requesting athlete id

## Actor model

A visibility request must include:

- actor
- assignments
- relationships

actor must be one of:

- coach
- athlete

A coach actor must include:

- coach_id

An athlete actor must include:

- athlete_id

Unknown root fields fail closed.

Forbidden scope fields fail closed.

## Assignment record requirements

Each assignment record must include:

- assignment_id
- relationship_id
- assigned_by_coach_id
- assigned_athlete_id
- template_id
- activity_id
- assignment_status
- assigned_at
- compile_input_status
- engine_visible

compile_input_status must be:

- not_consumed_until_declared_compile_input

engine_visible must be:

- false

## Relationship requirements

Each relationship record must include:

- relationship_id
- coach_id
- athlete_id
- relationship_scope
- relationship_status

Coach assignment visibility requires:

- relationship_scope = individual_coach_athlete
- relationship_status = accepted

Revoked, invited, rejected, expired, missing, or mismatched relationship records do not grant coach visibility.

## Engine boundary

Visibility state does not alter compile.

Visibility state does not alter deterministic engine output.

Visibility state does not alter canonical hashes.

Visibility state does not alter replay.

Visibility state does not alter proof.

S-V1-29 proves this through:

- buildAssignmentVisibilityEngineTruthProbe
- S-V1-29 visibility tests
- S-V1-29 guard

## Permission boundary

S-V1-29 follows the S-V1-15 relationship permission rule:

- assigned coach access only
- athlete own-data access only
- permission failure is product/auth failure
- permission failure is not engine decision
- permission output is engine-invisible

S-V1-29 does not widen S-V1-15 to broad role-based access.

S-V1-29 does not create assignment authority.

S-V1-29 reads S-V1-28 assignment output; it does not create assignments.

## Output contract

A successful response returns:

- read_model_id
- read_model_version
- actor_type
- actor_id
- visible_assignment_count
- assignments
- compile_input_status
- engine_visible

Each visible assignment includes:

- assignment_id
- relationship_id
- assigned_by_coach_id
- assigned_athlete_id
- template_id
- activity_id
- assignment_status
- assigned_at
- visibility_reason
- compile_input_status
- engine_visible

visibility_reason must be one of:

- coach_assigned_athlete
- athlete_own_assignment

## Proof

Executable proof:

- node --test test/s_v1_29_assignment_visibility.test.mjs
- node ci/guards/s_v1_29_assignment_visibility_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- npm run lint:fast

## Failure token

Stable guard token:

- CI_V1_ASSIGNMENT_VISIBILITY

Stable product/auth failure code:

- assignment_visibility_product_auth_failure

Stable copy id:

- ASSIGNMENT_VISIBILITY_ACCESS_DENIED
