# V1 Billing Management Surface

Status: active v1 controlled-launch boundary document.
Slice: S-V1-P-04.
Version: 1.0.0.

## Purpose

This document defines the controlled-launch billing management and customer portal surface.

The surface consumes the controlled-launch billing/access record created by S-V1-P-02.

The surface may create a factual billing overview.

The surface may create a provider-ready customer portal request.

This slice does not add a live Stripe SDK dependency.

This slice does not call a provider API.

Billing state is separate from coach-athlete relationship truth.

## Allowed scope

S-V1-P-04 permits:

- controlled-launch billing overview
- controlled-launch customer portal request shape
- factual billing access state display
- factual billing status display
- factual seat limit display
- billing management API-shaped adapter
- factual billing management copy

## Not included

S-V1-P-04 does not implement:

- live Stripe SDK calls
- provider secret handling
- provider signature verification
- enterprise billing
- enterprise procurement
- commercial account surfaces
- multi-entity billing
- organisation billing
- organization billing
- team billing
- unit billing
- gym billing
- marketplace billing
- invoice generation
- tax handling
- revenue share
- royalties
- self-serve seat management
- seat transfer
- coach-athlete relationship creation
- coach-athlete relationship update
- engine decision logic

## Boundary invariants

1. Billing UI/API does not change engine legality.
2. Billing UI/API does not change compile output.
3. Billing UI/API does not change substitution selection.
4. Billing UI/API does not change replay records.
5. Billing UI/API does not change proof records.
6. Billing UI/API does not change factual history records.
7. Billing UI/API does not create coach-athlete relationships.
8. Billing UI/API does not update coach-athlete relationships.
9. Billing state remains separate from coach-athlete relationship truth.
10. Copy remains factual.

## Contract files

- `src/v1BillingManagementSurface.mjs`
- `src/api/v1BillingManagementSurfaceApi.mjs`
- `test/s_v1_p_04_billing_management_surface.test.mjs`
- `ci/guards/s_v1_p_04_billing_management_surface_guard.mjs`
- `copy/billing_management_copy.json`

## Required proof

The slice must prove:

- billing overview test
- customer portal request test
- billing management API test
- rejected enterprise billing scope
- rejected commercial account scope
- relationship truth separation test
- engine isolation test
- copy remains factual
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_BILLING_MANAGEMENT_SURFACE`

## Final rule

If billing management state changes deterministic legality, compile output, substitution, replay, proof, factual history, or coach-athlete relationship truth, the implementation is invalid.