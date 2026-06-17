# V1 Payment Boundary Contract

Status: active v1 controlled-launch boundary document.
Slice: S-V1-P-01.
Version: 1.0.0.

## Purpose

This document defines the controlled-launch payment boundary before payment implementation.

Payment state is commercial-access state only.

The deterministic engine boundary remains outside this contract.

Compile output, substitution selection, replay records, proof records, and factual history records remain outside this contract.

## Allowed controls

S-V1-P-01 permits payment or commercial access state to control only:

- product access state
- plan visibility
- seat limit
- billing surface visibility

These are product-layer controls only.

## Not included

S-V1-P-01 does not implement:

- Stripe Checkout
- payment provider webhooks
- subscriptions
- self-serve seat management
- enterprise billing
- multi-entity billing
- organisation billing
- marketplace billing
- invoices
- tax handling
- automated upsell control during an active session
- any deterministic output change

## Boundary invariants

1. Commercial access state is not deterministic input.
2. Commercial access state is not compile input.
3. Commercial access state is not substitution input.
4. Commercial access state is not replay input.
5. Commercial access state is not proof input.
6. Commercial access state is not factual history input.
7. Seat count limits product access only.
8. Plan visibility changes visible product surfaces only.
9. Billing surface visibility changes billing surfaces only.
10. Automated upsell control must not change access during an active session.

## Contract files

- `src/v1PaymentBoundaryContract.mjs`
- `test/s_v1_p_01_payment_boundary_contract.test.mjs`
- `ci/guards/s_v1_p_01_payment_boundary_contract_guard.mjs`
- `copy/payment_boundary_copy.json`

## Required proof

The slice must prove:

- closed payment boundary contract
- payment no-coupling test
- deterministic probe hash is unchanged by commercial access state
- forbidden deterministic effect requests fail closed
- automated mid-session upsell control fails closed
- neutral copy
- no engine import
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_PAYMENT_BOUNDARY_CONTRACT`

## Final rule

If payment or commercial access state changes deterministic legality, compile output, substitution, replay, proof, or factual history, the implementation is invalid.