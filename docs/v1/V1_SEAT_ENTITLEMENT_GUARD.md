# V1 Seat Entitlement Guard

Status: active v1 controlled-launch boundary document.
Slice: S-V1-P-03.
Version: 1.0.0.

## Purpose

This document defines the controlled-launch seat entitlement guard.

The guard consumes the controlled-launch billing/access record created by S-V1-P-02.

The guard returns product access allow or reject only.

Access rejection is product-layer failure, not an engine decision.

## Allowed scope

S-V1-P-03 permits:

- controlled-launch coach seat entitlement
- controlled-launch athlete seat entitlement
- product access allow verdicts
- product access reject verdicts
- seat limit comparison against explicit recorded counts
- factual copy for product access state
- an API-shaped adapter for entitlement requests

## Not included

S-V1-P-03 does not implement:

- enterprise seats
- organisation seats
- organization seats
- team seats
- unit seats
- gym seats
- multi-entity seats
- marketplace seats
- self-serve seat management
- seat transfer
- seat invoicing
- procurement workflow
- revenue share
- royalties
- engine decision logic

## Boundary invariants

1. Seat entitlement controls product access only.
2. Seat entitlement state is not deterministic input.
3. Seat entitlement state is not compile input.
4. Seat entitlement state is not substitution input.
5. Seat entitlement state is not replay input.
6. Seat entitlement state is not proof input.
7. Seat entitlement state is not factual history input.
8. A rejected entitlement is product access failure.
9. A rejected entitlement is not an engine decision.
10. A rejected entitlement must not alter existing execution records.

## Contract files

- `src/v1SeatEntitlementGuard.mjs`
- `src/api/v1SeatEntitlementGuardApi.mjs`
- `test/s_v1_p_03_seat_entitlement_guard.test.mjs`
- `ci/guards/s_v1_p_03_seat_entitlement_guard_guard.mjs`
- `copy/seat_entitlement_copy.json`

## Required proof

The slice must prove:

- seat allowed test
- seat rejected test
- inactive billing/access record rejection
- forbidden seat scope rejection
- actor mismatch rejection
- engine isolation test
- copy remains factual
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_SEAT_ENTITLEMENT_GUARD`

## Final rule

If seat entitlement changes deterministic legality, compile output, substitution, replay, proof, or factual history, the implementation is invalid.