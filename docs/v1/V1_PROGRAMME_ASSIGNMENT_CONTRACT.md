<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-28 programme assignment contract and points to executable proof. Assignment is product/auth state only until a later compile path consumes explicit declared inputs. Do not use this document to add team, organisation, marketplace, billing, UI, database, or engine behaviour scope. -->

# S-V1-28 - Programme Assignment Contract

## Status

Accepted as a v1 product/auth implementation slice.

## Purpose

S-V1-28 defines the programme assignment contract.

Only authorised coach can assign.

Assignment does not alter engine truth until compile consumes declared inputs.

Athlete relationship scope enforced.

The slice implements bounded coach programme assignment to assigned athletes only.

## Boundary

This slice may add or update:

- docs/v1/V1_PROGRAMME_ASSIGNMENT_CONTRACT.md
- src/programmeAssignmentContract.mjs
- src/api/programmeAssignmentApi.mjs
- ci/fixtures/v1_programme_assignment_contract/s_v1_28_programme_assignment_cases.json
- ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json
- test/s_v1_28_programme_assignment_contract.test.mjs
- ci/guards/s_v1_28_programme_assignment_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md
- docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md
- docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md
- docs/v1/V1_RELEASE_BOUNDARY.md
- docs/roadmap/V1_DATA_MODEL_FREEZE_POINT.md
- docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md

This slice must not add:

- team assignments
- organisation assignments
- organization assignments
- unit assignments
- gym assignments
- federation assignments
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

No team assignments are added by this slice.

No organisation assignments are added by this slice.

No marketplace purchases are added by this slice.

## Assignment model

A valid programme assignment request must contain:

- request_id
- requested_at
- actor
- relationship
- assignment_authorisation
- template_coverage_entry
- assignment_intent
- engine_boundary

Unknown fields fail closed.

Forbidden fields fail closed.

## Actor

actor must contain:

- actor_type
- coach_id

actor_type must be:

- coach

Only coach actors can create programme assignments.

## Relationship

relationship must contain:

- relationship_id
- coach_id
- athlete_id
- relationship_scope
- relationship_status

relationship_scope must be:

- individual_coach_athlete

relationship_status must be:

- accepted

The actor coach_id must match the relationship coach_id.

An unassigned coach assignment is rejected.

## Assignment authorisation

assignment_authorisation is separate from relationship acceptance.

assignment_authorisation must contain:

- authorisation_id
- relationship_id
- coach_id
- athlete_id
- authorisation_scope
- authorisation_status

authorisation_scope must be:

- programme_assignment

authorisation_status must be:

- granted

The assignment authorisation must match:

- the same relationship_id
- the same coach_id
- the same athlete_id

This avoids widening S-V1-14 relationship acceptance or S-V1-15 read-permission guards into hidden assignment authority.

## Template coverage

template_coverage_entry must contain:

- template_id
- template_status
- activity_id
- template_contract_version
- coverage_contract_version
- assignment_scope
- source_control_status

template_status must be:

- declared_for_v1_coverage

template_contract_version must be:

- S-V1-26

coverage_contract_version must be:

- S-V1-27

assignment_scope must be:

- coach_athlete_assigned_execution

source_control_status must be:

- approved

activity_id must be one of:

- powerlifting
- general_strength
- rugby_union

## Assignment intent

assignment_intent must contain:

- assignment_mode
- assignment_reason_code
- target_start_policy

assignment_mode must be:

- coach_assigned_to_athlete

assignment_reason_code must be:

- coach_selected_template

target_start_policy must be:

- athlete_next_available_session

These fields are factual assignment metadata only.

They do not create advice, recommendation, ranking, readiness, suitability, safety, or optimisation semantics.

## Engine boundary

engine_boundary must contain:

- assignment_mutates_engine_truth
- compile_input_status
- engine_visible

assignment_mutates_engine_truth must be:

- false

compile_input_status must be:

- not_consumed_until_declared_compile_input

engine_visible must be:

- false

Programme assignment is product/auth state only.

Programme assignment does not alter Phase 1 declarations.

Programme assignment does not alter registry truth.

Programme assignment does not alter compile output.

Programme assignment does not alter substitution, legality, replay, evidence, proof, or factual history.

## API adapter

The S-V1-28 API adapter defines only the route contract for:

- POST /v1/programme-assignments

Successful authorised assignment returns:

- status 201
- ok: true
- assignment

Unassigned coach, non-accepted relationship, invalid relationship scope, or denied authorisation returns product/auth failure status.

The API adapter does not create a live server route.

The API adapter does not write database records.

The API adapter does not call compile.

The API adapter does not mutate engine truth.

## Forbidden scope fields

The assignment service rejects:

- team_id
- team_assignment_id
- organisation_id
- organization_id
- org_id
- unit_id
- gym_id
- federation_id
- marketplace_purchase_id
- marketplace_listing_id
- marketplace_order_id
- purchase_id
- payment_id
- billing_state
- billing_status
- coach_to_coach_share_id
- coach_to_coach_sharing_scope
- royalty_rate
- royalty_recipient
- engine_input
- engine_truth
- engine_truth_override
- compile_now
- compiled_output
- phase1_declaration
- phase1_payload
- recommendation_score
- optimisation_score
- readiness_score
- risk_score

## Negative fixture

The negative fixture is:

- ci/fixtures/v1_programme_assignment_contract_negative/s_v1_28_unassigned_coach_assignment_negative.json

The expected failure code is:

- v1_programme_assignment_contract_unassigned_coach_assignment_rejected

## Required proof

The required proof is:

- node --test test/s_v1_28_programme_assignment_contract.test.mjs
- node ci/guards/s_v1_28_programme_assignment_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/guards/s_v1_14_coach_athlete_relationship_acceptance_guard.mjs
- node ci/guards/s_v1_15_relationship_permission_guards_guard.mjs
- node ci/guards/s_v1_26_programme_template_contract_guard.mjs
- node ci/guards/s_v1_27_template_registry_coverage_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/guards/no_bom_guard.mjs
- node ci/guards/no_crlf_guard.mjs
- node ci/guards/no_mojibake_guard.mjs
- node ci/guards/ascii_only_ci_guards_guard.mjs
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-28 is accepted when:

- the programme assignment contract doc exists
- the programme assignment service exists
- the programme assignment API adapter exists
- the positive assignment fixture exists
- the unassigned coach negative fixture exists
- the S-V1-28 test exists and passes
- the S-V1-28 guard exists and passes
- the guard emits CI_V1_PROGRAMME_ASSIGNMENT_CONTRACT
- the failure-token index includes CI_V1_PROGRAMME_ASSIGNMENT_CONTRACT
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- authorised assignment passes
- unassigned coach assignment is rejected
- non-accepted relationship assignment is rejected
- non-individual relationship scope is rejected
- denied assignment authorisation is rejected
- template coverage must bind to S-V1-26
- template coverage must bind to S-V1-27
- assignment does not alter engine truth until compile consumes declared inputs
- team assignment fields are rejected
- organisation assignment fields are rejected
- marketplace purchase fields are rejected
- billing fields are rejected
- engine input fields are rejected
- no product UI screen is added
- no database migration is added
- no engine behaviour is changed
- no package version is changed
- no release tag is created
