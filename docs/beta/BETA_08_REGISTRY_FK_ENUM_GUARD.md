<!-- DEV NOTE: BETA-08 registry FK and enum guard record. This document records CI validation boundaries only; it does not activate candidate registries, add registry content, create metric semantics, create threshold evaluators, alter Phase 1 runtime acceptance, or change deterministic engine behaviour. -->

# BETA-08 Registry FK and Enum Guard

Status: beta contract record.

## Purpose

BETA-08 makes beta registry references and enum usage fail closed before registry-linked beta paths are consumed.

## Boundary

BETA-08 extends registry validation by composing the existing BETA-07 atomic registry loader.

It does not create a duplicate loader, discover registry files, activate candidate registries, add metric content, create derived metric behaviour, create threshold marker evaluation, or alter Phase 1/runtime engine semantics.

## Guarded domains

The BETA-08 guard validates:

- beta activity enum tokens
- metric value type enum tokens
- metric kind enum tokens
- metric source enum tokens
- duplicate registry entry IDs
- activity/subdivision foreign keys
- sport metric/activity/subdivision consistency
- metric-to-exercise link foreign keys
- Phase 1 declared metric references
- derived-only metric exclusion from Phase 1 declarations
- cross-domain registry contamination

## Required positive fixtures

Positive fixtures cover the beta activity set:

- `powerlifting`
- `rugby_union`
- `general_strength`

## Required negative fixtures

Negative fixtures prove fail-closed behaviour for:

- unknown enum token
- unresolved FK
- duplicate entry ID
- missing 1C-A metric-to-exercise link
- metric/activity mismatch
- activity/subdivision mismatch
- derived-only metric in Phase 1
- registry cross-domain contamination

## Machine proof

Machine-checkable implementation and proof:

- `ci/registry/beta_08_registry_fk_enum_guard.mjs`
- `ci/fixtures/beta_08_registry_fk_enum_guard/fixture_cases.mjs`
- `test/beta_08_registry_fk_enum_guard.test.mjs`
- `ci/contracts/registry_law_positive_ci_cluster.json`

## Failure-token boundary

BETA-08 loader/guard failures use stable BETA-08 CI tokens only. They do not redefine S-REG, BETA-07, Phase 1, replay, evidence, or runtime engine failure tokens.
