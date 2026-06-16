# V1 Evidence Envelope Contract

Status: v1 slice contract
Slice: S-V1-45
Scope: evidence envelope schema, deterministic hash and seal contract, tamper fixture, tests, docs
Authority: subordinate to canonical engine, CI, replay, and evidence law

## Purpose

This document defines the v1 evidence envelope contract for artefacts that are already source-bound by the replay boundary contract.

Evidence proves process integrity only.

Evidence does not imply correctness.

The envelope does not create medical approval, suitability approval, user-status approval, training interpretation, coaching advice, programme interpretation, runtime mutation, registry mutation, or engine authority.

## Active contract

The implementation lives in:

- `src/v1EvidenceEnvelopeContract.mjs`
- `test/s_v1_45_evidence_envelope_contract.test.mjs`
- `ci/guards/s_v1_45_evidence_envelope_contract_guard.mjs`
- `ci/fixtures/s_v1_45_evidence_envelope_tamper_negative.json`

## Required input

The envelope builder accepts only:

- source binding
- replay boundary
- artefact binding
- issued timestamp

Unknown fields fail closed.

## Integrity boundary

Required replay boundary state:

- accepted proof available: true
- proof scope: process_integrity_only
- source bound: true
- external approval: false
- correctness claim: false
- training value claim: false

## Hash and seal

Envelope hash and seal hash are deterministic.

The material hash is computed from canonical sorted JSON over the envelope material before seal insertion.

The seal hash is computed from the contract id and material hash.

Tampered envelope material is rejected.

## Negative fixture

The negative fixture changes the recorded source hash after envelope creation.

Expected result:

- material hash mismatch
- no accepted verification result

## Non-scope

This slice does not implement:

- user-facing export
- product approval
- medical approval
- suitability approval
- coaching interpretation
- programme interpretation
- runtime mutation
- registry mutation
- engine mutation

## Required proof

Required local proof:

- `node --test test/s_v1_44_replay_boundary_contract.test.mjs`
- `node ci/guards/s_v1_44_replay_boundary_contract_guard.mjs`
- `node --test test/s_v1_45_evidence_envelope_contract.test.mjs`
- `node ci/guards/s_v1_45_evidence_envelope_contract_guard.mjs`
- `node ci/scripts/kolosseum_v0_test_suite.mjs`
- generated guard index refreshed by owning generator
- failure token index refreshed by owning generator
- checksum refresh
- encoding guards
- `npm.cmd run lint:fast`

## Final rule

Evidence envelope records may support v1 proof-boundary surfaces only by recording deterministic, source-bound process integrity state.

Any stronger claim is outside this slice.