# V0 Evidence Envelope and Seal Closure

Status: v0 evidence envelope and seal closure record.

Slice coverage: S-V0-20 Evidence Envelope and Seal Closure.

## Purpose

This record closes the v0 evidence envelope and seal inspection.

This slice does not create user-facing proof export, Phase 8 evidence sealing, audit-pack export, or v1 proof-layer capability. It verifies the existing committed CI evidence envelope and seal artefacts against the repository generator and guard.

## Canonical generator

The only approved generator for this slice is:

    node ci/scripts/evidence_seal.mjs --write

The generator writes:

- `ci/evidence/evidence_envelope.v1.json`
- `ci/evidence/evidence_seal.v1.json`

Do not edit those generated JSON files by hand.

## Guard

The required guard is:

    node ci/guards/evidence_seal_guard.mjs

The wrapper delegates to:

    node ci/scripts/evidence_seal.mjs --check

The guard must pass before the generated evidence files are committed or promoted.

## Regeneration rule

Regenerate the evidence envelope and seal only when:

- either generated file is missing
- `ci/guards/evidence_seal_guard.mjs` reports drift
- a committed source file used by `ci/scripts/evidence_seal.mjs` changes and causes the canonical recompute to change

After regeneration, run the guard. Commit the generated evidence files only when they match the canonical recompute.

## Boundary

This closure record does not expand v0 scope.

It does not activate:

- user-facing evidence export
- Phase 8 evidence sealing as product capability
- audit pack export
- coach evidence access
- athlete evidence access
- v1 proof-layer surfaces

## S-V0-20 completion proof

S-V0-20 is complete when:

1. The generator has been run.
2. The evidence seal guard passes.
3. The regeneration rule is documented.
4. Generated evidence files are committed only if changed by the generator.
5. Clean-tree gates pass.
6. GitHub PR checks pass before promotion.