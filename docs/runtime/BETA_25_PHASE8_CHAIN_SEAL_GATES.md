# BETA-25 Phase 8 Chain and Seal Gates

## Status

BETA-25 implements the Phase 8 chain validator and evidence seal-authorisation gate.

It does not materialise, persist, export, or display an EvidenceEnvelope. BETA-24 remains the closed envelope schema authority.

## Phase8Input

`Phase8Input` is closed-world and contains exactly:

- `phase5_output`
- `phase6_output`
- `phase7_output`
- `runner_verdict`

No additional fields are accepted.

CL, CI, product, payment, coach-note, organisation, UI, copy, and storage state are not Phase8Input fields.

## Separate seal-gate state

Seal eligibility uses a separate closed state object:

- `cl_passed`
- `ci_passed`
- `pre_seal_state`

This preserves the failure-domain boundary while still proving that CL passed and CI passed before evidence sealing can be authorised.

`pre_seal_state` must be `inactive`.

## Phase 5 to Phase 6 bindings

The validator requires:

- Phase 5 `canonical_input_hash` equals Phase 6 `canonical_input_hash`.
- Phase 5 `selection_hash` equals Phase 6 `selection_hash`.

## Phase 6 to Phase 7 bindings

The validator requires:

- Phase 6 `canonical_input_hash` equals Phase 7 `canonical_input_hash`.
- Phase 6 `selection_hash` equals Phase 7 `selection_hash`.
- Phase 6 `execution_status` equals Phase 7 `execution_status`.
- Phase 6 `execution_state` equals Phase 7 `execution_state` under canonical JSON.

The existing BETA-18 Phase 7 validator also verifies the projection hash and reducer-state binding.

## RunnerVerdict bindings

The BETA-23 RunnerVerdict must:

- be present;
- pass its canonical ID and checksum verification;
- have verdict `ACCEPTED`;
- echo the Phase 6 `canonical_input_hash`;
- echo the Phase 5 `selection_hash`;
- echo the Phase 7 `projection_hash`.

A missing, invalid, or rejected RunnerVerdict blocks evidence sealing.

## Seal preconditions

Evidence seal authorisation exists only when all of the following are true:

- CL passed;
- CI passed;
- replay was accepted;
- all Phase 5, Phase 6, Phase 7, and RunnerVerdict bindings match;
- `pre_seal_state` is `inactive`.

CL refusal, CI failure, replay rejection, a missing runner, any chain break, or active pre-seal state returns a closed failure token and no seal authorisation.

## Seal output

A successful gate emits one deterministic, frozen seal-authorisation record containing only:

- `phase8_seal_gate_id`
- `evidence_seal_authorised`
- `canonical_input_hash`
- `selection_hash`
- `projection_hash`
- `runner_verdict_id`
- `runner_verdict_checksum_sha256`
- `cl_passed`
- `ci_passed`
- `pre_seal_state`

## Boundary

No EvidenceEnvelope is created by BETA-25.

No persistence, timestamp, export, product route, payment state, coach note, organisation metadata, narrative, recommendation, or claim surface is introduced.

## Proof

Run:

`npm.cmd run proof:beta-25`

The proof includes a valid seal-authorisation chain and negative cases for extra input fields, CL refusal, CI failure, active pre-seal state, missing runner, rejected replay, invalid runner checksum, every required upstream hash binding, execution-status mismatch, and execution-state mismatch.
