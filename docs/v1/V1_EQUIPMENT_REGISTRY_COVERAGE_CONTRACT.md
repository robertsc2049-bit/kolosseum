<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-22 equipment registry coverage contract and points to executable proof. Canonical product boundary remains in the v1 release-boundary records and executable guards. Keep this file aligned with the matching guard, test, and fixture. -->

# S-V1-22 - Equipment Registry v1 Coverage Contract

## Status

Accepted as a v1 registry contract slice.

## Purpose

S-V1-22 defines the executable contract that future equipment registry content must satisfy before active v1 equipment records are accepted.

This slice exists before active equipment registry content production.

No active equipment registry rows are added by this slice.

## Locked v1 activity scope

The equipment registry coverage contract is locked to:

1. powerlifting
2. general_strength
3. rugby_union

No equipment registry entry may imply active support for an activity outside this set.

## Boundary

This slice may add or update:

- docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md
- ci/fixtures/v1_equipment_registry_coverage_contract_negative/s_v1_22_missing_equipment_reference_negative.json
- test/s_v1_22_equipment_registry_coverage_contract.test.mjs
- ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice must not add:

- active equipment registry rows
- registries/equipment/equipment.registry.json
- shared implementation modules
- gym inventory
- EPOS
- access control
- door access
- stock control
- purchase or sale pricing
- exercise registry rows
- movement registry rows
- substitution edges
- programme templates
- UI screens
- database migrations
- billing behaviour
- organisation, team, gym, unit, federation, marketplace, messaging, chat, EPOS, or gym access surfaces
- engine behaviour
- package version changes
- release tags

## Required equipment entry fields

Future active equipment registry entries must contain:

- equipment_id
- display_label
- equipment_class
- activity_applicability
- movement_pattern_applicability
- substitution_relevance
- template_relevance
- low_equipment_alternative_relevance
- copy_legal_boundary_notes

Missing required fields fail closed.

## Minimum v1 equipment ids

The equipment registry coverage contract requires explicit coverage for:

- barbell
- rack
- bench
- plate
- dumbbell
- kettlebell
- cable_machine
- resistance_band
- bodyweight
- pull_up_bar
- trap_bar
- medicine_ball
- sled
- box
- machine_general
- cardio_machine_general
- open_floor_space

No implicit equipment assumptions are allowed.

## FK and coverage requirements

Future active exercise records must reference only declared equipment ids.

The following exercise fields must close against the equipment registry:

- equipment_requirements
- equipment_alternatives

Missing equipment references fail closed.

Each locked v1 activity must have explicit equipment coverage.

Each equipment item must declare:

- activity_applicability
- movement_pattern_applicability
- substitution_relevance
- template_relevance
- low_equipment_alternative_relevance

## Substitution and programme template boundary

The equipment registry supports substitution and programme templates only by factual metadata.

The metadata may state whether an equipment item is relevant for:

- required equipment
- lateral equipment swaps
- lower-equipment alternatives
- template selection

The metadata must not create:

- substitution edges
- programme templates
- programme assignment
- live session behaviour
- coach recommendations
- engine behaviour

## Operational boundary

This contract is not gym inventory.

This contract is not EPOS.

This contract is not access control.

This contract must not include:

- stock counts
- purchase prices
- sale prices
- supplier records
- scanner ids
- door access ids
- turnstile ids
- facility availability state
- member access state

## Negative fixture

The S-V1-22 missing equipment reference negative fixture is:

- ci/fixtures/v1_equipment_registry_coverage_contract_negative/s_v1_22_missing_equipment_reference_negative.json

The fixture intentionally declares an exercise requiring:

- unregistered_specialty_attachment

The fixture intentionally omits:

- unregistered_specialty_attachment from equipment_records

The expected failure code is:

- v1_equipment_registry_coverage_contract_missing_equipment_reference

## Required proof

The required proof is:

- node --test test/s_v1_22_equipment_registry_coverage_contract.test.mjs
- node ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/guards/no_bom_guard.mjs
- node ci/guards/no_crlf_guard.mjs
- node ci/guards/no_mojibake_guard.mjs
- node ci/guards/ascii_only_ci_guards_guard.mjs
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-22 is accepted when:

- the v1 doc exists
- the negative fixture exists
- the test exists and passes
- the guard exists and passes
- the guard emits CI_V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT
- the failure-token index includes CI_V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- locked activities remain powerlifting, general_strength, and rugby_union
- missing required equipment fields fail closed
- missing equipment references fail closed
- unsupported activity leakage fails closed
- no implicit equipment assumptions are allowed
- substitution relevance is explicit
- template relevance is explicit
- no active equipment registry rows are added
- no shared implementation module is added
- no gym inventory surface is added
- no EPOS surface is added
- no access control surface is added
- no template records are added
- no UI screen is added
- no database migration is added
- no package version is changed
