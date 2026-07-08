<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-26 programme template contract and points to executable proof. It is not active programme template content and must not be used as active registry rows. -->

# S-V1-26 - Programme Template Contract

## Status

Accepted as a v1 programme template contract slice.

## Purpose

S-V1-26 defines the v1 programme template contract.

The programme template contract supports assigned coach-athlete execution.

The programme template contract is deterministic and registry-bound.

The programme template contract keeps formula and progression internals protected where applicable.

No active programme template rows are added by this slice.

## Boundary

This slice may add or update:

- docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md
- ci/fixtures/v1_programme_template_contract_negative/s_v1_26_invalid_template_negative.json
- test/s_v1_26_programme_template_contract.test.mjs
- ci/guards/s_v1_26_programme_template_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md
- docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md
- docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md
- docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md
- docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md

This slice must not add:

- active programme template rows
- active source-control register rows
- shared implementation modules
- marketplace surfaces
- royalty calculation
- protected formula visibility surfaces
- formula payloads
- progression-internal payloads
- coach-brand attribution
- UI screens
- database migrations
- billing behaviour
- organisation, team, gym, unit, federation, messaging, chat, EPOS, or gym access surfaces
- engine behaviour
- package version changes
- release tags

marketplace and royalties remain out of scope.

## Required template fields

Future active programme template candidates must contain:

- template_id
- template_version
- contract_version
- template_status
- activity_id
- assignment_scope
- source_record_id
- source_control_status
- template_structure
- registry_bindings
- visibility_boundary
- deterministic_boundary
- execution_surface
- copy_boundary_flags

Unknown fields fail closed.

## Locked activity scope

activity_id must be one of:

- powerlifting
- general_strength
- rugby_union

Unsupported activities fail closed.

## Assignment scope

assignment_scope must be:

- coach_athlete_assigned_execution

The contract supports assigned coach-athlete execution only.

This contract does not create team, organisation, gym, unit, federation, enterprise, marketplace, messaging, chat, or social assignment scope.

## Source-control requirement

source_record_id must identify the source-control register entry for the future candidate.

source_control_status must be:

- approved

The source-control register must record source status, licence status, commercial-use status, manual review status, legal review status, and copy boundary flags before any template candidate can become active.

## Registry bindings

registry_bindings must contain:

- activity_id
- exercise_ids
- equipment_ids
- substitution_edge_ids
- applicability_ids

registry-bound means template work items may reference only ids declared in registry_bindings.

activity_id inside registry_bindings must match the top-level activity_id.

All registry id arrays must be non-empty, sorted, and unique.

The deterministic reference policy is declared_registry_ids_only.

## Template structure

template_structure must contain ordered blocks.

Each block must contain:

- block_id
- order_index
- weeks

Each week must contain:

- week_id
- order_index
- days

Each day must contain:

- day_id
- order_index
- sessions

Each session must contain:

- session_id
- order_index
- work_items

Each work item must contain:

- work_item_id
- order_index
- exercise_id
- planned_sets
- planned_reps
- loading_reference
- equipment_requirement_ids
- substitution_policy_id

All structural order must use explicit_order_index_only.

Implicit array order must not be the source of deterministic truth.

## Visibility boundary

visibility_boundary must contain:

- formula_payload_status
- progression_internals_status
- protected_logic_reference_status

formula_payload_status must be:

- not_present

progression_internals_status must be:

- not_present

protected_logic_reference_status must be:

- opaque_reference_only

Formula payloads must not be visible in programme template records.

Progression internals must not be visible in programme template records.

Protected logic references may be recorded only as opaque references.

## Deterministic boundary

deterministic_boundary must contain:

- template_hash_inputs
- order_policy
- unknown_field_policy
- registry_reference_policy

template_hash_inputs must be exactly:

- template_id
- template_version
- activity_id
- assignment_scope
- registry_bindings
- template_structure

order_policy must be:

- explicit_order_index_only

unknown_field_policy must be:

- fail_closed

registry_reference_policy must be:

- declared_registry_ids_only

The programme template contract is deterministic and registry-bound.

## Execution surface

execution_surface must contain:

- coach_can_assign
- athlete_can_execute_assigned
- coach_can_edit_after_assignment
- assignment_mutates_template
- template_mutates_relationship
- template_mutates_engine

Required values:

- coach_can_assign: true
- athlete_can_execute_assigned: true
- coach_can_edit_after_assignment: false
- assignment_mutates_template: false
- template_mutates_relationship: false
- template_mutates_engine: false

The template supports assignment and assigned execution.

The template does not mutate the coach-athlete relationship.

The template does not mutate engine behaviour.

The template does not grant coach live edit authority after assignment.

## Copy boundary flags

copy_boundary_flags must include:

- formula_payload_not_visible
- no_marketplace_scope
- no_royalty_scope
- registry_bound

## Negative fixture

The negative fixture is:

- ci/fixtures/v1_programme_template_contract_negative/s_v1_26_invalid_template_negative.json

The negative fixture intentionally includes:

- formula_payload_status: visible_formula_payload
- progression_internals_status: visible_progression_internals
- protected_logic_reference_status: visible_internal_logic
- an undeclared work-item exercise reference

The expected failure code is:

- v1_programme_template_contract_formula_payload_refused

## Required proof

The required proof is:

- node --test test/s_v1_26_programme_template_contract.test.mjs
- node ci/guards/s_v1_26_programme_template_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/guards/s_v1_25_registry_content_production_system_guard.mjs
- node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/guards/no_bom_guard.mjs
- node ci/guards/no_crlf_guard.mjs
- node ci/guards/no_mojibake_guard.mjs
- node ci/guards/ascii_only_ci_guards_guard.mjs
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-26 is accepted when:

- the programme template contract doc exists
- the negative invalid template fixture exists
- the S-V1-26 test exists and passes
- the S-V1-26 guard exists and passes
- the guard emits CI_V1_PROGRAMME_TEMPLATE_CONTRACT
- the failure-token index includes CI_V1_PROGRAMME_TEMPLATE_CONTRACT
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- templates support assigned coach-athlete execution
- formula and progression internals remain protected
- template contract is deterministic and registry-bound
- invalid template fixture is rejected
- unsupported activity ids are rejected
- unknown registry references are rejected
- unknown fields are rejected
- marketplace and royalties remain out of scope
- no active programme template rows are added
- no UI screen is added
- no database migration is added
- no engine behaviour is changed
- no package version is changed
- no release tag is created
