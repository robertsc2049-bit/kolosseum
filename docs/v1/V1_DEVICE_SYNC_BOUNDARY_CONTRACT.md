# V1 Device Sync Boundary Contract

Status: active v1 controlled-launch boundary document.
Slice: S-V1-P-05.
Version: 1.0.0.

## Purpose

This document defines the controlled-launch device/wearable sync boundary before device sync implementation.

Device sync state is factual reported-metric state only.

The deterministic engine boundary remains outside this contract.

Compile output, substitution selection, replay records, proof records, and factual history records remain outside this contract.

## Allowed controls

S-V1-P-05 permits device or wearable sync to control only:

- a device connection record (opaque provider account identifier, frozen/hashed)
- factual reported-metric records stored as ordinary factual history
- read-only display of synced metric history to the athlete and their coach

These are product-layer, factual-history controls only.

## Not included

S-V1-P-05 does not implement:

- live OAuth or SDK calls to any wearable or health provider
- secret or token storage of any kind
- any provider-computed readiness, recovery, strain, or similar score
- automatic engine input
- automatic programme adjustment
- automatic coaching decisions based on synced data
- real Apple Health, Garmin, or Whoop integration

A later slice (S-V1-P-06) may implement contract-style ingestion only, mirroring the existing Stripe controlled-launch pattern: no live provider calls, no secrets stored, external identity modelled as opaque, hash-frozen records.

## Boundary invariants

1. Device sync state is not deterministic input.
2. Device sync state is not compile input.
3. Device sync state is not substitution input.
4. Device sync state is not replay input.
5. Device sync state is not proof input.
6. Device sync state is not factual history input in any form that alters engine truth.
7. A provider-computed score, label, or recommendation must be rejected at ingestion, not stored-then-hidden.
8. No live provider network call may occur in this contract slice.
9. No provider secret, token, or credential may be stored.
10. Device connection identity is opaque and hashed; it carries no live authentication capability.

## Contract files

- `docs/v1/V1_DEVICE_SYNC_BOUNDARY_CONTRACT.md`
- `docs/v1/V1_NOT_IN_SCOPE.md` (S-V1-P-05 anchored non-scope block)
- `ci/guards/s_v1_p_05_device_sync_boundary_contract_guard.mjs`

## Required proof

The slice must prove:

- the boundary contract doc exists and states allowed and not-included scope
- a cross-referenced anchored non-scope block exists in `V1_NOT_IN_SCOPE.md`
- no device sync implementation code exists in this doc-only step
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_DEVICE_SYNC_BOUNDARY_CONTRACT`

## Final rule

If device or wearable sync state changes deterministic legality, compile output, substitution, replay, proof, or factual history, or if any provider-computed score is stored rather than rejected at ingestion, the implementation is invalid.
