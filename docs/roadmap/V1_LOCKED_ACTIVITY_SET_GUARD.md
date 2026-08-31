<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S19 - v1 locked activity set guard

## Status

Accepted as a guard-hardening slice.

Recorded at UTC: 2026-06-05T07:54:15Z

## Context

The v0 release lane is closed.

S18 created v1 boundary guard scaffolding.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 boundary guard scaffolding commit: e7ef14be33054124f27a4c105951d6c5d827fa52

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice adds a dedicated v1 locked activity set guard. It does not add registry content, templates, UI, database migrations, auth provider integration, billing, proof, export, or commercial surfaces.

## Purpose

S19 makes the locked v1 activity set executable.

The v1 supported activities remain exactly:

- powerlifting
- general_strength
- rugby_union
- strongman

No implementation slice may add, imply, seed, expose, copy, or test support for another active v1 activity unless a later accepted decision record replaces the locked set. (See the amendment below for how strongman entered this list.)

## Files changed

Expected files:

- docs/roadmap/V1_LOCKED_ACTIVITY_SET_GUARD.md
- ci/guards/v1_locked_activity_set_guard.mjs
- docs/GUARDS_INDEX.md
- package.json

## Files explicitly not changed

This slice must not modify:

- package-lock.json
- registry data
- exercise data
- equipment data
- programme templates
- database migrations
- UI screens
- auth provider integration
- organisation/team/gym/federation surfaces
- marketplace surfaces
- messaging or chat surfaces
- EPOS or gym access surfaces
- package version
- release tags

## Guard behaviour

The S19 guard must prove:

- V1_SUPPORTED_ACTIVITIES exists
- the set length is exactly 4
- the set contains powerlifting
- the set contains general_strength
- the set contains rugby_union
- the set contains strongman
- the set contains no additional activity ids
- assertActivityIsV1Supported accepts the locked set
- assertActivityIsV1Supported rejects excluded activity examples
- package.json invokes the S19 guard through lint:fast
- docs/GUARDS_INDEX.md indexes the S19 guard
- prior v1 roadmap documents still reference the locked activity set

## Excluded examples

The guard must reject examples outside v1, including:

- bodybuilding
- weightlifting
- combat_sports
- tactical
- running
- cycling
- swimming
- football
- soccer
- basketball

These examples are rejection tests only. They do not create supported activity ids.

## CI integration

S19 adds:

- ci/guards/v1_locked_activity_set_guard.mjs

and wires it into:

- npm.cmd run lint:fast

The guard should run after the S18 boundary scaffold guard.

## Acceptance criteria

S19 is accepted when:

- this document exists
- the S19 CI guard exists
- the S19 guard is indexed in docs/GUARDS_INDEX.md
- lint:fast invokes the S19 guard
- the locked activity set is exactly powerlifting, general_strength, rugby_union, and strongman
- excluded activity examples are rejected
- no registry content is added
- no template content is added
- no UI screen is added
- no database migration is added
- no package version is changed
- no tag is created or moved
- lint:fast passes

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not add database migrations in this slice.

Do not add registry content in this slice.

Do not add templates in this slice.

Do not add UI screens in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is S20 - v1 registry schema target hardening.

S20 should harden schema expectations before registry expansion content begins.

## Amendment - strongman activated as v1's fourth locked activity

The locked activity set is now exactly powerlifting, general_strength, rugby_union, and strongman (length 4), per the amendment recorded in docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md. ci/guards/v1_locked_activity_set_guard.mjs's `expectedActivities` and `rejectedExamples` were updated accordingly, and "strongman" was removed from the "Excluded examples" list above since it is no longer an excluded activity.
