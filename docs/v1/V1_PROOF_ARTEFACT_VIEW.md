# V1 Proof Artefact View

Status: v1 proof-layer read-model contract.

Slice: S-V1-46 Proof Artefact View.

## Purpose

This slice adds a permission-scoped proof artefact view for existing replay and envelope records.

The view presents recorded source, verdict, envelope state, hashes, and missing-proof state as facts only.

## Boundary

Included:

- proof artefact read model
- API adapter status mapping
- UI renderer contract using copy ids only
- permission scope checks
- source-bound record checks
- envelope mismatch checks
- not_available state for missing envelope records

Not included:

- new engine behaviour
- new replay behaviour
- new envelope creation
- new export flow
- external attestation wording
- user comparison wording
- training value wording
- fitness-state wording
- live coach action

## Invariants

Artefact view is factual and source-bound.

Missing proof remains not_available.

Permission is scoped to the owning athlete or active assigned coach relationship.

The view does not mutate Phase 1, replay, evidence envelope, coach notes, registry, or engine output.

The renderer emits copy ids and factual values only.

## Source files

- src/v1ProofArtefactViewContract.mjs
- test/s_v1_46_proof_artefact_view.test.mjs
- ci/guards/s_v1_46_proof_artefact_view_guard.mjs
- copy/proof_artefact_view_copy.json

## Required proof

Run:

    node --test test/s_v1_46_proof_artefact_view.test.mjs
    node ci/guards/s_v1_46_proof_artefact_view_guard.mjs
    npm.cmd run lint:fast

## Completion

S-V1-46 is complete only when the targeted test, targeted guard, generated indexes, checksum update, and lint:fast pass from a clean tree.