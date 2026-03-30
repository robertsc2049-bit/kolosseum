# V1 Registry Seal Lifecycle

## Purpose

This document defines the only lawful lifecycle for registry seal activation in the repo.

The lifecycle is explicit, machine-checkable, and closed-world.

## States

### pre_seal

- Registry seal enforcement is not active.
- Seal artefacts may exist, but they are not treated as active enforcement state.
- The repo may prepare seal artefacts and run completeness checks.
- Transitioning back into or remaining in `pre_seal` via an activation request is illegal.

### sealed

- Registry seal enforcement is active.
- The repo must treat registry seal state as binding.
- Required seal artefacts must exist.
- The lifecycle may only enter `sealed` from `pre_seal`.

## Allowed transition set

The only lawful transition is:

- `pre_seal` -> `sealed`

## Forbidden transitions

The following transitions are illegal:

- `pre_seal` -> `pre_seal`
- `sealed` -> `sealed`
- `sealed` -> `pre_seal`

## Machine contract

The machine-readable lifecycle artefact is:

- `ci/evidence/registry_seal_lifecycle.v1.json`

The machine-checking gate is:

- `ci/scripts/run_registry_seal_gate.mjs`

## Final rule

If lifecycle state is ambiguous, missing, or requests a transition outside `pre_seal` -> `sealed`, the registry seal lifecycle is invalid and CI must fail.