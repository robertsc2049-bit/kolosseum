<!-- DEV NOTE: BETA-07 registry loader core record. This document records loader ordering and atomicity only; it does not activate candidate registries, add registry content, create fallback discovery, alter engine law, or redefine registry law. -->

# BETA-07 Registry Loader Core

Status: beta contract record.

## Purpose

BETA-07 hardens beta registry loading so the runtime registry store is created only after the complete canonical registry bundle validates.

## Boundary

The loader extends the existing S-REG-04 registry bridge module.

It does not create a duplicate loader, discover files, mutate registries, activate candidate registries, add registry content, or change deterministic engine semantics.

## Canonical order

The beta registry load order is:

1. `activity`
2. `movement`
3. `exercise`
4. `program`

Any different order fails closed.

## Atomicity rules

The loader must:

- load all required registries or fail before returning a runtime store
- refuse missing registries
- refuse duplicate registry IDs
- refuse registry document IDs that do not match their registry key
- refuse unknown registry references
- refuse downstream or forward references
- return a read-only runtime store only after all validation succeeds
- expose no fallback, discovery, partial-consumption, or runtime-mutation path

## Machine proof

Machine-checkable implementation and proof:

- `ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs`
- `test/beta_07_registry_loader_core.test.mjs`
- `ci/fixtures/beta_07_registry_loader_core/positive_beta_registry_load.json`
- `ci/fixtures/beta_07_registry_loader_core/negative_missing_registry.json`
- `ci/fixtures/beta_07_registry_loader_core/negative_wrong_order.json`
- `ci/fixtures/beta_07_registry_loader_core/negative_duplicate_registry_id.json`
- `ci/fixtures/beta_07_registry_loader_core/negative_unknown_registry_reference.json`
- `ci/fixtures/beta_07_registry_loader_core/negative_forward_reference.json`

## Failure token boundary

BETA-07 loader failures use stable BETA-07 loader tokens only. They do not redefine existing registry law, CI wrapper, replay, evidence, or engine failure tokens.
