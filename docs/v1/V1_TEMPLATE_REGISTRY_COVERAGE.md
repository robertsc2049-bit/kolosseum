<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-27 template registry coverage contract and points to executable proof. It is not an active marketplace, coach-sharing, or production template registry. -->

# S-V1-27 - Template Registry Coverage

## Status

Accepted as a v1 template coverage slice.

## Purpose

S-V1-27 defines template registry coverage for the locked v1 supported activity set.

Template coverage is explicit.

missing required template coverage fails closed.

Template language remains claim-safe.

This slice proves that each locked v1 supported activity has declared template coverage before later active template registry content is admitted.

## Boundary

This slice may add or update:

- docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md
- ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json
- ci/fixtures/v1_template_registry_coverage_negative/s_v1_27_missing_template_coverage_negative.json
- test/s_v1_27_template_registry_coverage.test.mjs
- ci/guards/s_v1_27_template_registry_coverage_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice may reference:

- docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md
- docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md
- docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md
- docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md

This slice must not add:

- active programme template rows
- marketplace publishing
- coach-to-coach sharing
- royalty calculation
- protected formula visibility
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

No active marketplace publishing is added by this slice.

No coach-to-coach sharing is added by this slice.

## Required activity coverage

The locked v1 activity set is:

- powerlifting
- general_strength
- rugby_union

Template coverage is complete only when every locked activity has at least one declared coverage entry.

The coverage fixture must contain:

- coverage_contract_version: S-V1-27
- required_activity_ids
- coverage_status
- coverage_entries

required_activity_ids must match the locked v1 activity set exactly.

coverage_status must be declared_complete when all required activities are covered.

## Coverage entry fields

Each coverage entry must contain:

- template_id
- template_status
- activity_id
- template_contract_version
- coverage_contract_version
- assignment_scope
- source_record_id
- source_control_status
- coverage_scope
- coverage_declaration_status
- template_language
- registry_bindings
- visibility_boundary
- copy_boundary_flags

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

coverage_scope must be:

- supported_activity_required_template

coverage_declaration_status must be:

- declared

## Template language

template_language must contain:

- title
- summary
- language_status

language_status must be:

- claim_safe

Template language must remain factual.

Template language must not contain:

- recommend
- recommended
- recommendation
- optimise
- optimize
- optimal
- best
- better
- ideal
- safe
- safer
- safety
- risk
- readiness
- fatigue
- effective
- programme worked
- programme failed
- tailored
- personalised
- guaranteed
- proven

## Registry bindings

registry_bindings must contain:

- activity_id
- exercise_ids
- equipment_ids
- substitution_edge_ids
- applicability_ids

activity_id inside registry_bindings must match the coverage activity_id.

All id arrays must be non-empty and duplicate-free.

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

Formula payloads must not be visible in template coverage.

Progression internals must not be visible in template coverage.

Protected logic references may be recorded only as opaque references.

## Copy boundary flags

copy_boundary_flags must include:

- formula_payload_not_visible
- no_coach_to_coach_sharing_scope
- no_marketplace_scope
- no_royalty_scope
- registry_bound

## Negative fixture

The negative fixture is:

- ci/fixtures/v1_template_registry_coverage_negative/s_v1_27_missing_template_coverage_negative.json

The negative fixture omits rugby_union coverage.

The expected failure code is:

- v1_template_registry_coverage_missing_required_activity_coverage

## Required proof

The required proof is:

- node --test test/s_v1_27_template_registry_coverage.test.mjs
- node ci/guards/s_v1_27_template_registry_coverage_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/guards/s_v1_26_programme_template_contract_guard.mjs
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

S-V1-27 is accepted when:

- the template registry coverage doc exists
- the positive declared coverage fixture exists
- the negative missing coverage fixture exists
- the S-V1-27 test exists and passes
- the S-V1-27 guard exists and passes
- the guard emits CI_V1_TEMPLATE_REGISTRY_COVERAGE
- the failure-token index includes CI_V1_TEMPLATE_REGISTRY_COVERAGE
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- coverage exists for powerlifting
- coverage exists for general_strength
- coverage exists for rugby_union
- missing required template coverage fails closed
- template language remains claim-safe
- no marketplace publishing is added
- no coach-to-coach sharing is added
- no royalty calculation is added
- no active programme template registry rows are added
- no UI screen is added
- no database migration is added
- no engine behaviour is changed
- no package version is changed
- no release tag is created
