# V1 Replay Boundary Contract

Status: v1 slice contract
Slice: S-V1-44
Scope: Replay boundary, proof-aware surfaces, tests, docs
Authority: subordinate to canonical engine, CI, replay, and evidence law

## Purpose

This document defines the v1 replay boundary contract for proof-aware surfaces.

Replay records process integrity only.

Replay does not create external third-party approval.
Replay does not create a correctness claim.
Replay does not create a training value claim.
Replay does not alter sessions, runtime events, coach notes, compile output, registry data, or evidence artefacts.

## Active contract

The implementation lives in:

- `src/v1ReplayBoundaryContract.mjs`
- `test/s_v1_44_replay_boundary_contract.test.mjs`
- `ci/guards/s_v1_44_replay_boundary_contract_guard.mjs`

## Replay scope

Allowed replay phases:

- `phase2`
- `phase6`

Forbidden replay phases:

- `phase1`
- `phase3`
- `phase4`
- `phase5`
- `phase7`
- `phase8`

Any replay record that claims a forbidden phase fails closed.

## Source binding

Every replay boundary record must include:

- `source_id`
- `source_type`
- `source_hash_sha256`

The output must echo the declared source identity exactly.

Replay output is bound to the declared source.

## Accepted replay

Accepted replay may expose only:

- replay verdict
- replayed phases
- output hash
- source binding
- process-integrity-only proof boundary
- controlled copy ids

Allowed wording:

- `Replay records process integrity only.`
- `Replay output is bound to the declared source.`

## Rejected replay

Rejected replay must not expose accepted proof availability.

Rejected replay must include at least one failure token and must not include an accepted output hash.

Allowed wording:

- `Replay rejected. Accepted proof is not available.`
- `Replay output is bound to the declared source.`

## Non-scope

This slice does not implement:

- evidence generation
- evidence sealing
- exportable proof artefacts
- external third-party approval
- training interpretation
- programme interpretation
- coach intervention
- runtime mutation
- registry mutation
- certification surfaces

## Proof

Required local proof:

- `node --test test/s_v1_44_replay_boundary_contract.test.mjs`
- `node ci/guards/s_v1_44_replay_boundary_contract_guard.mjs`
- generated guard index refreshed by owning generator
- failure token index check
- checksum refresh
- encoding guards
- `npm.cmd run lint:fast`

## Final rule

Replay boundary records may support proof-aware surfaces only by recording source-bound process integrity state.

Any stronger claim is outside this slice.