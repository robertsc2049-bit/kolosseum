<!-- DEV NOTE: Developer documentation surface. This document records the S-V1-20 supported activity boundary and points to executable proof. Canonical product boundary remains in the v1 release-boundary records and executable guards. Keep this file aligned with the matching guard, test, and fixture. -->

# S-V1-20 - Supported Activity Set Lock

## Status

Accepted as a v1 boundary-lock slice.

## Purpose

S-V1-20 closes the v1 supported activity set before registry, template, substitution, onboarding, compile, and session work widen.

The locked v1 supported activities are exactly:

1. powerlifting
2. general_strength
3. rugby_union

No other activity is active in v1 unless a later named boundary-change slice deliberately replaces this record and updates all linked guards, fixtures, tests, and release-boundary records.

## Boundary

This slice may add or update:

- this decision record
- a supported activity guard
- a supported activity negative fixture
- a supported activity test
- generated guard and failure-token indexes
- checksum records

This slice must not add:

- registry content
- exercise content
- equipment content
- programme templates
- new sports
- organisation, team, gym, unit, federation, marketplace, messaging, chat, EPOS, or gym access surfaces
- payment, billing, or commercial dashboard behaviour
- engine behaviour
- database migrations
- UI screens

## Invariants

The supported activity set is explicit.

The supported activity set contains only:

- powerlifting
- general_strength
- rugby_union

Unsupported activities are rejected by boundary guards or remain dormant according to the release boundary.

Registry, template, fixture, copy, onboarding, compile, session, and coach-facing surfaces must not imply hidden support for any activity outside the locked set.

## Unsupported activity negative fixture

The S-V1-20 negative fixture is:

- ci/fixtures/v1_supported_activity_set_lock_negative/s_v1_20_unsupported_activity_negative.json

The fixture lists unsupported activity ids that must be rejected by assertActivityIsV1Supported with code:

- v1_boundary_guard_unsupported_activity

The fixture is not a registry.

The fixture does not create supported activity ids.

The fixture is a boundary proof input only.

## Required proof

The required proof is:

- node --test test/s_v1_20_supported_activity_set_lock.test.mjs
- node ci/guards/s_v1_20_supported_activity_set_lock_guard.mjs
- node ci/guards/v1_locked_activity_set_guard.mjs
- npm.cmd run guard:index
- node ci/scripts/run_failure_token_index_guard.mjs --write
- npm.cmd run hash:write
- npm.cmd run lint:fast

## Acceptance criteria

S-V1-20 is accepted when:

- docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md exists
- the supported set is exactly powerlifting, general_strength, and rugby_union
- the negative fixture exists
- unsupported activity ids in the fixture are rejected
- the S-V1-20 test exists and passes
- the S-V1-20 guard exists and passes
- lint:fast invokes the S-V1-20 test and guard
- docs/GUARDS_INDEX.md is regenerated through the guard index generator
- docs/dev/FAILURE_TOKEN_INDEX.md is regenerated through the failure-token index generator
- docs/checksums.sha256 is regenerated through the checksum writer
- no registry content is added
- no template content is added
- no UI screen is added
- no database migration is added
- no package version is changed
