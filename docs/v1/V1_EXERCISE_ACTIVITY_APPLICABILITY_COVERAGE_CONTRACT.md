<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-23 exercise activity applicability coverage contract and points to executable proof. Canonical product boundary remains in the v1 release-boundary records and executable guards. Keep this file aligned with the matching guard, test, and fixture. -->

# S-V1-23 - Exercise-to-Sport Applicability Coverage

## Status

Accepted as a v1 registry contract slice.

## Purpose

S-V1-23 defines the executable contract that future exercise_activity_applicability_registry content must satisfy before active applicability records are accepted.

This slice exists before active exercise-to-sport applicability content production.

No active applicability registry rows are added by this slice.

## Locked v1 activity scope

The exercise activity applicability coverage contract is locked to:

1. powerlifting
2. general_strength
3. rugby_union

No applicability entry may imply active support for an activity outside this set.

## Boundary

This slice may add or update:

- docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md
- ci/fixtures/v1_exercise_activity_applicability_coverage_negative/s_v1_23_missing_applicability_negative.json
- test/s_v1_23_exercise_activity_applicability_coverage.test.mjs
- ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs
- package.json lint:fast wiring
- generated guard index
- generated failure-token index
- checksum records

This slice must not add:

- active applicability registry rows
- registries/exercise_activity_applicability/exercise_activity_applicability.registry.json
- registries/applicability/applicability.registry.json
- shared implementation modules
- recommendation engine behaviour
- capability inference
- ranking
- optimisation logic
- exercise registry rows
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

## Required applicability entry fields

Future active exercise activity applicability entries must contain:

- applicability_id
- exercise_id
- activity_id
- activity_context
- applicability_state
- conditions
- tier_cap
- template_applicability
- substitution_applicability
- copy_legal_boundary_notes

Missing required fields fail closed.

## Required activity contexts

Every declared exercise-to-activity pair must have explicit applicability entries for:

- training
- testing
- competition

Missing applicability fails closed.

No context may be inferred from another context.

## Applicability states

The closed applicability_state set is:

- allowed
- conditional
- prohibited

Conditional applicability must include:

- tier_cap from 1 to 4
- one or more condition references in conditions

Allowed and prohibited applicability must use:

- tier_cap: null

## Factual metadata boundary

Applicability is factual registry metadata.

Applicability does not recommend or optimise.

Applicability does not rank.

Applicability does not infer capability.

Applicability does not select substitutions.

Applicability does not assign programme templates.

Applicability does not alter engine behaviour.

Applicability metadata may state only whether a declared exercise is allowed, conditional, or prohibited for a locked activity and activity_context.

## Closure rules

For each future active exercise registry entry:

- primary_activity_applicability must be explicit
- secondary_activity_applicability must be an explicit array
- every listed activity must be one locked v1 activity
- every listed activity must have entries for training, testing, and competition
- duplicate applicability_id values fail closed
- duplicate exercise_id, activity_id, and activity_context combinations fail closed
- unknown exercise references fail closed
- unsupported activity leakage fails closed

## Forbidden applicability fields

Applicability records must not contain:

- recommendation_score
- recommended_rank
- ranking_score
- rank
- optimisation_score
- optimization_score
- capability_inference
- capability_score
- inferred_applicability
- preferred_exercise

These fields are outside the factual applicability registry boundary.

## Negative fixture

The S-V1-23 missing applicability negative fixture is:

- ci/fixtures/v1_exercise_activity_applicability_coverage_negative/s_v1_23_missing_applicability_negative.json

The fixture intentionally declares an exercise applicable to:

- powerlifting
- general_strength
- rugby_union

The fixture intentionally omits this explicit applicability entry:

- exercise_id: fixture_barbell_bench_press
- activity_id: rugby_union
- activity_context: competition

The expected failure code is:

- v1_exercise_activity_applicability_coverage_missing_applicability

## Required proof

The required proof is:

- node --test test/s_v1_23_exercise_activity_applicability_coverage.test.mjs
- node ci/guards/s_v1_23_exercise_activity_applicability_coverage_guard.mjs
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

S-V1-23 is accepted when:

- the v1 doc exists
- the negative fixture exists
- the test exists and passes
- the guard exists and passes
- the guard emits CI_V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE
- the failure-token index includes CI_V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE
- package.json invokes the test and guard through lint:fast
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- locked activities remain powerlifting, general_strength, and rugby_union
- required activity contexts remain training, testing, and competition
- missing required applicability fields fail closed
- missing applicability fails closed
- unsupported activity leakage fails closed
- duplicate applicability keys fail closed
- conditional applicability ambiguity fails closed
- recommendation fields are refused
- optimisation fields are refused
- capability inference fields are refused
- ranking fields are refused
- no active applicability registry rows are added
- no shared implementation module is added
- no recommendation engine behaviour is added
- no capability inference is added
- no ranking behaviour is added
- no template records are added
- no UI screen is added
- no database migration is added
- no package version is changed

## Supersession log (append-only)

The sections above describe this slice's own boundary as originally written -
a design-only contract accepted before active exercise activity applicability
registry content existed. They remain historically accurate for S-V1-23
itself and are not rewritten.

S-REG-33 is the explicit, human-authorised activation slice that later
satisfied this contract for real: it added the full 159-record applicability
closure (53 exercise-activity pairs across all 3 required contexts) to
`registries/exercise_activity_applicability/exercise_activity_applicability.registry.json`,
built on top of S-REG-32's earlier extension of
`registries/exercise/exercise.registry.json` with
`primary_activity_applicability`/`secondary_activity_applicability` fields on
all 19 live exercise entries.

The guard now validates real active content, in addition to the original
negative-fixture proof, whenever
`registries/exercise_activity_applicability/exercise_activity_applicability.registry.json`
exists: it re-runs the same `validateExerciseActivityApplicabilityCoverage`
check against the live exercise and applicability registries. This is
additive real-content enforcement, not a replacement of the fixture-based
proof, and not a relaxing of any requirement stated above.

- superseded_by_slice_ids: S-REG-33
