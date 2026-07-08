<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-21 exercise registry contract and points to executable proof. Canonical product boundary remains in the v1 release-boundary records and executable guards. Keep this file aligned with the matching guard, test, and fixture. -->

# S-V1-21 - Exercise Registry Contract

## Status

Accepted as a v1 registry contract slice.

## Purpose

S-V1-21 defines the executable contract that future exercise registry content must satisfy before active v1 exercise records are accepted.

This slice exists before large exercise content production.

No active exercise registry rows are added by this slice.

## Locked v1 activity scope

The exercise registry contract is locked to:

1. powerlifting
2. general_strength
3. rugby_union

No exercise registry entry may imply active support for an activity outside this set.

## Boundary

This slice may add or update:

- docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md
- ci/fixtures/v1_exercise_registry_contract_negative/s_v1_21_missing_required_entry_negative.json
- test/s_v1_21_exercise_registry_contract.test.mjs
- ci/guards/s_v1_21_exercise_registry_contract_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice must not add:

- active exercise registry rows
- shared implementation modules
- equipment registry rows
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

## Required exercise entry fields

Future active exercise registry entries must contain:

- exercise_id
- display_label
- movement_pattern_id
- primary_activity_applicability
- secondary_activity_applicability
- equipment_requirements
- equipment_alternatives
- difficulty_tier
- joint_stress_tags
- stimulus_intent
- instruction_short_text
- instruction_detail_text
- contraindication_or_exclusion_tags
- substitution_eligibility
- template_eligibility
- copy_legal_boundary_flags

Missing required fields fail closed.

## Required coverage by locked activity

The contract requires explicit movement-pattern coverage for each locked activity.

Powerlifting requires:

- squat
- hinge
- horizontal_push
- horizontal_pull
- brace

General strength requires:

- squat
- hinge
- horizontal_push
- vertical_push
- horizontal_pull
- vertical_pull
- carry
- brace
- lunge_split_stance

Rugby union requires:

- squat
- hinge
- horizontal_push
- vertical_push
- horizontal_pull
- vertical_pull
- carry
- brace
- sprint_acceleration
- deceleration_change_of_direction
- jump_land
- conditioning_general

Missing required entries fail closed.

## Fallback boundary

The exercise registry must use explicit records.

Fallback records are refused.

Forbidden fallback markers include:

- fallback
- default
- generic_fallback
- catch_all
- unknown
- misc
- other

These markers must not be used to satisfy required coverage.

## Negative fixture

The S-V1-21 missing entry negative fixture is:

- ci/fixtures/v1_exercise_registry_contract_negative/s_v1_21_missing_required_entry_negative.json

The fixture intentionally omits:

- activity_id: rugby_union
- movement_pattern_id: jump_land

The expected failure code is:

- v1_exercise_registry_contract_required_coverage_missing

## Required proof

The required proof is:

- node --test test/s_v1_21_exercise_registry_contract.test.mjs
- node ci/guards/s_v1_21_exercise_registry_contract_guard.mjs
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

S-V1-21 is accepted when:

- the v1 doc exists
- the negative fixture exists
- the test exists and passes
- the guard exists and passes
- the guard emits CI_V1_EXERCISE_REGISTRY_CONTRACT
- the failure-token index includes CI_V1_EXERCISE_REGISTRY_CONTRACT
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- locked activities remain powerlifting, general_strength, and rugby_union
- missing required fields fail closed
- missing required entries fail closed
- fallback records are refused
- unsupported activity leakage fails closed
- no active exercise registry rows are added
- no shared implementation module is added
- no template records are added
- no UI screen is added
- no database migration is added
- no package version is changed
