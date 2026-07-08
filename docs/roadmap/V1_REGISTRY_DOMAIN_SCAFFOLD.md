<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S21 - v1 registry domain scaffold

## Status

Accepted as an inert scaffold slice.

Recorded at UTC: 2026-06-05T08:31:49Z

## Context

The v0 release lane is closed.

S19 enforced the locked v1 activity set.

S20 hardened the v1 registry schema target.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 registry schema target hardening commit: 387c8cbb1d2420a9855e8b446c6514888f453f5a

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice creates an inert v1 registry domain scaffold. It does not add registry content records, exercise records, equipment records, substitution edges, programme templates, UI screens, database migrations, auth provider integration, billing, proof, export, or commercial surfaces.

## Purpose

S21 creates a machine-readable scaffold for the v1 registry domain map before registry content production begins.

The scaffold gives later slices a stable domain list and required field groups without creating active records.

## Locked v1 activities

The scaffold remains limited to:

- powerlifting
- general_strength
- rugby_union

No scaffold entry may widen the active v1 activity set.

## Scaffolded domains

The inert scaffold covers exactly these registry domains:

- activity_registry
- movement_pattern_registry
- exercise_registry
- equipment_registry
- exercise_activity_applicability_registry
- exercise_equipment_compatibility_registry
- substitution_edge_registry
- programme_template_registry
- instruction_display_copy_registry
- copy_legal_claim_boundary_registry

## Required field groups

The scaffold must expose required field groups for every domain.

It must not expose active content rows.

It must not expose seed registry records.

It must not expose template records.

It must not expose implementation flows.

## Files changed

Expected files:

- docs/roadmap/V1_REGISTRY_DOMAIN_SCAFFOLD.md
- shared/v1-registry/v1RegistryDomainScaffold.mjs
- ci/guards/v1_registry_domain_scaffold_guard.mjs
- docs/GUARDS_INDEX.md
- package.json

## Files explicitly not changed

This slice must not modify:

- package-lock.json
- registry data
- exercise data
- equipment data
- programme templates
- substitution content
- database migrations
- UI screens
- auth provider integration
- organisation/team/gym/federation surfaces
- marketplace surfaces
- messaging or chat surfaces
- EPOS or gym access surfaces
- package version
- release tags

## Scaffold behaviour

The scaffold must prove:

- domain ids are stable
- domain count is exactly 10
- all S20 required domains exist
- every domain has a required field group
- each field group is non-empty
- the locked activity set is exported as powerlifting, general_strength, and rugby_union
- no additional active activity id is exported
- no content record arrays are exported
- no template records are exported
- no migration surface is created

## CI integration

S21 adds:

- ci/guards/v1_registry_domain_scaffold_guard.mjs

and wires it into:

- npm.cmd run lint:fast

The guard should run after the S20 registry schema target guard.

## Acceptance criteria

S21 is accepted when:

- this document exists
- the inert scaffold module exists
- the S21 CI guard exists
- the S21 guard is indexed in docs/GUARDS_INDEX.md
- lint:fast invokes the S21 guard
- scaffolded domain count is exactly 10
- scaffolded domains match S20 required domains
- every scaffolded domain has required fields
- locked activities remain powerlifting, general_strength, and rugby_union
- no registry content records are added
- no template records are added
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

Do not add registry content records in this slice.

Do not add templates in this slice.

Do not add UI screens in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is S22 - v1 registry content production contract.

S22 should define how registry content will be produced and reviewed before any content records are added.
