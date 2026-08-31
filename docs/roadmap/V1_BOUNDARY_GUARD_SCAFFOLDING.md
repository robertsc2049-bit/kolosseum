<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S18 - v1 boundary guard scaffolding

# v1 Boundary Guard Scaffolding

## Status

Accepted as the first implementation-adjacent slice.

Recorded at UTC: 2026-06-04T16:45:13Z

## Context

The v0 release lane is closed.

The v1 implementation readiness checklist is accepted.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 implementation readiness commit: 6cc40ba8768d5f5de07c4e822b4e474f843a2f4d

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice creates inert v1 boundary guard scaffolding and a CI guard proving the scaffold exists. It does not create active product flows.

## Purpose

S18 establishes named v1 boundary guard functions and a lint:fast-enforced scaffold guard before implementation expands into data model, auth, registry, templates, or UI.

The purpose is to make future v1 implementation safer by giving later slices explicit guard names and failure tokens.

## Files changed

Expected files:

- docs/roadmap/V1_BOUNDARY_GUARD_SCAFFOLDING.md
- shared/v1-boundary/v1BoundaryGuards.mjs
- ci/guards/v1_boundary_guard_scaffolding_guard.mjs
- package.json

## Files forbidden in this slice

This slice must not modify:

- package-lock.json
- database migrations
- registry data
- programme templates
- UI screens
- auth provider integration
- billing or commercial surfaces
- marketplace surfaces
- messaging or chat surfaces
- organisation/team/gym/federation surfaces
- release tags
- package version

## Guard scaffold functions

S18 introduces named guard scaffolding for:

- assertCoachCanViewAthlete
- assertCoachCanAssignProgramme
- assertAthleteOwnsDeclaration
- assertRelationshipIsActive
- assertEngineInputIsCanonical
- assertNoCoachNoteInEngineInput
- assertNoBillingStateInEngineInput
- assertNoUiStateInEngineInput
- assertRegistryIdIsKnown
- assertActivityIsV1Supported
- assertSubstitutionEdgeIsAllowed
- assertCopyIdExists
- assertLiveViewIsReadOnly

These are boundary helpers only. They do not create active product flows.

## Required behaviour

The guard scaffold must prove:

- coach access requires relationship_active
- programme assignment requires relationship_active
- athlete declaration ownership is explicit
- engine input must be canonical-shaped
- coach notes are refused in engine input
- billing state is refused in engine input
- UI state is refused in engine input
- registry ids must be known when a known set is provided
- supported activities are limited to powerlifting, general_strength, and rugby_union
- substitution edges must be explicitly allowed
- copy ids must be known when a known set is provided
- live view permits view/read/status actions only

## Failure-token pattern

The scaffold must use stable failure tokens.

Required token prefix:

- v1_boundary_guard_

The CI guard must fail with clear output if required functions, failure tokens, or behaviour disappear.

## CI integration

S18 adds:

- ci/guards/v1_boundary_guard_scaffolding_guard.mjs

and wires it into:

- npm.cmd run lint:fast

The guard must run after repo contract checks and before the later registry/commercial guards.

## Explicit exclusions

S18 does not add:

- implementation product flows
- database migrations
- registry content
- templates
- UI screens
- auth provider integration
- billing
- commercial dashboards
- organisations
- teams
- gyms
- units
- federations
- marketplace
- messaging
- chat
- video
- EPOS
- gym access
- broad analytics
- automatic programme optimisation
- automatic progression
- diagnosis
- injury risk scoring
- readiness scoring
- fatigue scoring

## Acceptance criteria

S18 is accepted when:

- this document exists
- v1 boundary guard scaffold exists
- v1 scaffold CI guard exists
- lint:fast invokes the scaffold CI guard
- required guard function names exist
- required failure-token prefix exists
- scaffold behaviour is verified by the CI guard
- no database migration is added
- no registry content is added
- no template content is added
- no UI screen is added
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

## Later explicit migration allowances

The prohibition on database migrations above applies to the historical S18 scaffolding slice.

Later security or storage slices may add a migration only when its exact path is deliberately recorded by the S18 guard. The guard must continue to reject all unrecorded paths under `migrations/` and `db/migrations/`.

BETA-28 authorises this exact later-slice migration:

- `migrations/20260714_beta28_auth_rls_security.sql`

This exception does not authorise any other migration, database expansion, registry content, template content, UI surface, billing surface, marketplace surface, messaging surface, or organisation runtime.

## Next lane

The next lane is S19 - v1 locked activity set guard.

S19 should enforce the locked activity set more directly before registry expansion content begins.

<!-- S-V1-01:GUARD-BINDING:START -->
## S-V1-01 guard binding

The v1 boundary guard scaffolding is now bound to an active confirmation artefact.

Required artefacts:

- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.md
- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json
- ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs

The guard verifies the active v1 confirmation exists, is machine-readable, references the release boundary, and preserves engine isolation.
<!-- S-V1-01:GUARD-BINDING:END -->

## Amendment - strongman activated as v1's fourth locked activity

shared/v1-boundary/v1BoundaryGuards.mjs's `V1_SUPPORTED_ACTIVITIES` now contains powerlifting, general_strength, rugby_union, and strongman, per the amendment recorded in docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md. The scaffolding and its guard remain otherwise unchanged.
